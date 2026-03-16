# Galaxy Discovery

Galaxy Discovery 是一个开放天文探索平台：用户在星图中观察恒星光变曲线，提交“可能存在行星”判断，系统基于多人协作自动识别潜在发现并生成研究报告。

## 当前架构

- `src/`: Vite + React 前端（可部署到 Vercel）
- `backend/main.py`: FastAPI 后端（可部署到 Render / Railway）
- `backend/galaxy.db`: SQLite 数据库（启动后自动创建）

## 功能状态（已实现）

1. ✅ 修复构建结构（仓库根目录可直接 `npm run build`）
2. ✅ 最小后端 API：
   - 获取恒星列表
   - 获取光变曲线
   - 提交用户判断
   - 查询协作验证结果
   - 生成研究报告
3. ✅ SQLite 数据表：
   - `users`
   - `stars`
   - `classifications`
   - `discoveries`
   - `reports`
4. ✅ 协作验证逻辑：3个不同用户将同一恒星标记为候选时，写入 `discoveries`
5. ✅ 匿名模式 + 简单登录（昵称/邮箱）
6. ✅ 保存用户探索记录（classifications）
7. ✅ 自动生成并保存研究报告历史

## 本地运行（最简单）

### 1) 启动后端

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2) 启动前端（新终端）

```bash
cd /workspace/galaxy-discovery
npm install
npm run dev
```

打开：`http://localhost:5173`

> 如果后端不是 8000 端口，请在前端启动前设置：
>
> ```bash
> export VITE_API_BASE_URL=http://localhost:你的端口
> ```

## API 设计（最小可用）

- `POST /api/auth/anonymous` 匿名进入
- `POST /api/auth/login` 昵称/邮箱登录
- `GET /api/stars` 恒星列表
- `GET /api/stars/{starId}/light-curve` 光变曲线
- `POST /api/classifications` 提交判断
- `GET /api/stars/{starId}/validation` 协作验证结果
- `POST /api/reports` 生成报告
- `GET /api/reports?userId=1` 报告历史

## 部署方案

### 前端（Vercel）

1. 将仓库推送到 GitHub。
2. 在 Vercel 导入项目。
3. 保持默认构建：`npm run build`。
4. 配置环境变量：
   - `VITE_API_BASE_URL=https://你的后端域名`
5. 点击 Deploy。

### 后端（Render / Railway）

- Runtime: Python
- Start command:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

- Root Directory 设置为 `backend`
- 自动安装 `requirements.txt`
- 首次启动会自动创建 `galaxy.db` 与模拟恒星数据

## 下一步建议（你只需要做这三步）

1. 先按“本地运行”把前后端都跑起来。
2. 用 3 个不同账号对同一颗星点击“可能有行星”，观察是否进入协作发现。
3. 生成研究报告，确认报告历史中能看到记录。
