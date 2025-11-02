import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    ganache: {
      // Ganache GUI RPC URL - 根据你的Ganache实际端口调整
      url: 'http://127.0.0.1:8545',  // 如果是7545端口
      // Ganache GUI 的 Network ID
      chainId: 1337,  // 或者5777，根据Ganache显示
      gas: 12000000,  // 增加gas限制
      gasPrice: 20000000000,  // 20 gwei
      // 部署账户的私钥
      accounts: [
        '0x7e873a199ee061b5c85730f4dfea9b46da3bca3ba9b7cf7bc2adbbbd2796466b',
        '0xc104e7aada267cd2dbb640665317a7e9985a368db9d75b48b7d17afc770d59f9',
        '0x94a709db50ff1bc76fcd5e8c1595bec388e854d1f72a4f2eadeb8727eee6578c',
        '0x90b61e68d892a5daf96c922a4487dea4c9004eb69fc8f0795a440c65fb23cb52',
        '0x48df7d9f62bedec7e6f8f480ea49cd09f8ab07d0254c4c5a7c0e7cc484315254',
      ]
    },
  },
};

export default config;
