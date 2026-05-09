# VideoCuts 批量混剪工具

基于 FFmpeg 的批量模板混剪工具。以"模板替换混剪"为核心流程——创建模板（定义段数、时长、转场序列），从素材库随机抽取视频自动适配填入，一键批量生成多个混剪结果。

## 功能特性

- **模板替换混剪** — 创建模板后，从素材库随机抽取视频，按模板定义的段长和转场自动适配、拼接
- **22 种转场预设** — fade、dissolve、flash-white、flash-black、wipe、circle-open、blur、pixelate、glitch、page-curl 等
- **逐段独立转场** — 每段可独立设置转场类型和时长，支持完整的转场序列
- **素材时长自适应** — 视频超过段长时自动截断尾部；视频不足段长时自动慢放填满（setpts 时间拉伸）
- **素材库管理** — 拖拽上传、自动提取缩略图、按类型筛选、一键删除
- **实时进度推送** — WebSocket 推送渲染进度，支持多结果同时预览和下载
- **批量生成** — 单次任务可生成 1-100 个混剪结果
- **BGM 混合** — 背景音乐自动混音，支持语音闪避（Ducking）
- **字幕支持** — 导入字幕文字（Excel/CSV），自动合成到视频
- **自由混剪模式** — 保留传统手动选段模式作为高级功能入口
- **本地/局域网访问** — 开发模式下支持同局域网设备访问

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| 后端 | Fastify + TypeScript + SQLite（better-sqlite3） |
| 渲染引擎 | FFmpeg（xfade 转场 + setpts 时间拉伸） |
| 实时通信 | @fastify/websocket |
| 媒体处理 | Sharp（生成缩略图） |

## 快速开始

### 前置要求

- Node.js >= 18
- FFmpeg 已安装并可命令行调用（或通过 `FFMPEG_PATH` 环境变量指定路径）
- npm（随 Node.js 一起安装）

### 安装

```bash
# 一键安装（推荐）
# 双击 install.bat 即可

# 或手动执行
npm install
cd server && npm install
cd ../client && npm install
```

### 启动开发模式

```bash
# 一键启动（推荐）
# 双击 start.bat 即可

# 或手动执行
npm run dev
```

启动后访问：

- **本地访问**：http://localhost:11451
- **局域网访问**：http://192.168.2.27:11451（将 IP 替换为实际地址）

> ⚠️ 局域网访问需要 Windows 防火墙放行端口 11451（首次连接时会自动弹出提示，或手动添加入站规则）。

### 生产构建

```bash
npm run build    # 构建前后端
npm run start    # 启动生产服务（端口 3001）
```

## 使用指南

### 1. 模板库（首页）

首页默认为模板库，展示所有已创建的模板。可执行以下操作：

- **新建模板** — 设定总段数和每段时长，为每段选择转场类型
- **替换生成** — 选择目标模板 → 设定生成数量 → 从素材库随机抽视频一键批量生成
- **编辑模板** — 修改模板名称、各段时长和转场配置
- **删除模板** — 移除不需要的模板

系统默认预设一个 16 秒模板（4 段 × 4 秒，转场序列：溶解 → 淡入淡出 → 溶解）。

### 2. 素材管理

上传和管理视频素材素材：

- 支持拖拽上传和点击选择文件
- 自动提取视频缩略图
- 按类型筛选显示
- 支持逐个或批量删除

### 3. 任务列表

查看所有渲染任务的执行状态：

- 实时进度条（WebSocket 推送）
- 渲染成功后可直接在线预览或下载文件
- 失败任务可查看具体错误原因
- 支持重试失败的渲染项

### 4. 高级模式

保留的自由混剪模式入口，适用于需要精细控制每段素材选段和排序的场景。

## 配置

### 环境变量

在根目录创建 `.env` 文件，或直接设置系统环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3001` | 后端服务端口 |
| `HOST` | `0.0.0.0` | 后端监听地址 |
| `FFMPEG_PATH` | `ffmpeg` | FFmpeg 可执行文件路径（含路径取文件名） |
| `FFPROBE_PATH` | `ffprobe` | FFprobe 可执行文件路径 |
| `VIDEO_CODEC` | `libx264` | 视频编码器（libx264 或 libx265） |
| `CRF` | `18` | CRF 质量控制值（越低质量越高，18-28 为常用范围） |

### 转场预设（22 种）

| 预设名 | 效果 | xfade 映射 |
|--------|------|------------|
| fade | 淡入淡出 | fade |
| dissolve | 交叉溶解 | fade |
| flash-white | 闪白 | fadewhite |
| flash-black | 闪黑 | fadeblack |
| wipe-left | 左划像 | wipeleft |
| wipe-right | 右划像 | wiperight |
| wipe-up | 上划像 | wipeup |
| wipe-down | 下划像 | wipedown |
| diagonal-cut | 对角切割 | diagtl |
| circle-open | 圆形展开 | radial |
| rect-mask | 矩形遮罩 | horzopen |
| zoom-punch | 缩放冲击 | smoothup |
| blur | 模糊过渡 | hblur |
| pixelate | 像素化 | pixelize |
| glitch | 故障效果 | pixelize |
| page-curl | 翻页卷角 | coverleft |
| blinds | 百叶窗 | horzopen |
| spin-in | 旋入 | smoothleft |
| spin-out | 旋出 | smoothright |
| shake-in | 震动入场 | distance |
| soft-light | 柔光 | fade |
| jump-cut | 跳切（极短时长） | fade |

## 项目结构

```
videocuts2/
├── client/                    # 前端（React + Vite）
│   ├── src/
│   │   ├── api/              # API 调用层（HTTP + WebSocket）
│   │   │   ├── client.ts     # HTTP 客户端封装
│   │   │   └── useSocket.ts  # WebSocket 实时通信
│   │   ├── components/       # UI 组件
│   │   │   ├── TemplateCard.tsx
│   │   │   ├── TemplateEditor.tsx
│   │   │   ├── GenerateDialog.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── VideoGrid.tsx
│   │   │   └── Layout.tsx
│   │   ├── pages/            # 路由页面
│   │   │   ├── HomePage.tsx        # 模板库（首页）
│   │   │   ├── TaskListPage.tsx    # 任务列表
│   │   │   ├── MaterialLibraryPage.tsx  # 素材管理
│   │   │   └── AdvancedPage.tsx    # 高级模式（自由混剪）
│   │   ├── store/            # Zustand 状态管理
│   │   ├── types/            # 类型定义
│   │   ├── App.tsx           # 主应用入口 + 路由
│   │   └── index.css         # Tailwind 全局样式
│   ├── vite.config.ts        # Vite 配置（端口 11451）
│   └── package.json
├── server/                    # 后端（Fastify）
│   ├── src/
│   │   ├── routes/           # API 路由
│   │   │   ├── templates.ts  # 模板 CRUD
│   │   │   ├── materials.ts  # 素材上传/管理
│   │   │   ├── tasks.ts      # 任务创建/管理
│   │   │   └── outputs.ts    # 输出文件服务
│   │   ├── services/         # 业务逻辑
│   │   │   ├── mixer.ts      # 混剪引擎（模板/自由双模式）
│   │   │   ├── ffmpeg.ts     # FFmpeg 封装（xfade/setpts/scale）
│   │   │   └── queue.ts      # FIFO 任务队列 + WebSocket 广播
│   │   ├── db.ts             # SQLite 数据库（模板/素材/任务）
│   │   ├── config.ts         # 服务端配置
│   │   ├── types.ts          # 全量类型定义
│   │   └── index.ts          # 服务入口
│   └── package.json
├── data/                      # 运行时数据（自动生成）
│   ├── uploads/              # 上传的素材文件
│   ├── outputs/              # 渲染输出结果
│   ├── cache/                # 中间文件缓存
│   └── db/                   # SQLite 数据库文件
├── install.bat               # 依赖安装脚本
├── start.bat                 # 开发模式启动脚本
├── package.json              # 根工程配置
└── tsconfig.base.json        # TypeScript 基础配置
```

## 开发说明

### 常用命令

```bash
npm run dev            # 同时启动前后端开发服务器
npm run dev:server     # 仅启动后端
npm run dev:client     # 仅启动前端
npm run build          # 构建前后端
npm run start          # 启动生产服务
```

### 端口分配

| 用途 | 开发模式 | 生产模式 |
|------|----------|----------|
| 前端界面 | 11451（Vite dev server） | 3001（Fastify 提供静态文件） |
| 后端 API | 3001 | 3001 |
| WebSocket | 通过 11451 代理转发 | 3001 |

### 数据库

SQLite 数据库文件位于 `data/db/videocuts.db`，包含以下核心表：

- `tasks` — 渲染任务
- `results` — 渲染结果
- `templates` — 混剪模板
- `template_segments` — 模板段落定义
- `materials` — 素材库

## License

本软件基于 **CC BY-NC-SA 4.0**（知识共享 署名-非商业性使用-相同方式共享 4.0 国际）协议发布。

您可以自由地：
- **共享** — 在任何媒介以任何形式复制、发行本作品
- **演绎** — 修改、转换或以本作品为基础进行创作

惟须遵守以下条件：
- **署名** — 必须提供适当的署名，提供指向本许可协议的链接，并标明是否对原始内容进行了修改
- **非商业性使用** — 不得将本作品用于商业目的
- **相同方式共享** — 如果对原作品进行了修改或基于本作品创作了派生作品，则必须以相同的许可协议发布

### 如果您想使用本项目进行商业运用，请联系15666835265@163.com或ninepoin4@gmail.com

详细条款请参阅 [LICENSE](./LICENSE) 文件或访问 https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh
