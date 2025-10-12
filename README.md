# 小彩蝶劳动益美行评测 Web App

> 所有源代码与文档均使用 UTF-8 编码。

## 一、功能概览

- **学生/家长端**：欢迎动画、自评问卷、综合题、家长寄语、查看教师与 AI 评语。
- **教师端**：班级学生进度、实时锁定、批改问卷、模板化评语。
- **管理员端**：信息收集进度面板、三张折线图（劳动品质、参与率、习惯养成率）。
- **实时能力**：基于 WebSocket，教师端实时刷新，学生端即时获得锁定/改写提示。
- **一次性 LLM 评语**：支持对接 Qwen API，默认提供启发式本地生成。

## 二、环境准备

| 组件       | 版本建议 | 说明                                  |
| ---------- | -------- | ------------------------------------- |
| Python     | ≥ 3.10   | 建议通过 `python -m venv` 创建虚拟环境 |
| Node.js    | ≥ 18     | 自带 `npm`，用于前端依赖管理          |
| PostgreSQL | 15+      | 可本地安装或使用 Docker               |
| Redis      | 6+       | 用于会话校验与 WebSocket 消息推送     |

### 2.1 Docker 启动数据库（推荐）

```powershell
docker run -d --name butterfly-postgres -e POSTGRES_USER=butterfly -e POSTGRES_PASSWORD=butterfly -e POSTGRES_DB=butterfly -p 5432:5432 postgres:15
docker run -d --name butterfly-redis -p 6379:6379 redis:7-alpine
```

关闭容器：

```powershell
docker stop butterfly-postgres butterfly-redis
```

### 2.2 创建虚拟环境并安装依赖

```powershell
cd D:\butterfly
python -m venv .venv
.venv\Scripts\activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### 2.3 配置后端环境变量

```powershell
copy backend\.env.example backend\.env
# 若数据库或 Redis 地址与示例不同，请编辑 backend\.env
```

## 三、初始化数据库与样例数据

> 首次启动前务必完成建表和种子数据导入。

```powershell
cd D:\butterfly
.venv\Scripts\activate
python -m app.seed
```

脚本将：

1. 创建数据库表结构；
2. 导入低/中/高年级问卷、综合题配置；
3. 写入默认账号：
   - 管理员：`admin123 / admin123`
   - 教师：`T-earon11 … T-earon61`（密码 `test11 … test61`）
   - 学生：`earon1101 … earon6103`（密码 `test01 … test18`）

如需重新初始化，请清空数据库后再次执行。

## 四、启动后端（FastAPI）

```powershell
cd D:\butterfly
.venv\Scripts\activate
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

若 `uvicorn` 命令不可用，可使用：

```powershell
..\ .venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- 健康检查：<http://localhost:8000/health>
- OpenAPI 文档：<http://localhost:8000/api/openapi.json>

## 五、启动前端（Vite + React）

```powershell
cd D:\butterfly\frontend
copy .env.example .env
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

浏览器访问 <http://localhost:5173>。如端口被占用，可调整 `--port`，并同步修改 `.env` 中的 `VITE_API_BASE`。

## 六、使用指引

1. **学生/家长端**  
   - 登录后依次完成欢迎语、自评问卷、综合题、家长寄语；  
   - 若教师锁定或改写，页面将实时提示。
2. **教师端**  
   - 登录查看班级学生列表；  
   - 点选学生可改写问卷、提交模板化评语，并可锁定/解锁学生端；  
   - 改写后需点击“确认保存修改”。
3. **管理员端**  
   - 登录查看各班信息收集进度；  
   - 观察三张折线图了解劳动品质、参与率、习惯养成率的学段对比情况。

## 七、接入 Qwen API（可选）

如需调用通义千问，在 `backend/.env` 中追加：

```env
QWEN_API_BASE=https://dashscope.aliyuncs.com
QWEN_API_KEY=你的APIKey
QWEN_MODEL=qwen-max
```

重启后端后，首次生成 AI 评语将调用 Qwen，后续命中缓存直接返回。

## 八、排错建议

- **语法自检**：`python -m compileall backend/app`
- **端口占用**：调整前后端 `--port` 参数，浏览器地址同步修改。
- **字符乱码**：在 PowerShell 执行 `chcp 65001` 切换至 UTF-8。
- **多端登录冲突**：同账号新设备登录会强制旧会话退出，收到提示“检测到您在其他设备登陆，请重新登录”。
- **WebSocket 未刷新**：确认 Redis 与后端服务均已启动，并允许浏览器访问 `ws://`。

## 九、后续改进方向

- 引入 Alembic 进行数据库迁移管理；
- 新增 pytest / Playwright 等自动化测试覆盖核心流程；
- 针对不同学校定制主题皮肤与插画资源。
