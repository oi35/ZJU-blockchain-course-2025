import { ethers } from "hardhat";

async function main() {
  console.log("Starting deployment...\n");

  // 1. 部署 BetToken
  console.log("Deploying BetToken...");
  const BetToken = await ethers.getContractFactory("BetToken");
  const betToken = await BetToken.deploy();
  await betToken.deployed();
  console.log(`✅ BetToken deployed to: ${betToken.address}\n`);

  // 2. 部署 EasyBet（会自动创建 LotteryTicket）
  console.log("Deploying EasyBet...");
  const EasyBet = await ethers.getContractFactory("EasyBet");
  const easyBet = await EasyBet.deploy(betToken.address);
  await easyBet.deployed();
  console.log(`✅ EasyBet deployed to: ${easyBet.address}\n`);

  // 3. 获取 LotteryTicket 地址
  const lotteryTicketAddress = await easyBet.lotteryTicket();
  console.log(`✅ LotteryTicket deployed to: ${lotteryTicketAddress}\n`);

  // 打印所有合约地址
  console.log("=".repeat(50));
  console.log("📋 Deployment Summary:");
  console.log("=".repeat(50));
  console.log(`BetToken:       ${betToken.address}`);
  console.log(`EasyBet:        ${easyBet.address}`);
  console.log(`LotteryTicket:  ${lotteryTicketAddress}`);
  console.log("=".repeat(50));

  // 保存合约地址到文件供前端使用
  const fs = require("fs");
  const contractAddresses = {
    BetToken: betToken.address,
    EasyBet: easyBet.address,
    LotteryTicket: lotteryTicketAddress,
  };

  fs.writeFileSync(
    "contract-addresses.json",
    JSON.stringify(contractAddresses, null, 2)
  );
  console.log("\n✅ Contract addresses saved to contract-addresses.json");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
