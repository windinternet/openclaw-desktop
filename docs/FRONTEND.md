# 前端架构

> 最后更新: 2026-06-28
> 技术栈：React 18 + TypeScript + Vite + Electron + Semi Design

## 当前目录结构

```text
src/
├── App.tsx                  # HashRouter 路由注册
├── main.tsx                 # React 入口
├── components/              # 跨页面组件与功能组件
│   ├── charts/              # Dashboard 图表
│   ├── office/              # Three.js Office scene
│   └── ...
├── lib/                     # Gateway、store、repository、artifact、office、pet 等业务逻辑
├── pages/                   # 一级页面和 legacy/嵌入式页面
├── pet/                     # 桌宠独立渲染入口
├── prompts/                 # AI Action / Repository prompt 模板
├── locales/                 # i18n 文案
└── styles/
```

`electron/` 承载主进程、本地存储、Repository/Artifact IPC、桌宠窗口、日志与 preload bridge。

## 路由与导航

- `src/App.tsx` 注册实际路由。
- `src/lib/navigation.ts` 定义当前主导航：Dashboard、新会话、Workbench、Knowledge、Collaboration、Control Center。
- Search、Sessions、Artifacts、Tasks、Teams、Office、Extensions、Tuning、Repository Protocol 等旧入口仍保留为路由或嵌入页，但主心智入口已收敛到 6 个导航项。

## 状态管理

- `src/lib/store.ts` 是当前主要 Zustand store，管理多实例、Gateway 连接、会话、Agent、模型、Cron、工具、技能、插件、工作区、产物、Companion 与 Repository 同步。
- `src/lib/settings-store.ts` 管理主题、启动行为、默认首页、外链策略等本地设置。
- Repository、Artifact、Office、Pet 等能力拆在 `src/lib/*` 的纯逻辑模块中，并由页面/组件消费。

## 通信层

- **Gateway WebSocket**：`src/lib/gateway.ts` 负责连接、Challenge 签名、请求/响应、事件订阅和重连。
- **Desktop Bridge**：`src/lib/desktop-bridge.ts` 把 Desktop node commands 暴露给 Gateway 侧调用。
- **Electron IPC**：`electron/preload.ts` 暴露受控 API，`electron/*-handlers.ts` 实现本地文件、Git、产物和仓库操作。

## 3D 渲染

- 当前方案是 Three.js。
- `src/pages/Office3DPage.tsx` 读取 store 与设置。
- `src/components/office/OfficeScene.tsx` 管理 renderer、camera、scene、actors、动画与交互。
- `src/lib/office-*` 提供状态映射、布局、相机、音效、主题、画像和玩法逻辑。

## 测试与质量

- 当前已有 `src/__tests__/` 下 59 个测试文件。
- `npm test` 使用 Vitest。
- `npm run check` 组合执行 lint、format、stylelint。
- `npm run typecheck` 使用 `tsc --noEmit`。
- GitHub Actions 会跑质量、测试、构建和文档结构校验。

## 关键约束

- 智能体可读性优先。
- 新功能优先沿用现有页面、store、IPC 和纯逻辑模块边界。
- 排查真实 UI / DOM / 样式 / 滚动 / 接口数据问题时，优先用 Playwright CDP 探查运行态。
