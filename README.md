# EasyBet - 去中心化彩票系统

浙江大学区块链课程项目 - 进阶去中心化彩票系统

## 项目概述

EasyBet 是一个基于以太坊的去中心化彩票系统，支持竞猜活动创建、彩票购买、彩票交易和结算功能。

### 核心功能

1. **ERC20积分系统**：用户可以领取BET Token作为彩票购买的货币
2. **ERC721彩票凭证**：每张彩票都是一个NFT
3. **创建竞猜活动**：公证人可以创建多选项的竞猜活动
4. **购买彩票**：玩家使用BET Token购买彩票
5. **链上订单簿**：玩家之间可以交易彩票（挂单、撤单、购买）
6. **结果公布与结算**：公证人公布结果，获胜者根据彩票金额与赔率获得奖金

### 技术栈

**智能合约**：
- Solidity 0.8.20
- Hardhat 开发框架
- OpenZeppelin 合约库（ERC20, ERC721）

**前端**：
- React 19 + TypeScript
- ethers.js 5.7
- MetaMask 钱包集成

## 如何运行

### 1. 启动 Ganache

首先确保安装了 Ganache（本地区块链）。

```bash
# 启动 Ganache GUI 或使用命令行
ganache-cli
```

默认配置：
- RPC Server: http://127.0.0.1:8545
- Network ID: 1337

### 2. 安装合约依赖并编译

```bash
cd contracts
npm install
npx hardhat compile
```

### 3. 部署合约到 Ganache

```bash
npx hardhat run scripts/deploy.ts --network ganache
```

部署成功后，会显示三个合约地址：
- BetToken
- EasyBet
- LotteryTicket

**重要**：复制这些地址，需要更新到前端配置中。

### 4. 更新前端合约地址

编辑 `frontend/src/App.tsx` 文件，将第10-14行的合约地址替换为部署后的实际地址：

```typescript
const CONTRACT_ADDRESSES = {
  BetToken: '0x...', // 替换为实际地址
  EasyBet: '0x...',
  LotteryTicket: '0x...'
};
```

### 5. 复制合约ABI到前端

```bash
cd ..  # 回到项目根目录
node copy-abis.js
```

### 6. 安装前端依赖

```bash
cd frontend
npm install
```

### 7. 启动前端

```bash
npm start
```

浏览器会自动打开 http://localhost:3000

### 8. 配置 MetaMask

1. 打开 MetaMask 扩展
2. 添加自定义网络：
   - Network Name: Ganache
   - RPC URL: http://127.0.0.1:8545
   - Chain ID: 1337
   - Currency Symbol: ETH

3. 导入 Ganache 账户：
   - 从 Ganache 复制私钥
   - 在 MetaMask 中导入账户

4. 连接到网站

## 功能实现分析

### 1. ERC20积分合约（BetToken.sol）

**实现功能**：
- 用户可以免费领取1000 BET Token
- 领取间隔24小时（防止滥用）
- 标准ERC20功能（transfer, approve, balanceOf等）

**关键代码**：
```solidity
function claimTokens() external {
    require(
        block.timestamp >= lastClaimTime[msg.sender] + CLAIM_COOLDOWN,
        "Claim cooldown not expired"
    );
    lastClaimTime[msg.sender] = block.timestamp;
    _mint(msg.sender, CLAIM_AMOUNT);
}
```

### 2. ERC721彩票凭证（LotteryTicket.sol）

**实现功能**：
- 每张彩票是一个NFT
- 记录彩票的活动ID、选择、价格
- 只有EasyBet合约可以铸造彩票
- 支持查询用户拥有的所有彩票

**关键代码**：
```solidity
function mintTicket(
    address to,
    uint256 activityId,
    uint256 choice,
    uint256 price
) external onlyEasyBet returns (uint256) {
    uint256 tokenId = _tokenIdCounter;
    _tokenIdCounter++;
    _safeMint(to, tokenId);
    // 记录彩票信息
    tokenToActivity[tokenId] = activityId;
    tokenToChoice[tokenId] = choice;
    tokenPrice[tokenId] = price;
    return tokenId;
}
```

### 3. 主合约（EasyBet.sol）

#### 3.1 创建竞猜活动

公证人可以创建竞猜活动，需要提供奖池资金。

```solidity
function createActivity(
    string memory name,
    string[] memory choices,
    uint256 prizePool,
    uint256 ticketPrice,
    uint256 duration
) external returns (uint256) {
    // 从公证人账户转移奖池资金
    require(
        betToken.transferFrom(msg.sender, address(this), prizePool),
        "Prize pool transfer failed"
    );
    // 创建活动记录
    // ...
}
```

#### 3.2 购买彩票

玩家使用BET Token购买彩票，获得ERC721 NFT作为凭证。

```solidity
function buyTicket(uint256 activityId, uint256 choice) external returns (uint256) {
    Activity storage activity = activities[activityId];
    // 验证活动状态
    require(block.timestamp < activity.deadline, "Activity expired");
    require(!activity.settled, "Activity already settled");

    // 扣除BET Token
    require(
        betToken.transferFrom(msg.sender, address(this), activity.ticketPrice),
        "Payment failed"
    );

    // 增加奖池
    activity.prizePool += activity.ticketPrice;

    // 铸造彩票NFT
    uint256 ticketId = lotteryTicket.mintTicket(
        msg.sender, activityId, choice, activity.ticketPrice
    );

    // 记录购买信息（用于结算）
    activityChoiceBuyers[activityId][choice].push(msg.sender);

    return ticketId;
}
```

#### 3.3 链上订单簿

实现了完整的订单簿系统，支持挂单、撤单、购买。

**创建订单**：
```solidity
function createOrder(uint256 ticketId, uint256 price) external returns (uint256) {
    require(lotteryTicket.ownerOf(ticketId) == msg.sender, "Not ticket owner");

    uint256 orderId = _orderIdCounter++;
    orders[orderId] = Order({
        id: orderId,
        seller: msg.sender,
        ticketId: ticketId,
        price: price,
        active: true,
        createdAt: block.timestamp
    });

    activityOrders[activityId].push(orderId);
    return orderId;
}
```

**购买订单**：
```solidity
function fillOrder(uint256 orderId) external {
    Order storage order = orders[orderId];
    require(order.active, "Order not active");

    // 买家支付BET Token给卖家
    require(
        betToken.transferFrom(msg.sender, order.seller, order.price),
        "Payment failed"
    );

    // 转移彩票NFT
    lotteryTicket.transferFrom(order.seller, msg.sender, order.ticketId);

    order.active = false;
}
```

**获取订单簿**：
```solidity
function getOrderBook(uint256 activityId) external view returns (
    uint256[] memory orderIds,
    uint256[] memory ticketIds,
    uint256[] memory prices,
    address[] memory sellers
) {
    // 返回活动的所有有效订单
    // ...
}
```

#### 3.4 结果公布与结算

公证人公布结果后，自动将奖池平分给获胜者。

```solidity
function settleActivity(uint256 activityId, uint256 winningChoice) external {
    Activity storage activity = activities[activityId];
    require(activity.creator == msg.sender, "Only creator can settle");
    require(block.timestamp >= activity.deadline, "Activity not expired yet");
    require(!activity.settled, "Already settled");

    activity.settled = true;
    activity.winningChoice = winningChoice;

    // 获取获胜者列表
    address[] storage winners = activityChoiceBuyers[activityId][winningChoice];
    uint256 totalWinners = winners.length;

    if (totalWinners > 0) {
        uint256 prizePerWinner = activity.prizePool / totalWinners;
        // 分发奖金
        for (uint256 i = 0; i < totalWinners; i++) {
            betToken.transfer(winners[i], prizePerWinner);
        }
    } else {
        // 没有获胜者，退还给公证人
        betToken.transfer(activity.creator, activity.prizePool);
    }
}
```

### 4. 前端实现

#### 4.1 钱包连接

使用ethers.js连接MetaMask钱包：

```typescript
const connectWallet = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const address = await signer.getAddress();

    // 初始化合约实例
    const betToken = new ethers.Contract(CONTRACT_ADDRESSES.BetToken, BetTokenABI.abi, signer);
    const easyBet = new ethers.Contract(CONTRACT_ADDRESSES.EasyBet, EasyBetABI.abi, signer);
    const lotteryTicket = new ethers.Contract(CONTRACT_ADDRESSES.LotteryTicket, LotteryTicketABI.abi, signer);
};
```

#### 4.2 数据加载

从区块链加载活动列表、用户彩票等数据：

```typescript
const loadUserData = async (betToken, easyBet, lotteryTicket, address) => {
    // 获取BET余额
    const balance = await betToken.balanceOf(address);

    // 获取所有活动
    const activityCount = await easyBet.getActivityCount();
    for (let i = 0; i < activityCount; i++) {
        const activity = await easyBet.getActivity(i);
        // 处理活动数据
    }

    // 获取用户彩票
    const tickets = await lotteryTicket.getTicketsByOwner(address);
};
```

#### 4.3 交易处理

所有涉及ERC20的操作都需要先approve：

```typescript
const buyTicket = async (activityId, choice) => {
    // 1. Approve ERC20
    const approveTx = await betTokenContract.approve(
        CONTRACT_ADDRESSES.EasyBet,
        price
    );
    await approveTx.wait();

    // 2. 购买彩票
    const tx = await easyBetContract.buyTicket(activityId, choice);
    await tx.wait();

    // 3. 刷新数据
    loadUserData(...);
};
```

## 合约测试

项目包含完整的测试用例（14个测试全部通过）：

```bash
cd contracts
npx hardhat test
```

测试覆盖：
- ✓ BET Token领取功能
- ✓ 活动创建
- ✓ 彩票购买
- ✓ 订单簿（创建、购买、取消）
- ✓ 活动结算和奖金分配
- ✓ 权限控制

## 项目结构

```
ZJU-blockchain-course-2025/
├── contracts/                 # 智能合约
│   ├── contracts/
│   │   ├── BetToken.sol      # ERC20积分合约
│   │   ├── LotteryTicket.sol # ERC721彩票合约
│   │   └── EasyBet.sol       # 主合约
│   ├── scripts/
│   │   └── deploy.ts         # 部署脚本
│   ├── test/
│   │   └── testEasyBet.ts    # 测试文件
│   └── hardhat.config.ts     # Hardhat配置
├── frontend/                  # 前端应用
│   ├── src/
│   │   ├── contracts/        # 合约ABI
│   │   ├── App.tsx           # 主应用
│   │   └── App.css           # 样式
│   └── package.json
├── copy-abis.js              # ABI复制脚本
└── README.md                 # 本文档
```

## 功能演示流程

### 1. 公证人创建活动

1. 连接MetaMask钱包
2. 领取BET Token（如余额不足）
3. 填写活动信息：
   - 活动名称：例如 "NBA总冠军"
   - 选项：例如 "湖人,热火,勇士"
   - 奖池：例如 100 BET
   - 票价：例如 10 BET
   - 持续时间：例如 24 小时
4. 点击"创建活动"，MetaMask会弹出两次确认（approve和create）

### 2. 玩家购买彩票

1. 在活动列表中找到想参与的活动
2. 点击对应的选项按钮（例如"湖人"）
3. MetaMask确认交易（approve + buyTicket）
4. 在"我的彩票"中查看已购买的彩票

### 3. 彩票交易

#### 卖家挂单：
1. 在"我的彩票"中找到要出售的彩票
2. 点击"挂单出售"
3. 输入出售价格（例如 15 BET）
4. 确认交易

#### 买家购买：
1. 点击活动的"查看订单簿"
2. 在订单簿中找到想购买的彩票
3. 点击"购买"按钮
4. 确认交易

### 4. 公证人结算

1. 等待活动截止时间到期
2. 在活动卡片中选择获胜选项
3. 点击"结算"按钮
4. 确认交易
5. 获胜者自动获得奖金

## 技术亮点

### 1. 完整的ERC20+ERC721集成

- 使用ERC20作为交易货币
- 使用ERC721作为彩票凭证
- 合约之间的安全交互

### 2. 链上订单簿

- 完全去中心化的订单簿
- 支持挂单、撤单、购买
- 实时查询有效订单

### 3. 公平的结算机制

- 所有购买者记录在链上
- 自动计算奖金分配
- 防止重复结算

### 4. 用户友好的界面

- 响应式设计
- 实时数据更新
- 清晰的交易反馈

## 常见问题

### Q: MetaMask交易失败？

A: 检查以下几点：
1. 是否连接到正确的网络（Ganache）
2. BET余额是否充足
3. 是否已approve足够的额度
4. 活动是否已截止或已结算

### Q: 看不到我的彩票？

A: 确保：
1. 交易已确认
2. 刷新页面重新加载数据
3. 使用正确的账户

### Q: 如何测试结算功能？

A: 创建活动时设置较短的持续时间（例如0.01小时），或在Ganache中手动增加时间。

## 参考资料

- OpenZeppelin合约库：https://docs.openzeppelin.com/contracts/
- Hardhat文档：https://hardhat.org/
- ethers.js文档：https://docs.ethers.io/v5/
- 课程Demo：https://github.com/LBruyne/blockchain-course-demos

## 作者

浙江大学区块链课程 2025
