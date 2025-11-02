import { ethers } from "hardhat";

async function main() {
  console.log("⏰ Fast-forwarding blockchain time...\n");

  const addresses = require('../contract-addresses.json');
  const EasyBet = await ethers.getContractAt("EasyBet", addresses.EasyBet);

  // 获取活动信息
  const activityCount = await EasyBet.getActivityCount();
  if (activityCount.toNumber() === 0) {
    console.log("❌ No activities found.");
    return;
  }

  const activityId = activityCount.toNumber() - 1;
  const activity = await EasyBet.getActivity(activityId);

  console.log(`📊 Activity #${activityId}: ${activity.name}`);
  console.log(`Deadline: ${new Date(activity.deadline.toNumber() * 1000).toLocaleString()}`);

  // 获取当前区块时间
  const latestBlock = await ethers.provider.getBlock("latest");
  const currentTime = latestBlock.timestamp;
  const deadline = activity.deadline.toNumber();

  console.log(`\nCurrent blockchain time: ${new Date(currentTime * 1000).toLocaleString()}`);
  console.log(`Deadline: ${new Date(deadline * 1000).toLocaleString()}`);

  if (currentTime >= deadline) {
    console.log("\n✅ Activity already expired. You can settle now.");
    return;
  }

  const timeDiff = deadline - currentTime;
  console.log(`\n⏳ Need to advance: ${timeDiff} seconds (${(timeDiff / 3600).toFixed(2)} hours)`);

  // 推进时间
  console.log("\n🚀 Advancing blockchain time...");
  await ethers.provider.send("evm_increaseTime", [timeDiff + 60]); // 多推进60秒确保过期
  await ethers.provider.send("evm_mine", []); // 挖一个新块

  // 验证时间已推进
  const newBlock = await ethers.provider.getBlock("latest");
  const newTime = newBlock.timestamp;
  console.log(`\n✅ Time advanced!`);
  console.log(`New blockchain time: ${new Date(newTime * 1000).toLocaleString()}`);

  if (newTime >= deadline) {
    console.log("\n✅ Activity is now expired. You can settle it now!");
  } else {
    console.log("\n⚠️ Time not advanced enough. Try running again.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
