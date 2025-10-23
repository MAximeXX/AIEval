# 小彩蝶劳动益美行评测 Web App

> 全部源代码与文档均使用 UTF-8 编码；请确保编辑器与终端均以 UTF-8 读取。

## 1. 项目概览

| 角色 | 主要页面与能力 |
| ---- | --------------- |
| 学生/家长 | 欢迎页、劳动自评问卷、综合题、家长寄语、教师评价、AI 智能综评；支持锁定提示、未保存离开提醒 |
| 教师 | 班级进度面板、关键词评价、问卷改写、综合题调整、学生锁定/解锁、学生详情页、AI 智能综评 |
| 管理员 | 班级信息收集汇总、三张趋势折线图、学生详情总览（展示与教师/学生端一致的劳动问卷、家长评价、教师评价与智能综评） |
| 实时能力 | 通过 WebSocket 实时通知教师端刷新、学生端同步锁定状态 |
| AI 智能综评 | 首次由任意角色触发时会调用 LLM（接入 Qwen）；生成结果写入数据库后，所有角色再次访问均直接使用缓存 |

## 2. 环境准备

| 组件 | 版本建议 | 说明 |
| ---- | -------- | ---- |
| Python | ≥ 3.10 | 建议使用 `python -m venv` 创建虚拟环境 |
| Node.js | ≥ 18 | 自带 `npm`，用于构建前端 |
| PostgreSQL | 15+ | 可本地安装或使用 Docker |
| Redis | 6+ | 存储会话、锁定状态、WS 订阅等 |

### 2.1 使用 Docker 启动依赖（推荐）

```powershell
docker run -d --name butterfly-postgres -e POSTGRES_USER=butterfly -e POSTGRES_PASSWORD=butterfly -e POSTGRES_DB=butterfly -p 5432:5432 postgres:15
docker run -d --name butterfly-redis -p 6379:6379 redis:7-alpine
```

停止服务：
```powershell
docker stop butterfly-postgres butterfly-redis
```

### 2.2 Python 依赖

```powershell
cd D:\butterfly
python -m venv .venv
.\.venv\Scripts\activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### 2.3 复制后端配置

```powershell
copy backend\.env.example backend\.env
# 如数据库或 Redis 地址不同，请编辑 backend\.env
```

## 3. 初始化数据库与样例数据

> 首次启动或重置后务必执行此步骤。

```powershell
cd D:\butterfly
.\.venv\Scripts\activate
python backend/app/seed.py
```

脚本会：
1. 创建数据库所有表结构；
2. 导入低/中/高年级问卷及综合题配置；
3. 根据 `test.csv` 生成教师/学生账号，并创建默认管理员账号  

### 3.1 清空数据库后重新来过（可选）

```powershell
# 先连到系统库，再 drop/create
docker exec -it butterfly-postgres psql -U butterfly -d postgres -c "DROP DATABASE IF EXISTS butterfly;"
docker exec -it butterfly-postgres psql -U butterfly -d postgres -c "CREATE DATABASE butterfly;"

# 如需清空 Redis
docker exec -it butterfly-redis redis-cli FLUSHALL
```
然后再次运行 `python backend/app/seed.py`。

## 4. 启动后端（FastAPI）

```powershell
cd D:\butterfly
.\.venv\Scripts\activate
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
若 `uvicorn` 未加入 PATH，可使用 `..\ .venv\Scripts\python.exe -m uvicorn ...`。

- 健康检查：<http://localhost:8000/health>  
- OpenAPI 文档：<http://localhost:8000/api/openapi.json>

## 5. 启动前端（Vite + React）

```powershell
cd D:\butterfly\frontend
copy .env.example .env
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

浏览器访问 <http://localhost:5173>。若端口冲突，可调整 `--port` 并同步更新 `.env` 中的 `VITE_API_BASE`。

## 6. 角色使用说明

### 6.1 学生/家长端
- 登录后依次完成欢迎页 → 劳动自评问卷 → 综合题 → 家长寄语；
- 页面会监听教师锁定事件，锁定后禁止修改；
- 离开页面前若存在未保存内容会弹出确认；
- 首次生成智能综评会触发 LLM，之后重复访问使用缓存。

### 6.2 教师端
- 班级进度面板实时展示每位学生的填写状态、关键词评价状态、完成情况；
- 学生详情可代为修改问卷、调整综合题、提交关键词评价并锁定学生；
- 任何角色首次请求智能综评都会生成并缓存，教师端支持强制刷新。

### 6.3 管理员端
- 首页展示各班收集进度与三张折线图（劳动品质、参与率、习惯养成率）；
- 点击班级展示学生列表，支持在弹出层中直接跳转学生详情；
- 学生详情复刻教师端布局（含表头、排版、首行缩进等样式），显示问卷、家长/教师评价、智能综评；
- 智能综评逻辑与其他角色一致：数据库已有内容则直接展示，否则首次访问触发生成；当问卷/教师评价不完整时显示 “暂无智能综评”。

## 7. 接入通义千问

```env
QWEN_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_API_KEY=your_api_key
QWEN_MODEL=qwen-max
```

重启后端后，`LlmService.generate_once` 会在数据库无缓存时向 Qwen 发出请求，并缓存返回结果。

## 8. 常见问题

- **端口占用**：更改前后端 `--port` 后刷新浏览器并更新 `.env`。  
- **字符显示异常**：在 PowerShell 中执行 `chcp 65001` 或确保编辑器使用 UTF-8。  
- **多端登录冲突**：新设备登录会使旧设备的会话 ID 失效并提示重新登录。  
- **WebSocket 无提示**：确认 Redis / 后端已启动，并允许浏览器访问 `ws://`。  
- **智能综评反复生成**：只要数据库中 `llm_evals` 已存在指定学生记录，所有角色都会复用，不会重复调用 LLM。

