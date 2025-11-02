# 使用Ganache GUI部署和运行EasyBet

本指南专门针对使用**Ganache图形化界面**的用户。

## 📋 准备工作

### 1. 启动Ganache GUI

1. 打开Ganache应用程序
2. 点击 **"QUICKSTART"** 快速启动
3. 记录以下信息：
   - **RPC SERVER**: 例如 `http://127.0.0.1:7545`
   - **NETWORK ID**: 例如 `5777` 或 `1337`
   - **端口号**: 通常是 `7545`

![Ganache主界面](https://i.imgur.com/example.png)

### 2. 获取账户私钥

在Ganache主界面（ACCOUNTS标签）：

1. 找到第一个账户（通常有100 ETH余额）
2. 点击账户右侧的 **🔑 钥匙图标**
3. 复制显示的 **Private Key**（以`0x`开头的64位十六进制字符串）

示例：`0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890`

**重要提示**：
- 私钥非常重要，不要分享给他人
- 建议复制前3-5个账户的私钥，方便测试多用户场景

## 🔧 配置Hardhat

### 步骤1：更新Hardhat配置

编辑 `contracts/hardhat.config.ts`：

```typescript
import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    ganache: {
      url: 'http://127.0.0.1:7545',  // 👈 Ganache GUI的RPC地址
      chainId: 1337,                  // 👈 根据你的Ganache实际Network ID调整
      accounts: [
        '0xYOUR_FIRST_ACCOUNT_PRIVATE_KEY',   // 👈 替换为你复制的私钥
        '0xYOUR_SECOND_ACCOUNT_PRIVATE_KEY',  // 可选：添加更多账户测试
        '0xYOUR_THIRD_ACCOUNT_PRIVATE_KEY',
      ]
    },
  },
};

export default config;
```

**配置说明**：
- `url`: 必须与Ganache显示的RPC SERVER完全一致
- `chainId`:
  - 如果Ganache显示Network ID是5777，就改为5777
  - 如果显示1337，保持1337不变
- `accounts`: 粘贴你从Ganache复制的私钥（保留`0x`前缀）

### 步骤2：测试连接

在 `contracts` 目录下运行：

```bash
cd contracts
npx hardhat console --network ganache
```

如果成功，会看到类似：
```
Welcome to Node.js v20.x.x.
Type ".help" for more information.
>
```

输入以下命令测试：
```javascript
> const accounts = await ethers.getSigners()
> accounts[0].address
```

应该显示Ganache第一个账户的地址。输入 `.exit` 退出。

## 🚀 部署合约

### 步骤1：编译合约

```bash
cd contracts
npm install          # 首次运行需要安装依赖
npx hardhat compile
```

成功后会看到：
```
Compiled 21 Solidity files successfully
```

### 步骤2：部署到Ganache

```bash
npx hardhat run scripts/deploy.ts --network ganache
```

**成功部署后**，会显示类似输出：
```
Starting deployment...

Deploying BetToken...
✅ BetToken deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3

Deploying EasyBet...
✅ EasyBet deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

✅ LotteryTicket deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

==================================================
📋 Deployment Summary:
==================================================
BetToken:       0x5FbDB2315678afecb367f032d93F642f64180aa3
EasyBet:        0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
LotteryTicket:  0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
==================================================

✅ Contract addresses saved to contract-addresses.json
```

**⚠️ 重要**：复制这三个合约地址，后面需要用到！

### 步骤3：在Ganache中验证部署

回到Ganache GUI：

1. 点击 **BLOCKS** 标签
   - 应该能看到新增的区块（3个区块，每个合约部署一个）

2. 点击 **TRANSACTIONS** 标签
   - 应该能看到3笔合约创建交易
   - 交易类型显示为 "CONTRACT CREATION"

3. 点击 **CONTRACTS** 标签（如果有）
   - 可以看到部署的合约地址

## 🔗 配置前端

### 步骤1：更新合约地址

编辑 `frontend/src/App.tsx`，找到第10-14行：

```typescript
const CONTRACT_ADDRESSES = {
  BetToken: '0x5FbDB2315678afecb367f032d93F642f64180aa3',      // 👈 替换为你的地址
  EasyBet: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',       // 👈 替换为你的地址
  LotteryTicket: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'  // 👈 替换为你的地址
};
```

### 步骤2：复制合约ABI

在项目根目录运行：

```bash
node copy-abis.js
```

应该看到：
```
✅ Copied BetToken ABI to frontend
✅ Copied LotteryTicket ABI to frontend
✅ Copied EasyBet ABI to frontend

✨ Contract ABIs copied successfully!
```

### 步骤3：启动前端

```bash
cd frontend
npm install    # 首次运行
npm start
```

浏览器会自动打开 `http://localhost:3000`

## 🦊 配置MetaMask

### 步骤1：添加Ganache网络

1. 打开MetaMask扩展
2. 点击顶部的网络下拉菜单
3. 点击 **"添加网络"** 或 **"Add Network"**
4. 点击 **"手动添加网络"** 或 **"Add a network manually"**

填写以下信息：

| 字段 | 值 |
|------|-----|
| **网络名称** | Ganache Local |
| **RPC URL** | `http://127.0.0.1:8545` |
| **链ID** | `1337` （或你的实际Network ID） |
| **货币符号** | ETH |
| **区块浏览器URL** | 留空 |

5. 点击 **"保存"**
6. 切换到刚添加的 "Ganache Local" 网络

### 步骤2：导入Ganache账户

**方法1：使用私钥导入**

1. 在MetaMask中点击右上角的圆形图标
2. 选择 **"导入账户"** 或 **"Import Account"**
3. 选择类型：**"私钥"**
4. 粘贴从Ganache复制的私钥
5. 点击 **"导入"**

**方法2：使用助记词导入（推荐）**

Ganache GUI通常不直接显示助记词，建议使用方法1。

### 步骤3：验证账户

导入后，你应该能在MetaMask中看到：
- 账户地址与Ganache中的账户匹配
- 余额显示约100 ETH

**建议**：导入2-3个Ganache账户，方便测试不同用户的交互。

## 🎮 测试应用

### 1. 连接钱包

1. 在浏览器中打开 `http://localhost:3000`
2. 点击 **"连接MetaMask钱包"**
3. MetaMask弹出，点击 **"下一步"** 和 **"连接"**
4. 页面应显示你的账户地址和余额

### 2. 领取BET Token

1. 点击 **"领取1000 BET Token"**
2. MetaMask弹出交易确认，点击 **"确认"**
3. 等待几秒，页面刷新显示新余额

**在Ganache中验证**：
- 切换到TRANSACTIONS标签
- 应该能看到一笔新的交易
- 点击交易查看详情

### 3. 创建竞猜活动

1. 填写表单：
   - 活动名称：`NBA总决赛`
   - 选项：`湖人,热火,勇士`
   - 奖池：`100`
   - 票价：`10`
   - 持续时间：`1`（小时）

2. 点击 **"创建活动"**

3. MetaMask会弹出**两次确认**：
   - 第一次：授权BET Token
   - 第二次：创建活动交易
   - 都点击 **"确认"**

4. 创建成功后，页面会显示新活动

**在Ganache中验证**：
- TRANSACTIONS标签应显示2笔新交易
- 第一个账户的ETH余额略有减少（gas费）

### 4. 测试购买彩票

1. 切换MetaMask到另一个导入的账户
2. 刷新页面，领取BET Token
3. 在活动列表中点击某个选项（如"湖人"）
4. 确认两次交易（approve + buyTicket）
5. 在"我的彩票"中查看购买的彩票

### 5. 测试彩票交易

**卖家挂单**：
1. 在"我的彩票"中找到彩票
2. 点击 **"挂单出售"**
3. 输入价格（如`15`）
4. 确认交易

**买家购买**：
1. 切换到另一个账户
2. 点击活动的 **"查看订单簿"**
3. 在订单列表中点击 **"购买"**
4. 确认两次交易

**在Ganache中验证**：
- 查看交易记录
- 彩票NFT的所有者应该已改变

## 🔍 常见问题排查

### 问题1: 部署失败 - "Error: Invalid JSON RPC response"

**原因**：Hardhat无法连接到Ganache

**解决方案**：
1. 确认Ganache GUI正在运行
2. 检查 `hardhat.config.ts` 中的URL是否正确（端口是7545）
3. 尝试重启Ganache

### 问题2: 部署失败 - "insufficient funds"

**原因**：账户ETH余额不足

**解决方案**：
1. 在Ganache中检查第一个账户是否有ETH
2. 确认配置文件中的私钥是否正确
3. 尝试重启Ganache（重置链状态）

### 问题3: MetaMask交易失败 - "Transaction underpriced"

**原因**：Ganache重启后nonce不匹配

**解决方案**：
1. 在MetaMask中点击账户头像
2. 进入 **设置 > 高级**
3. 点击 **"清除活动和随机数数据"**
4. 刷新页面重试

### 问题4: 前端显示"请安装MetaMask"

**原因**：MetaMask未连接到正确的网络

**解决方案**：
1. 确认MetaMask已切换到"Ganache Local"网络
2. 刷新页面
3. 重新点击"连接钱包"

### 问题5: Ganache显示Network ID与配置不匹配

**解决方案**：

**选项A - 修改Ganache配置**（推荐）：
1. 关闭当前Ganache workspace
2. 点击 "NEW WORKSPACE"
3. 在CHAIN标签中设置：
   - NETWORK ID: `1337`
   - PORT NUMBER: `7545`
4. 保存并启动

**选项B - 修改Hardhat配置**：
在 `hardhat.config.ts` 中将 `chainId` 改为Ganache显示的实际值。

## 📊 监控和调试

### 在Ganache中监控

1. **ACCOUNTS标签**：
   - 查看每个账户的ETH和Token余额
   - 交易计数

2. **BLOCKS标签**：
   - 查看区块生成情况
   - 每笔交易会生成一个新区块

3. **TRANSACTIONS标签**：
   - 查看所有交易历史
   - 点击交易查看详细信息（gas使用、状态等）
   - 红色表示交易失败

4. **EVENTS标签**：
   - 查看合约事件日志
   - 例如：TokensClaimed, ActivityCreated, TicketPurchased等

### 使用Hardhat Console调试

```bash
cd contracts
npx hardhat console --network ganache
```

测试合约：
```javascript
const BetToken = await ethers.getContractFactory("BetToken");
const betToken = BetToken.attach("0xYOUR_BETTOKEN_ADDRESS");

// 查询余额
const balance = await betToken.balanceOf("0xYOUR_ACCOUNT_ADDRESS");
console.log(ethers.utils.formatEther(balance));

// 查询活动数量
const EasyBet = await ethers.getContractFactory("EasyBet");
const easyBet = EasyBet.attach("0xYOUR_EASYBET_ADDRESS");
const count = await easyBet.getActivityCount();
console.log(count.toString());
```

## 🎯 完整测试流程

建议按以下顺序测试：

1. ✅ 部署合约到Ganache
2. ✅ 在Ganache中验证合约部署
3. ✅ 配置MetaMask并导入账户
4. ✅ 启动前端并连接钱包
5. ✅ 账户1：领取BET Token
6. ✅ 账户1（公证人）：创建竞猜活动
7. ✅ 账户2：领取BET Token
8. ✅ 账户2：购买彩票（选项A）
9. ✅ 账户3：领取BET Token
10. ✅ 账户3：购买彩票（选项B）
11. ✅ 账户2：挂单出售彩票
12. ✅ 账户3：查看订单簿并购买
13. ✅ 等待活动截止
14. ✅ 账户1（公证人）：公布结果并结算
15. ✅ 验证获胜者收到奖金

## 📝 提示和最佳实践

1. **保持Ganache运行**：部署后不要关闭Ganache，否则链数据会丢失

2. **保存workspace**：在Ganache中保存workspace，下次可以直接加载

3. **多账户测试**：至少导入3个账户到MetaMask，模拟真实场景

4. **Gas费用**：Ganache的gas价格很低，不用担心消耗

5. **重新部署**：如果需要重新部署：
   - 在Ganache中点击 🔄 重启按钮
   - 重新运行部署命令
   - 更新前端合约地址

6. **截图和录屏**：使用Ganache的可视化界面截图，展示交易和区块

## 🎬 提交材料准备

使用Ganache GUI的优势是可以清晰展示：

1. **合约部署截图**：
   - Ganache CONTRACTS标签显示已部署合约

2. **交易记录截图**：
   - TRANSACTIONS标签显示所有交易历史

3. **账户余额变化**：
   - ACCOUNTS标签显示余额变化（购买、结算后）

4. **区块生成**：
   - BLOCKS标签显示区块链增长

5. **事件日志**：
   - EVENTS标签显示合约事件

这些可视化内容非常适合放入演示视频和实验报告中。

## 🚀 完成！

现在你已经完全配置好了Ganache GUI环境，可以开始测试和演示你的EasyBet去中心化彩票系统了！

有任何问题随时查看此文档或询问助教。
