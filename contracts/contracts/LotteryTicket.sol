// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title LotteryTicket
 * @dev ERC721彩票凭证合约，每个Token代表一张彩票
 */
contract LotteryTicket is ERC721, ERC721URIStorage {
    // 主合约地址（只有主合约可以铸造彩票）
    address public easyBetContract;

    // Token计数器
    uint256 private _tokenIdCounter;

    // Token ID -> 活动ID
    mapping(uint256 => uint256) public tokenToActivity;

    // Token ID -> 选项索引
    mapping(uint256 => uint256) public tokenToChoice;

    // Token ID -> 购买价格
    mapping(uint256 => uint256) public tokenPrice;

    // Token ID -> 赔率（用基点表示，100 = 1.0倍，150 = 1.5倍，200 = 2.0倍）
    mapping(uint256 => uint256) public tokenOdds;

    // 事件
    event TicketMinted(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 indexed activityId,
        uint256 choice,
        uint256 price,
        uint256 odds
    );

    modifier onlyEasyBet() {
        require(msg.sender == easyBetContract, "Only EasyBet contract can call");
        _;
    }

    constructor() ERC721("Lottery Ticket", "TICKET") {
        _tokenIdCounter = 0;
    }

    /**
     * @dev 设置主合约地址（只能设置一次）
     */
    function setEasyBetContract(address _easyBetContract) external {
        require(easyBetContract == address(0), "Already set");
        require(_easyBetContract != address(0), "Invalid address");
        easyBetContract = _easyBetContract;
    }

    /**
     * @dev 铸造彩票（只能由主合约调用）
     */
    function mintTicket(
        address to,
        uint256 activityId,
        uint256 choice,
        uint256 price,
        uint256 odds
    ) external onlyEasyBet returns (uint256) {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(to, tokenId);

        tokenToActivity[tokenId] = activityId;
        tokenToChoice[tokenId] = choice;
        tokenPrice[tokenId] = price;
        tokenOdds[tokenId] = odds;

        emit TicketMinted(tokenId, to, activityId, choice, price, odds);

        return tokenId;
    }

    /**
     * @dev 获取彩票信息
     */
    function getTicketInfo(uint256 tokenId)
        external
        view
        returns (uint256 activityId, uint256 choice, uint256 price, uint256 odds, address owner)
    {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");

        return (
            tokenToActivity[tokenId],
            tokenToChoice[tokenId],
            tokenPrice[tokenId],
            tokenOdds[tokenId],
            ownerOf(tokenId)
        );
    }

    /**
     * @dev 批量获取用户拥有的彩票
     */
    function getTicketsByOwner(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tickets = new uint256[](balance);
        uint256 index = 0;

        for (uint256 i = 0; i < _tokenIdCounter; i++) {
            if (_ownerOf(i) != address(0) && ownerOf(i) == owner) {
                tickets[index] = i;
                index++;
                if (index == balance) break;
            }
        }

        return tickets;
    }

    // Override required functions
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
