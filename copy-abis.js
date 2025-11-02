const fs = require('fs');
const path = require('path');

// 合约artifacts路径
const artifactsPath = path.join(__dirname, 'contracts/artifacts/contracts');
// 前端contracts目录
const frontendPath = path.join(__dirname, 'frontend/src/contracts');

// 确保前端目录存在
if (!fs.existsSync(frontendPath)) {
  fs.mkdirSync(frontendPath, { recursive: true });
}

// 要复制的合约
const contracts = ['BetToken', 'LotteryTicket', 'EasyBet'];

contracts.forEach(contractName => {
  const artifactPath = path.join(artifactsPath, `${contractName}.sol`, `${contractName}.json`);

  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    // 只保存ABI
    const abi = {
      contractName,
      abi: artifact.abi
    };

    const outputPath = path.join(frontendPath, `${contractName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(abi, null, 2));

    console.log(`✅ Copied ${contractName} ABI to frontend`);
  } else {
    console.log(`❌ ${contractName} artifact not found at ${artifactPath}`);
  }
});

console.log('\n✨ Contract ABIs copied successfully!');
