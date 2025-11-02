import { expect } from "chai";
import { ethers } from "hardhat";
import { BetToken, EasyBet, LotteryTicket } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("EasyBet - Odds System", function () {
  let betToken: BetToken;
  let easyBet: EasyBet;
  let lotteryTicket: LotteryTicket;
  let owner: SignerWithAddress;
  let player1: SignerWithAddress;
  let player2: SignerWithAddress;
  let player3: SignerWithAddress;

  beforeEach(async function () {
    [owner, player1, player2, player3] = await ethers.getSigners();

    // 部署 BetToken
    const BetTokenFactory = await ethers.getContractFactory("BetToken");
    betToken = await BetTokenFactory.deploy();
    await betToken.deployed();

    // 部署 EasyBet（会自动部署 LotteryTicket）
    const EasyBetFactory = await ethers.getContractFactory("EasyBet");
    easyBet = await EasyBetFactory.deploy(betToken.address);
    await easyBet.deployed();

    // 获取 LotteryTicket 合约
    const lotteryTicketAddress = await easyBet.lotteryTicket();
    lotteryTicket = await ethers.getContractAt("LotteryTicket", lotteryTicketAddress);

    // 给玩家领取 BET Token
    await betToken.connect(player1).claimTokens();
    await betToken.connect(player2).claimTokens();
    await betToken.connect(player3).claimTokens();
  });

  describe("创建活动（赔率制）", function () {
    it("应该能够创建带赔率的活动", async function () {
      const name = "世界杯决赛";
      const choices = ["阿根廷", "法国"];
      const odds = [150, 200]; // 1.5倍 和 2.0倍
      const duration = 3600; // 1小时

      await easyBet.createActivity(name, choices, odds, duration);

      const activity = await easyBet.getActivity(0);
      expect(activity.name).to.equal(name);
      expect(activity.choices).to.deep.equal(choices);
      expect(activity.odds[0]).to.equal(150);
      expect(activity.odds[1]).to.equal(200);
      expect(activity.totalPool).to.equal(0); // 初始对赌池为0
    });

    it("应该拒绝赔率和选项数量不匹配的活动", async function () {
      const name = "测试活动";
      const choices = ["A", "B"];
      const odds = [150]; // 只有一个赔率
      const duration = 3600;

      await expect(
        easyBet.createActivity(name, choices, odds, duration)
      ).to.be.revertedWith("Choices and odds length mismatch");
    });

    it("应该拒绝赔率低于100的活动", async function () {
      const name = "测试活动";
      const choices = ["A", "B"];
      const odds = [50, 150]; // 第一个赔率 < 100
      const duration = 3600;

      await expect(
        easyBet.createActivity(name, choices, odds, duration)
      ).to.be.revertedWith("Odds must be at least 100 (1.0x)");
    });
  });

  describe("购买彩票（任意金额）", function () {
    beforeEach(async function () {
      // 创建活动
      const name = "测试比赛";
      const choices = ["Team A", "Team B"];
      const odds = [150, 200];
      const duration = 3600;
      await easyBet.createActivity(name, choices, odds, duration);
    });

    it("玩家应该能够用任意金额购买彩票", async function () {
      const activityId = 0;
      const choice = 0;
      const amount = ethers.utils.parseEther("100");

      // 授权
      await betToken.connect(player1).approve(easyBet.address, amount);

      // 购买彩票
      await expect(easyBet.connect(player1).buyTicket(activityId, choice, amount))
        .to.emit(easyBet, "TicketPurchased");

      // 验证对赌池增加
      const activity = await easyBet.getActivity(activityId);
      expect(activity.totalPool).to.equal(amount);

      // 验证彩票信息
      const ticketInfo = await lotteryTicket.getTicketInfo(0);
      expect(ticketInfo.activityId).to.equal(activityId);
      expect(ticketInfo.choice).to.equal(choice);
      expect(ticketInfo.price).to.equal(amount);
      expect(ticketInfo.odds).to.equal(150); // 锁定的赔率
    });

    it("多个玩家应该能够投注不同金额", async function () {
      const activityId = 0;

      // Player1 投注 100 BET 到选项0
      await betToken.connect(player1).approve(easyBet.address, ethers.utils.parseEther("100"));
      await easyBet.connect(player1).buyTicket(activityId, 0, ethers.utils.parseEther("100"));

      // Player2 投注 200 BET 到选项1
      await betToken.connect(player2).approve(easyBet.address, ethers.utils.parseEther("200"));
      await easyBet.connect(player2).buyTicket(activityId, 1, ethers.utils.parseEther("200"));

      // Player3 投注 50 BET 到选项0
      await betToken.connect(player3).approve(easyBet.address, ethers.utils.parseEther("50"));
      await easyBet.connect(player3).buyTicket(activityId, 0, ethers.utils.parseEther("50"));

      // 验证对赌池
      const activity = await easyBet.getActivity(activityId);
      expect(activity.totalPool).to.equal(ethers.utils.parseEther("350"));
    });
  });

  describe("结算（全额支付）", function () {
    it("对赌池足够时应该全额支付", async function () {
      const activityId = 0;

      // 创建活动
      await easyBet.createActivity("测试", ["A", "B"], [150, 200], 3600); // 1小时后过期

      // Player1 投注 100 BET 到选项0（赔率1.5）- 应得 150 BET
      await betToken.connect(player1).approve(easyBet.address, ethers.utils.parseEther("100"));
      await easyBet.connect(player1).buyTicket(activityId, 0, ethers.utils.parseEther("100"));

      // Player2 投注 200 BET 到选项1（赔率2.0）
      await betToken.connect(player2).approve(easyBet.address, ethers.utils.parseEther("200"));
      await easyBet.connect(player2).buyTicket(activityId, 1, ethers.utils.parseEther("200"));

      // 总对赌池 = 300 BET
      // 如果选项0获胜，应付 = 100 * 1.5 = 150 BET
      // 对赌池足够，应该全额支付

      // 等待活动过期
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      // 记录结算前余额
      const beforeBalance = await betToken.balanceOf(player1.address);

      // 结算
      await easyBet.settleActivity(activityId, 0); // 选项0获胜

      // 验证player1收到全额奖金
      const afterBalance = await betToken.balanceOf(player1.address);
      const payout = afterBalance.sub(beforeBalance);
      expect(payout).to.equal(ethers.utils.parseEther("150"));
    });
  });

  describe("结算（比例分配）", function () {
    it("对赌池不足时应该按比例分配", async function () {
      const activityId = 0;

      // 创建活动
      await easyBet.createActivity("测试", ["A", "B"], [300, 150], 3600); // A赔率3.0，B赔率1.5

      // Player1 投注 100 BET 到选项0（赔率3.0）- 应得 300 BET
      await betToken.connect(player1).approve(easyBet.address, ethers.utils.parseEther("100"));
      await easyBet.connect(player1).buyTicket(activityId, 0, ethers.utils.parseEther("100"));

      // Player2 投注 100 BET 到选项0（赔率3.0）- 应得 300 BET
      await betToken.connect(player2).approve(easyBet.address, ethers.utils.parseEther("100"));
      await easyBet.connect(player2).buyTicket(activityId, 0, ethers.utils.parseEther("100"));

      // Player3 投注 100 BET 到选项1（赔率1.5）
      await betToken.connect(player3).approve(easyBet.address, ethers.utils.parseEther("100"));
      await easyBet.connect(player3).buyTicket(activityId, 1, ethers.utils.parseEther("100"));

      // 总对赌池 = 300 BET
      // 如果选项0获胜：
      //   总应付 = 100*3 + 100*3 = 600 BET
      //   但对赌池只有 300 BET
      //   应该按比例分配：每人实际获得 300 * (300/600) = 150 BET

      // 等待活动过期
      await ethers.provider.send("evm_increaseTime", [3601]);
      await ethers.provider.send("evm_mine", []);

      // 记录结算前余额
      const before1 = await betToken.balanceOf(player1.address);
      const before2 = await betToken.balanceOf(player2.address);

      // 结算
      await easyBet.settleActivity(activityId, 0); // 选项0获胜

      // 验证player1和player2各收到按比例分配的奖金
      const after1 = await betToken.balanceOf(player1.address);
      const after2 = await betToken.balanceOf(player2.address);

      const payout1 = after1.sub(before1);
      const payout2 = after2.sub(before2);

      // 应该接近150 BET（可能有微小的舍入误差）
      expect(payout1).to.be.closeTo(ethers.utils.parseEther("150"), ethers.utils.parseEther("1"));
      expect(payout2).to.be.closeTo(ethers.utils.parseEther("150"), ethers.utils.parseEther("1"));
    });
  });

  describe("订单簿（含赔率转移）", function () {
    it("彩票交易应该保留原始赔率", async function () {
      const activityId = 0;

      // 创建活动
      await easyBet.createActivity("测试", ["A", "B"], [150, 200], 3600);

      // Player1 购买彩票
      await betToken.connect(player1).approve(easyBet.address, ethers.utils.parseEther("100"));
      await easyBet.connect(player1).buyTicket(activityId, 0, ethers.utils.parseEther("100"));

      const ticketId = 0;

      // Player1 创建订单
      await lotteryTicket.connect(player1).approve(easyBet.address, ticketId);
      await easyBet.connect(player1).createOrder(ticketId, ethers.utils.parseEther("120"));

      // Player2 购买订单
      await betToken.connect(player2).approve(easyBet.address, ethers.utils.parseEther("120"));
      await easyBet.connect(player2).fillOrder(0);

      // 验证彩票已转移给player2
      expect(await lotteryTicket.ownerOf(ticketId)).to.equal(player2.address);

      // 验证彩票信息保持不变（包括赔率）
      const ticketInfo = await lotteryTicket.getTicketInfo(ticketId);
      expect(ticketInfo.price).to.equal(ethers.utils.parseEther("100")); // 原始投注金额
      expect(ticketInfo.odds).to.equal(150); // 锁定的赔率
    });
  });
});
