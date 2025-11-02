import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Testing settlement function...\n");

  const [deployer] = await ethers.getSigners();

  // 获取合约地址
  const addresses = require('../contract-addresses.json');

  // 连接到已部署的合约
  const BetToken = await ethers.getContractAt("BetToken", addresses.BetToken);
  const EasyBet = await ethers.getContractAt("EasyBet", addresses.EasyBet);

  console.log("📋 Contract addresses:");
  console.log("BetToken:", addresses.BetToken);
  console.log("EasyBet:", addresses.EasyBet);
  console.log("\n");

  // 检查活动数量
  const activityCount = await EasyBet.getActivityCount();
  console.log(`Total activities: ${activityCount}`);

  if (activityCount.toNumber() === 0) {
    console.log("❌ No activities found. Please create an activity first.");
    return;
  }

  // 获取最新活动的信息
  const activityId = activityCount.toNumber() - 1;
  const activity = await EasyBet.getActivity(activityId);

  console.log(`\n📊 Activity #${activityId} Info:`);
  console.log("Name:", activity.name);
  console.log("Creator:", activity.creator);
  console.log("Choices:", activity.choices);
  console.log("Odds:", activity.odds.map((o: any) => o.toString()));
  console.log("Total Pool:", ethers.utils.formatEther(activity.totalPool), "BET");
  console.log("Deadline:", new Date(activity.deadline.toNumber() * 1000).toLocaleString());
  console.log("Settled:", activity.settled);

  // 检查是否已过期
  const now = Math.floor(Date.now() / 1000);
  const deadline = activity.deadline.toNumber();

  if (now < deadline) {
    console.log(`\n⚠️ Activity not expired yet. Time remaining: ${deadline - now} seconds`);
    console.log("Cannot settle until deadline passes.");
    return;
  }

  if (activity.settled) {
    console.log("\n✅ Activity already settled");
    console.log("Winning choice:", activity.winningChoice.toString());
    return;
  }

  // 检查每个选项的投注情况
  console.log("\n📈 Betting details:");
  for (let i = 0; i < activity.choices.length; i++) {
    const count = await EasyBet.getChoiceCount(activityId, i);
    const amount = await EasyBet.choiceAmounts(activityId, i);
    console.log(`Choice ${i} (${activity.choices[i]}):`);
    console.log(`  - Tickets: ${count}`);
    console.log(`  - Total bet: ${ethers.utils.formatEther(amount)} BET`);
  }

  // 检查合约余额
  const contractBalance = await BetToken.balanceOf(addresses.EasyBet);
  console.log(`\n💰 EasyBet contract BET balance: ${ethers.utils.formatEther(contractBalance)} BET`);
  console.log(`💰 Activity total pool: ${ethers.utils.formatEther(activity.totalPool)} BET`);

  if (contractBalance.lt(activity.totalPool)) {
    console.log("❌ ERROR: Contract balance is less than total pool!");
    console.log("This will cause settlement to fail.");
    return;
  }

  // 尝试估算结算gas
  console.log("\n🧪 Attempting to estimate settlement gas...");

  try {
    // 假设选择第一个选项获胜
    const winningChoice = 0;

    // 检查权限
    if (activity.creator.toLowerCase() !== deployer.address.toLowerCase()) {
      console.log(`❌ ERROR: You are not the activity creator.`);
      console.log(`Creator: ${activity.creator}`);
      console.log(`Your address: ${deployer.address}`);
      return;
    }

    const gasEstimate = await EasyBet.estimateGas.settleActivity(activityId, winningChoice);
    console.log(`✅ Gas estimate: ${gasEstimate.toString()}`);

    // 尝试执行结算
    console.log(`\n🚀 Attempting to settle with choice ${winningChoice}...`);
    const tx = await EasyBet.settleActivity(activityId, winningChoice);
    console.log("Transaction hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Settlement successful!");
    console.log("Gas used:", receipt.gasUsed.toString());

  } catch (error: any) {
    console.log("\n❌ Settlement failed!");
    console.log("Error:", error.message);

    if (error.error) {
      console.log("Detailed error:", error.error);
    }

    if (error.reason) {
      console.log("Reason:", error.reason);
    }

    // 尝试解析revert原因
    if (error.data) {
      console.log("Error data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
