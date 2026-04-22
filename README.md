# AI数据可视化平台 - 免费部署到 Render.com

## 📋 部署步骤（5分钟搞定，永久免费）

### 第一步：注册 GitHub 账号（如果还没有）
1. 打开 https://github.com/signup
2. 注册一个免费账号

### 第二步：注册 Render.com 账号
1. 打开 https://render.com/register
2. 点 **Sign up with GitHub**（用GitHub直接登录，最简单）

### 第三步：创建 GitHub 仓库
1. 打开 https://github.com/new
2. 仓库名填：`ai-dataviz`
3. 选择 **Public**（公开）
4. 点 **Create repository**
5. 上传本文件夹里的所有文件（直接把文件拖到页面上传）

### 第四步：在 Render 部署
1. 打开 https://dashboard.render.com
2. 点 **New** → **Web Service**
3. 连接你的 GitHub 仓库 `ai-dataviz`
4. 设置：
   - **Name**: `ai-dataviz`（会成为链接名）
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. 点 **Create Web Service**
6. 等待2-3分钟构建完成

### 第五步：获取永久链接
部署成功后，Render会给你一个链接，格式：
`https://ai-dataviz-xxxx.onrender.com`

这就是你的永久链接！任何人都可以访问！

---

## 🔗 链接分享

部署完成后，你可以：
- 直接把链接发给任何人
- 别人打开链接 → 注册账号 → 开始使用
- 图表分享功能也正常工作（分享链接会变成 `https://你的域名/share/xxxxx`）

---

## ⚠️ 免费版限制

| 项目 | 免费版 | 说明 |
|------|--------|------|
| 价格 | $0 | 完全免费 |
| 运行时间 | 750小时/月 | 约93%的时间在线 |
| 休眠 | 15分钟无活动后休眠 | 有人访问时自动唤醒，等30秒 |
| 存储 | 持久化 | 数据不会丢失 |
| HTTPS | 自动 | 有安全证书 |
| 自定义域名 | 支持 | 可以绑自己的域名 |

---

## 💡 唤醒加速技巧

免费版休眠后首次访问需要等30秒。可以设置外部监控每5分钟ping一次保持唤醒：
- 用 UptimeRobot (https://uptimerobot.com) 免费 ping
