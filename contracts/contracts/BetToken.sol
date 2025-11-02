// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title BetToken
 * @dev ERC20积分合约，用户可以免费领取积分用于购买彩票
 */
contract BetToken is ERC20 {
    // 每次领取的积分数量
    uint256 public constant CLAIM_AMOUNT = 1000 * 10**18; // 1000 tokens

    // 领取冷却时间（24小时）
    uint256 public constant CLAIM_COOLDOWN = 1 days;

    // 记录用户上次领取的时间
    mapping(address => uint256) public lastClaimTime;

    // 事件
    event TokensClaimed(address indexed user, uint256 amount, uint256 timestamp);

    constructor() ERC20("Bet Token", "BET") {
        // 初始给合约部署者一些代币用于测试
        _mint(msg.sender, 10000 * 10**18);
    }

    /**
     * @dev 用户领取免费积分
     */
    function claimTokens() external {
        // 如果是第一次领取（lastClaimTime为0），允许立即领取
        if (lastClaimTime[msg.sender] != 0) {
            require(
                block.timestamp >= lastClaimTime[msg.sender] + CLAIM_COOLDOWN,
                "Claim cooldown not expired"
            );
        }

        lastClaimTime[msg.sender] = block.timestamp;
        _mint(msg.sender, CLAIM_AMOUNT);

        emit TokensClaimed(msg.sender, CLAIM_AMOUNT, block.timestamp);
    }

    /**
     * @dev 检查用户是否可以领取积分
     */
    function canClaim(address user) external view returns (bool) {
        // 新用户（从未领取过）可以立即领取
        if (lastClaimTime[user] == 0) {
            return true;
        }
        return block.timestamp >= lastClaimTime[user] + CLAIM_COOLDOWN;
    }

    /**
     * @dev 获取距离下次可领取的剩余时间（秒）
     */
    function getTimeUntilNextClaim(address user) external view returns (uint256) {
        uint256 nextClaimTime = lastClaimTime[user] + CLAIM_COOLDOWN;
        if (block.timestamp >= nextClaimTime) {
            return 0;
        }
        return nextClaimTime - block.timestamp;
    }
}
