# OpenClaw Desktop — 项目知识库

**生成时间：** 2026-05-20
**提交：** 04d26b7
**分支：** main

## 概述
Electron 桌面客户端，用于连接 OpenClaw Agent 网关。React 18 + TypeScript 5 + Vite 6 + Electron 33，UI 组件库使用 Semi Design。

## 目录结构
```
openclaw-desktop/
├── electron/
│   ├── main.ts          # Electron 主进程（窗口创建、生命周期）
│   └── preload.ts       # 上下文桥接（暴露 platform/versions）
├── src/
│   ├── main.tsx         # React 渲染入口
│   ├── App.tsx          # 根组件（Layout + Nav 侧边栏路由）
│   ├── vite-env.d.ts    # Window.electronAPI 类型声明
│   └── components/
│       ├── ChatView.tsx       # 会话界面（占位）
│       └── WelcomeView.tsx    # 欢迎/连接页
├── index.html           # Vite HTML 入口
├── vite.config.ts       # Vite + Electron 插件配置
├── tsconfig.json        # TypeScript 配置
└── package.json         # 依赖与脚本
```

## 查哪
| 任务 | 位置 | 备注 |
|------|------|------|
| Electron 窗口配置 | `electron/main.ts` | `createWindow()` 函数 |
| IPC 桥接 API | `electron/preload.ts` | `contextBridge.exposeInMainWorld` |
| 页内路由（侧边栏切换） | `src/App.tsx` | `activeTab` / `showWelcome` state |
| 聊天消息结构 | `src/components/ChatView.tsx` | `Message` interface |
| 页面状态管理 | `src/App.tsx` | 无路由库，纯 `useState` 驱动 |

## 约定
- **无分号**：源码全部省略分号
- **单引号**：字符串使用单引号
- **default export**：组件使用 `export default function`
- **Function 声明**：组件用 `function` 关键字，不用箭头函数
- **Semi Design API**：优先使用 `Layout.Sider` + `Nav` 做侧边栏导航
- **Global CSS**：无 CSS Modules，样式通过 Semi CSS 变量和内联 style

## 禁止事项（本项目）
- **DO NOT** 关闭 `contextIsolation` 或启用 `nodeIntegration`（`electron/main.ts`）
- **DO NOT** 在 preload 中写业务逻辑，仅暴露 IPC 桥接
- **DO NOT** 使用 `npm`（应使用 `yarn`）。当前两个 lockfile 并存，选择 yarn 后删除 `package-lock.json`
- **DO NOT** 使用 `any` 类型（tsconfig `strict: true`）
- **DO NOT** 提交 `dist-electron/`、`release/`、`node_modules/`
- **DO NOT** 在 `electron/preload.ts` 中直接传递不可序列化的对象

## 命令
```bash
# 开发（Electron + Vite 热重载）
yarn dev

# 类型检查
npx tsc --noEmit

# 生产构建（渲染进程）
yarn build

# 打包为桌面安装包
yarn electron:build
```

## 备注
- **Lockfile 冲突**：仓库同时存在 `package-lock.json`（npm）和 `yarn.lock`（yarn），需二选一。推荐锁定 yarn。
- **无 lint/format**：未配置 ESLint、Prettier、stylelint。公司规范要求添加后需补充。
- **无测试**：零测试基础设施，后续引入推荐 vitest + @testing-library/react。
- **无 CI**：无 GitHub Actions 或其他 CI 配置。
- **无状态管理库**：当前仅用 React `useState`，无 Pinia/Redux/Zustand。
- **TypeScript include 仅含 `src/`**：`electron/` 目录由 `vite-plugin-electron` 单独编译，IDE 可能对该目录无类型检查。
- **自定义标题栏**：`titleBarStyle: 'hidden'` + macOS overlay（`electron/main.ts`），Windows/Linux 需额外处理。
