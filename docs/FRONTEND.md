# 前端架构

> 技术栈：React + TypeScript + Vite + Electron

## 目录结构

```
src/
├── App.tsx                  # 主布局
├── main.tsx                 # React 入口
├── components/
│   ├── chat/               # 会话相关
│   ├── sidebar/            # 侧边栏导航
│   ├── dashboard/          # 首页
│   ├── kanban/             # 看板
│   ├── settings/           # 设置
│   ├── connection-wizard/  # 连接向导
│   └── ui/                 # 基础 UI 组件
├── lib/
│   ├── gateway.ts          # Gateway WS/HTTP 协议
│   ├── store.ts            # Zustand 状态管理
│   └── utils.ts            # 工具函数
└── styles/
```

## 状态管理

- **Zustand** 管理全局状态
- 每个模块独立 store：`useChatStore`、`useKanbanStore`、`useInstanceStore`

## 通信层

- **Gateway WebSocket**：与 OpenClaw Gateway 实时通信
- 连接握手：Challenge 签名鉴权
- 断线自动重连（静默+UI 提示）

## 3D 渲染

- 方案待定（Three.js / Babylon.js）
- 用于第 9 模块：3D 虚拟办公室

## 关键约束

- 智能体可读性优先
- 组件按功能模块拆分，不按类型拆分
- 每个模块有明确边界，依赖方向单向
