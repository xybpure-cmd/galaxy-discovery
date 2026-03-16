# Galaxy Discovery

一个开放给所有人使用的游戏化天文探索系统。用户可以在银河星图中自由探索恒星，观察光变曲线，判断是否可能存在行星，并生成研究报告。

## 项目结构

```text
Galaxy-Discovery/
├── index.html               # 入口 HTML
├── package.json             # 依赖与脚本
├── src/
│   ├── main.jsx             # React 入口
│   ├── App.jsx              # 核心应用逻辑
│   └── styles.css           # 全局样式
└── README.md                # 使用说明
```

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 一分钟上线到一个网址（Vercel）

1. 把整个文件夹上传到 GitHub 仓库。
2. 打开 Vercel，新建项目。
3. 选择你的 GitHub 仓库并导入。
4. Vercel 会自动识别为 Vite/React 项目。
5. 点击 Deploy，几分钟内会得到一个公开网址。

## 下一步建议

第一阶段先部署当前版本，让用户可以直接体验。
第二阶段再逐步把内置恒星数据替换为真实天文数据。
