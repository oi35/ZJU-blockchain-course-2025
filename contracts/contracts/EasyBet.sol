// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LotteryTicket.sol";

/**
 * @title EasyBet
 * @dev 去中心化彩票系统主合约
 */
contract EasyBet {
    // 彩票Token合约
    LotteryTicket public lotteryTicket;

    // BET Token合约
    IERC20 public betToken;

    // 活动计数器
    uint256 private _activityIdCounter;

    // 订单计数器
    uint256 private _orderIdCounter;

    // 活动结构
    struct Activity {
        uint256 id;
        address creator; // 公证人
        string name; // 活动名称
        string[] choices; // 选项列表
        uint256[] odds; // 每个选项的赔率（用基点表示，100 = 1.0倍，150 = 1.5倍）
        uint256 totalPool; // 总对赌池
        uint256 deadline; // 截止时间
        bool settled; // 是否已结算
        uint256 winningChoice; // 获胜选项（结算后设置）
        uint256 createdAt; // 创建时间
    }

    // 活动ID -> 选项索引 -> 该选项的投注总额
    mapping(uint256 => mapping(uint256 => uint256)) public choiceAmounts;

    // 活动ID -> 选项索引 -> 彩票ID列表（用于结算时遍历）
    mapping(uint256 => mapping(uint256 => uint256[])) public choiceTickets;

    // 订单结构（链上订单簿）
    struct Order {
        uint256 id;
        address seller; // 卖家
        uint256 ticketId; // 彩票Token ID
        uint256 price; // 出售价格
        bool active; // 订单是否有效
        uint256 createdAt; // 创建时间
    }

    // 活动映射
    mapping(uint256 => Activity) public activities;

    // 订单映射
    mapping(uint256 => Order) public orders;

    // 活动ID -> 选项索引 -> 彩票数量
    mapping(uint256 => mapping(uint256 => uint256)) public activityChoiceCount;

    // 活动ID -> 选项索引 -> 购买者列表
    mapping(uint256 => mapping(uint256 => address[])) public activityChoiceBuyers;

    // 活动ID -> 所有订单ID列表
    mapping(uint256 => uint256[]) public activityOrders;

    // 彩票ID -> 是否正在挂单中
    mapping(uint256 => bool) public ticketInOrder;

    // 事件
    event ActivityCreated(
        uint256 indexed activityId,
        address indexed creator,
        string name,
        uint256[] odds,
        uint256 deadline
    );

    event TicketPurchased(
        uint256 indexed activityId,
        uint256 indexed ticketId,
        address indexed buyer,
        uint256 choice,
        uint256 amount,
        uint256 odds
    );

    event OrderCreated(
        uint256 indexed orderId,
        uint256 indexed ticketId,
        address indexed seller,
        uint256 price
    );

    event OrderCancelled(uint256 indexed orderId);

    event OrderPriceUpdated(
        uint256 indexed orderId,
        uint256 indexed ticketId,
        uint256 oldPrice,
        uint256 newPrice
    );

    event OrderFilled(
        uint256 indexed orderId,
        uint256 indexed ticketId,
        address indexed buyer,
        address seller,
        uint256 price
    );

    event ActivitySettled(
        uint256 indexed activityId,
        uint256 winningChoice,
        uint256 totalWinners,
        uint256 prizePerWinner
    );

    event OddsUpdated(
        uint256 indexed activityId,
        uint256[] newOdds
    );

    constructor(address _betTokenAddress) {
        betToken = IERC20(_betTokenAddress);
        lotteryTicket = new LotteryTicket();
        lotteryTicket.setEasyBetContract(address(this));
        _activityIdCounter = 0;
        _orderIdCounter = 0;
    }

    /**
     * @dev 创建竞猜活动（公证人）
     */
    function createActivity(
        string memory name,
        string[] memory choices,
        uint256[] memory odds,
        uint256 duration
    ) external returns (uint256) {
        require(choices.length >= 2, "At least 2 choices required");
        require(choices.length == odds.length, "Choices and odds length mismatch");
        require(duration > 0, "Duration must be positive");

        // 验证赔率有效性（每个赔率应该 >= 100，即至少1.0倍）
        for (uint256 i = 0; i < odds.length; i++) {
            require(odds[i] >= 100, "Odds must be at least 100 (1.0x)");
        }

        uint256 activityId = _activityIdCounter;
        _activityIdCounter++;

        Activity storage activity = activities[activityId];
        activity.id = activityId;
        activity.creator = msg.sender;
        activity.name = name;
        activity.choices = choices;
        activity.odds = odds;
        activity.totalPool = 0; // 初始对赌池为0
        activity.deadline = block.timestamp + duration;
        activity.settled = false;
        activity.createdAt = block.timestamp;

        emit ActivityCreated(
            activityId,
            msg.sender,
            name,
            odds,
            activity.deadline
        );

        return activityId;
    }

    /**
     * @dev 购买彩票
     */
    function buyTicket(uint256 activityId, uint256 choice, uint256 amount) external returns (uint256) {
        Activity storage activity = activities[activityId];
        require(activity.creator != address(0), "Activity does not exist");
        require(block.timestamp < activity.deadline, "Activity expired");
        require(!activity.settled, "Activity already settled");
        require(choice < activity.choices.length, "Invalid choice");
        require(amount > 0, "Amount must be positive");

        // 扣除用户的BET Token
        require(
            betToken.transferFrom(msg.sender, address(this), amount),
            "Payment failed"
        );

        // 加入对赌池
        activity.totalPool += amount;
        choiceAmounts[activityId][choice] += amount;

        // 获取当前选项的赔率并锁定到彩票上
        uint256 lockedOdds = activity.odds[choice];

        // 铸造彩票NFT（含锁定赔率）
        uint256 ticketId = lotteryTicket.mintTicket(
            msg.sender,
            activityId,
            choice,
            amount,
            lockedOdds
        );

        // 记录购买信息
        activityChoiceCount[activityId][choice]++;
        activityChoiceBuyers[activityId][choice].push(msg.sender);
        choiceTickets[activityId][choice].push(ticketId); // 记录彩票ID

        emit TicketPurchased(activityId, ticketId, msg.sender, choice, amount, lockedOdds);

        return ticketId;
    }

    /**
     * @dev 创建卖单（挂单出售彩票）
     */
    function createOrder(uint256 ticketId, uint256 price) external returns (uint256) {
        require(price > 0, "Price must be positive");
        require(lotteryTicket.ownerOf(ticketId) == msg.sender, "Not ticket owner");
        require(!ticketInOrder[ticketId], "Ticket already in order"); // 防止重复挂单

        // 获取彩票信息
        (uint256 activityId, , , , ) = lotteryTicket.getTicketInfo(ticketId);
        Activity storage activity = activities[activityId];

        require(block.timestamp < activity.deadline, "Activity expired");
        require(!activity.settled, "Activity already settled");

        // 将彩票授权给合约（用于后续交易）
        // 注意：用户需要先调用 lotteryTicket.approve(address(this), ticketId)

        uint256 orderId = _orderIdCounter;
        _orderIdCounter++;

        orders[orderId] = Order({
            id: orderId,
            seller: msg.sender,
            ticketId: ticketId,
            price: price,
            active: true,
            createdAt: block.timestamp
        });

        activityOrders[activityId].push(orderId);
        ticketInOrder[ticketId] = true; // 标记彩票正在挂单中

        emit OrderCreated(orderId, ticketId, msg.sender, price);

        return orderId;
    }

    /**
     * @dev 取消订单
     */
    function cancelOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.active, "Order not active");
        require(order.seller == msg.sender, "Not order owner");

        order.active = false;
        ticketInOrder[order.ticketId] = false; // 清除挂单标记

        emit OrderCancelled(orderId);
    }

    /**
     * @dev 修改订单价格
     */
    function updateOrderPrice(uint256 orderId, uint256 newPrice) external {
        Order storage order = orders[orderId];
        require(order.active, "Order not active");
        require(order.seller == msg.sender, "Not order owner");
        require(newPrice > 0, "Price must be positive");

        uint256 oldPrice = order.price;
        order.price = newPrice;

        emit OrderPriceUpdated(orderId, order.ticketId, oldPrice, newPrice);
    }

    /**
     * @dev 购买挂单彩票
     */
    function fillOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.active, "Order not active");

        // 获取彩票信息
        uint256 ticketId = order.ticketId;
        (uint256 activityId, , , , ) = lotteryTicket.getTicketInfo(ticketId);
        Activity storage activity = activities[activityId];

        require(block.timestamp < activity.deadline, "Activity expired");
        require(!activity.settled, "Activity already settled");

        // 买家支付BET Token给卖家
        require(
            betToken.transferFrom(msg.sender, order.seller, order.price),
            "Payment failed"
        );

        // 转移彩票NFT
        lotteryTicket.transferFrom(order.seller, msg.sender, ticketId);

        // 标记订单为已完成
        order.active = false;
        ticketInOrder[ticketId] = false; // 清除挂单标记

        emit OrderFilled(orderId, ticketId, msg.sender, order.seller, order.price);
    }

    /**
     * @dev 更新活动赔率（仅创建者可调用）
     */
    function updateOdds(uint256 activityId, uint256[] memory newOdds) external {
        Activity storage activity = activities[activityId];
        require(activity.creator == msg.sender, "Only creator can update odds");
        require(!activity.settled, "Activity already settled");
        require(block.timestamp < activity.deadline, "Activity expired");
        require(newOdds.length == activity.choices.length, "Odds length mismatch");

        // 验证赔率有效性
        for (uint256 i = 0; i < newOdds.length; i++) {
            require(newOdds[i] >= 100, "Odds must be at least 100 (1.0x)");
        }

        // 更新赔率
        activity.odds = newOdds;

        emit OddsUpdated(activityId, newOdds);
    }

    /**
     * @dev 公证人公布结果并结算
     */
    function settleActivity(uint256 activityId, uint256 winningChoice) external {
        Activity storage activity = activities[activityId];
        require(activity.creator == msg.sender, "Only creator can settle");
        require(block.timestamp >= activity.deadline, "Activity not expired yet");
        require(!activity.settled, "Already settled");
        require(winningChoice < activity.choices.length, "Invalid winning choice");

        activity.settled = true;
        activity.winningChoice = winningChoice;

        // 获取获胜选项的所有彩票ID
        uint256[] storage winningTickets = choiceTickets[activityId][winningChoice];
        uint256 totalWinners = winningTickets.length;

        if (totalWinners == 0) {
            // 如果没有获胜者，对赌池退还给公证人
            if (activity.totalPool > 0) {
                betToken.transfer(activity.creator, activity.totalPool);
            }
            emit ActivitySettled(activityId, winningChoice, 0, 0);
            return;
        }

        // 第一轮：计算总应付奖金
        uint256 totalPayout = 0;
        for (uint256 i = 0; i < totalWinners; i++) {
            uint256 ticketId = winningTickets[i];
            (, , uint256 ticketAmount, uint256 ticketOdds, ) = lotteryTicket.getTicketInfo(ticketId);
            // 应得奖金 = 投注金额 × 赔率 / 100
            uint256 expectedPayout = (ticketAmount * ticketOdds) / 100;
            totalPayout += expectedPayout;
        }

        // 第二轮：分发奖金
        uint256 actualTotalPaid = 0;

        if (totalPayout <= activity.totalPool) {
            // 对赌池足够，全额支付
            for (uint256 i = 0; i < totalWinners; i++) {
                uint256 ticketId = winningTickets[i];
                (, , uint256 ticketAmount, uint256 ticketOdds, address owner) = lotteryTicket.getTicketInfo(ticketId);
                uint256 payout = (ticketAmount * ticketOdds) / 100;
                betToken.transfer(owner, payout);
                actualTotalPaid += payout;
            }
            // 剩余的对赌池退还给公证人
            uint256 remaining = activity.totalPool - actualTotalPaid;
            if (remaining > 0) {
                betToken.transfer(activity.creator, remaining);
            }
        } else {
            // 对赌池不足，按比例分配
            for (uint256 i = 0; i < totalWinners; i++) {
                uint256 ticketId = winningTickets[i];
                (, , uint256 ticketAmount, uint256 ticketOdds, address owner) = lotteryTicket.getTicketInfo(ticketId);
                uint256 expectedPayout = (ticketAmount * ticketOdds) / 100;
                // 实际获得 = 应得 × (对赌池 / 总应付)
                uint256 actualPayout = (expectedPayout * activity.totalPool) / totalPayout;
                betToken.transfer(owner, actualPayout);
                actualTotalPaid += actualPayout;
            }
        }

        emit ActivitySettled(activityId, winningChoice, totalWinners, actualTotalPaid / totalWinners);
    }

    /**
     * @dev 获取活动信息
     */
    function getActivity(uint256 activityId)
        external
        view
        returns (
            uint256 id,
            address creator,
            string memory name,
            string[] memory choices,
            uint256[] memory odds,
            uint256 totalPool,
            uint256 deadline,
            bool settled,
            uint256 winningChoice,
            uint256 createdAt
        )
    {
        Activity storage activity = activities[activityId];
        return (
            activity.id,
            activity.creator,
            activity.name,
            activity.choices,
            activity.odds,
            activity.totalPool,
            activity.deadline,
            activity.settled,
            activity.winningChoice,
            activity.createdAt
        );
    }

    /**
     * @dev 获取活动的订单列表
     */
    function getActivityOrders(uint256 activityId) external view returns (uint256[] memory) {
        return activityOrders[activityId];
    }

    /**
     * @dev 获取活动的某个选项的购买数量
     */
    function getChoiceCount(uint256 activityId, uint256 choice) external view returns (uint256) {
        return activityChoiceCount[activityId][choice];
    }

    /**
     * @dev 获取所有活动数量
     */
    function getActivityCount() external view returns (uint256) {
        return _activityIdCounter;
    }

    /**
     * @dev 获取订单簿信息（按价格排序的卖单）
     */
    function getOrderBook(uint256 activityId)
        external
        view
        returns (
            uint256[] memory orderIds,
            uint256[] memory ticketIds,
            uint256[] memory prices,
            address[] memory sellers
        )
    {
        uint256[] storage allOrders = activityOrders[activityId];
        uint256 activeCount = 0;

        // 计算有效订单数量
        for (uint256 i = 0; i < allOrders.length; i++) {
            if (orders[allOrders[i]].active) {
                activeCount++;
            }
        }

        // 分配数组
        orderIds = new uint256[](activeCount);
        ticketIds = new uint256[](activeCount);
        prices = new uint256[](activeCount);
        sellers = new address[](activeCount);

        // 填充数据
        uint256 index = 0;
        for (uint256 i = 0; i < allOrders.length; i++) {
            Order storage order = orders[allOrders[i]];
            if (order.active) {
                orderIds[index] = order.id;
                ticketIds[index] = order.ticketId;
                prices[index] = order.price;
                sellers[index] = order.seller;
                index++;
            }
        }

        return (orderIds, ticketIds, prices, sellers);
    }

    function helloworld() pure external returns(string memory) {
        return "hello world";
    }
}
