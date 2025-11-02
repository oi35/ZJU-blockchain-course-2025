import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("EasyBet System", function () {
  // 部署合约的fixture
  async function deployEasyBetFixture() {
    const [owner, notary, player1, player2, player3] = await ethers.getSigners();

    // 部署 BetToken
    const BetToken = await ethers.getContractFactory("BetToken");
    const betToken = await BetToken.deploy();

    // 部署 EasyBet
    const EasyBet = await ethers.getContractFactory("EasyBet");
    const easyBet = await EasyBet.deploy(betToken.address);

    // 获取 LotteryTicket 地址
    const lotteryTicketAddress = await easyBet.lotteryTicket();
    const LotteryTicket = await ethers.getContractFactory("LotteryTicket");
    const lotteryTicket = LotteryTicket.attach(lotteryTicketAddress);

    return { betToken, easyBet, lotteryTicket, owner, notary, player1, player2, player3 };
  }

  describe("BetToken", function () {
    it("Should allow users to claim tokens", async function () {
      const { betToken, player1 } = await loadFixture(deployEasyBetFixture);

      // 玩家1领取代币
      await betToken.connect(player1).claimTokens();
      const balance = await betToken.balanceOf(player1.address);

      expect(balance).to.equal(ethers.utils.parseEther("1000"));
    });

    it("Should prevent claiming before cooldown expires", async function () {
      const { betToken, player1 } = await loadFixture(deployEasyBetFixture);

      await betToken.connect(player1).claimTokens();
      await expect(betToken.connect(player1).claimTokens()).to.be.revertedWith(
        "Claim cooldown not expired"
      );
    });

    it("Should check if user can claim", async function () {
      const { betToken, player1 } = await loadFixture(deployEasyBetFixture);

      expect(await betToken.canClaim(player1.address)).to.be.true;
      await betToken.connect(player1).claimTokens();
      expect(await betToken.canClaim(player1.address)).to.be.false;
    });
  });

  describe("Activity Creation", function () {
    it("Should create an activity successfully", async function () {
      const { betToken, easyBet, notary } = await loadFixture(deployEasyBetFixture);

      // 公证人领取代币
      await betToken.connect(notary).claimTokens();
      const prizePool = ethers.utils.parseEther("100");
      const ticketPrice = ethers.utils.parseEther("10");

      // 授权
      await betToken.connect(notary).approve(easyBet.address, prizePool);

      // 创建活动
      const choices = ["Team A", "Team B", "Draw"];
      const duration = 7 * 24 * 60 * 60; // 7 days

      await expect(
        easyBet.connect(notary).createActivity("NBA Finals", choices, prizePool, ticketPrice, duration)
      ).to.emit(easyBet, "ActivityCreated");

      // 验证活动信息
      const activity = await easyBet.getActivity(0);
      expect(activity.name).to.equal("NBA Finals");
      expect(activity.choices.length).to.equal(3);
      expect(activity.prizePool).to.equal(prizePool);
    });

    it("Should fail if prize pool is zero", async function () {
      const { easyBet, notary } = await loadFixture(deployEasyBetFixture);

      await expect(
        easyBet.connect(notary).createActivity("Test", ["A", "B"], 0, 10, 86400)
      ).to.be.revertedWith("Prize pool must be positive");
    });
  });

  describe("Ticket Purchase", function () {
    it("Should allow player to buy ticket", async function () {
      const { betToken, easyBet, lotteryTicket, notary, player1 } = await loadFixture(deployEasyBetFixture);

      // 准备活动
      await betToken.connect(notary).claimTokens();
      const prizePool = ethers.utils.parseEther("100");
      const ticketPrice = ethers.utils.parseEther("10");
      await betToken.connect(notary).approve(easyBet.address, prizePool);
      await easyBet.connect(notary).createActivity("Test", ["A", "B"], prizePool, ticketPrice, 86400);

      // 玩家购买彩票
      await betToken.connect(player1).claimTokens();
      await betToken.connect(player1).approve(easyBet.address, ticketPrice);

      await expect(easyBet.connect(player1).buyTicket(0, 0))
        .to.emit(easyBet, "TicketPurchased")
        .and.to.emit(lotteryTicket, "TicketMinted");

      // 验证彩票所有权
      expect(await lotteryTicket.ownerOf(0)).to.equal(player1.address);

      // 验证彩票信息
      const ticketInfo = await lotteryTicket.getTicketInfo(0);
      expect(ticketInfo.activityId).to.equal(0);
      expect(ticketInfo.choice).to.equal(0);
    });

    it("Should increase prize pool when ticket is purchased", async function () {
      const { betToken, easyBet, notary, player1 } = await loadFixture(deployEasyBetFixture);

      await betToken.connect(notary).claimTokens();
      const prizePool = ethers.utils.parseEther("100");
      const ticketPrice = ethers.utils.parseEther("10");
      await betToken.connect(notary).approve(easyBet.address, prizePool);
      await easyBet.connect(notary).createActivity("Test", ["A", "B"], prizePool, ticketPrice, 86400);

      await betToken.connect(player1).claimTokens();
      await betToken.connect(player1).approve(easyBet.address, ticketPrice);
      await easyBet.connect(player1).buyTicket(0, 0);

      const activity = await easyBet.getActivity(0);
      expect(activity.prizePool).to.equal(prizePool.add(ticketPrice));
    });
  });

  describe("Order Book", function () {
    it("Should create sell order", async function () {
      const { betToken, easyBet, lotteryTicket, notary, player1 } = await loadFixture(deployEasyBetFixture);

      // 准备并购买彩票
      await betToken.connect(notary).claimTokens();
      await betToken.connect(notary).approve(easyBet.address, ethers.utils.parseEther("100"));
      await easyBet.connect(notary).createActivity("Test", ["A", "B"], ethers.utils.parseEther("100"), ethers.utils.parseEther("10"), 86400);

      await betToken.connect(player1).claimTokens();
      await betToken.connect(player1).approve(easyBet.address, ethers.utils.parseEther("10"));
      await easyBet.connect(player1).buyTicket(0, 0);

      // 授权并创建订单
      await lotteryTicket.connect(player1).approve(easyBet.address, 0);
      const sellPrice = ethers.utils.parseEther("15");

      await expect(easyBet.connect(player1).createOrder(0, sellPrice))
        .to.emit(easyBet, "OrderCreated")
        .withArgs(0, 0, player1.address, sellPrice);
    });

    it("Should fill order successfully", async function () {
      const { betToken, easyBet, lotteryTicket, notary, player1, player2 } = await loadFixture(deployEasyBetFixture);

      // 准备活动和彩票
      await betToken.connect(notary).claimTokens();
      await betToken.connect(notary).approve(easyBet.address, ethers.utils.parseEther("100"));
      await easyBet.connect(notary).createActivity("Test", ["A", "B"], ethers.utils.parseEther("100"), ethers.utils.parseEther("10"), 86400);

      await betToken.connect(player1).claimTokens();
      await betToken.connect(player1).approve(easyBet.address, ethers.utils.parseEther("10"));
      await easyBet.connect(player1).buyTicket(0, 0);

      // 创建订单
      await lotteryTicket.connect(player1).approve(easyBet.address, 0);
      const sellPrice = ethers.utils.parseEther("15");
      await easyBet.connect(player1).createOrder(0, sellPrice);

      // Player2购买
      await betToken.connect(player2).claimTokens();
      await betToken.connect(player2).approve(easyBet.address, sellPrice);

      await expect(easyBet.connect(player2).fillOrder(0))
        .to.emit(easyBet, "OrderFilled")
        .withArgs(0, 0, player2.address, player1.address, sellPrice);

      // 验证NFT所有权转移
      expect(await lotteryTicket.ownerOf(0)).to.equal(player2.address);
    });

    it("Should cancel order", async function () {
      const { betToken, easyBet, lotteryTicket, notary, player1 } = await loadFixture(deployEasyBetFixture);

      // 准备
      await betToken.connect(notary).claimTokens();
      await betToken.connect(notary).approve(easyBet.address, ethers.utils.parseEther("100"));
      await easyBet.connect(notary).createActivity("Test", ["A", "B"], ethers.utils.parseEther("100"), ethers.utils.parseEther("10"), 86400);

      await betToken.connect(player1).claimTokens();
      await betToken.connect(player1).approve(easyBet.address, ethers.utils.parseEther("10"));
      await easyBet.connect(player1).buyTicket(0, 0);

      await lotteryTicket.connect(player1).approve(easyBet.address, 0);
      await easyBet.connect(player1).createOrder(0, ethers.utils.parseEther("15"));

      // 取消订单
      await expect(easyBet.connect(player1).cancelOrder(0))
        .to.emit(easyBet, "OrderCancelled")
        .withArgs(0);

      const order = await easyBet.orders(0);
      expect(order.active).to.be.false;
    });
  });

  describe("Settlement", function () {
    it("Should settle activity and distribute prizes", async function () {
      const { betToken, easyBet, notary, player1, player2, player3 } = await loadFixture(deployEasyBetFixture);

      // 创建活动（持续时间足够长）
      await betToken.connect(notary).claimTokens();
      const prizePool = ethers.utils.parseEther("100");
      const ticketPrice = ethers.utils.parseEther("10");
      await betToken.connect(notary).approve(easyBet.address, prizePool);
      await easyBet.connect(notary).createActivity("Test", ["A", "B"], prizePool, ticketPrice, 3600); // 1小时

      // 三个玩家购买彩票
      for (const player of [player1, player2, player3]) {
        await betToken.connect(player).claimTokens();
        await betToken.connect(player).approve(easyBet.address, ticketPrice);
      }

      await easyBet.connect(player1).buyTicket(0, 0); // 选择A
      await easyBet.connect(player2).buyTicket(0, 0); // 选择A
      await easyBet.connect(player3).buyTicket(0, 1); // 选择B

      // 等待活动过期
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      // 公证人结算，选择A获胜
      const balanceBefore1 = await betToken.balanceOf(player1.address);
      const balanceBefore2 = await betToken.balanceOf(player2.address);

      await expect(easyBet.connect(notary).settleActivity(0, 0))
        .to.emit(easyBet, "ActivitySettled");

      // 验证奖金分配（100 + 30 = 130，两个获胜者，每人65）
      const expectedPrize = ethers.utils.parseEther("65");
      const balanceAfter1 = await betToken.balanceOf(player1.address);
      const balanceAfter2 = await betToken.balanceOf(player2.address);

      expect(balanceAfter1.sub(balanceBefore1)).to.equal(expectedPrize);
      expect(balanceAfter2.sub(balanceBefore2)).to.equal(expectedPrize);
    });

    it("Should only allow creator to settle", async function () {
      const { betToken, easyBet, notary, player1 } = await loadFixture(deployEasyBetFixture);

      await betToken.connect(notary).claimTokens();
      await betToken.connect(notary).approve(easyBet.address, ethers.utils.parseEther("100"));
      await easyBet.connect(notary).createActivity("Test", ["A", "B"], ethers.utils.parseEther("100"), ethers.utils.parseEther("10"), 100);

      await ethers.provider.send("evm_increaseTime", [101]);
      await ethers.provider.send("evm_mine", []);

      await expect(
        easyBet.connect(player1).settleActivity(0, 0)
      ).to.be.revertedWith("Only creator can settle");
    });
  });

  describe("View Functions", function () {
    it("Should get activity count", async function () {
      const { betToken, easyBet, notary } = await loadFixture(deployEasyBetFixture);

      expect(await easyBet.getActivityCount()).to.equal(0);

      await betToken.connect(notary).claimTokens();
      await betToken.connect(notary).approve(easyBet.address, ethers.utils.parseEther("100"));
      await easyBet.connect(notary).createActivity("Test", ["A", "B"], ethers.utils.parseEther("100"), ethers.utils.parseEther("10"), 86400);

      expect(await easyBet.getActivityCount()).to.equal(1);
    });

    it("Should get order book", async function () {
      const { betToken, easyBet, lotteryTicket, notary, player1 } = await loadFixture(deployEasyBetFixture);

      // 准备
      await betToken.connect(notary).claimTokens();
      await betToken.connect(notary).approve(easyBet.address, ethers.utils.parseEther("100"));
      await easyBet.connect(notary).createActivity("Test", ["A", "B"], ethers.utils.parseEther("100"), ethers.utils.parseEther("10"), 86400);

      await betToken.connect(player1).claimTokens();
      await betToken.connect(player1).approve(easyBet.address, ethers.utils.parseEther("10"));
      await easyBet.connect(player1).buyTicket(0, 0);

      await lotteryTicket.connect(player1).approve(easyBet.address, 0);
      await easyBet.connect(player1).createOrder(0, ethers.utils.parseEther("15"));

      // 获取订单簿
      const orderBook = await easyBet.getOrderBook(0);
      expect(orderBook.orderIds.length).to.equal(1);
      expect(orderBook.prices[0]).to.equal(ethers.utils.parseEther("15"));
    });
  });
});
