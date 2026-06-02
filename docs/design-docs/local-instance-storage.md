# 本地实例存储设计

> 决定日期: 2026-06-02
> 适用范围: OpenClaw Desktop 的全局设置、实例索引、实例级扩展数据与 UI 缓存

## 背景

OpenClaw Desktop 的定位不是只连接一个 Gateway 的轻量控制台，而是面向多个 OpenClaw 实例的易用客户端和扩展客户端。每个实例都可能拥有独立的看板、扩展配置、草稿、缓存、用户画像、助手展示信息和未来的本地索引，因此本地存储必须按实例隔离，并能承载持续增长的数据量。

旧实现把实例配置、token、用户画像和 UI 状态混在渲染进程 `localStorage` 中，无法满足容量、隔离、迁移和安全要求。

## 核心原则

1. **响应式内存层是 UI 状态源**  
   组件订阅 Zustand 或 React state。任何用户操作先更新内存状态，让引用方立即重新渲染。

2. **文件系统是持久化后端**  
   Electron 主进程把数据写入 `app.getPath('userData')/storage`。磁盘 IO 是异步副作用，不阻塞 UI 更新。

3. **渲染进程不直接访问文件系统**  
   渲染进程通过 `window.electronAPI.storage` 调用受控 IPC。主进程负责路径、schema、原子写入和实例目录隔离。

4. **实例数据必须命名空间化**  
   与某个 OpenClaw Gateway 绑定的数据都放在 `instances/<instanceId>/` 下，禁止使用全局 key 混存。

5. **Gateway 仍是远端事实源**  
   Desktop 缓存用于启动体验、断连展示、UI 扩展和本地增强。连接恢复后仍应刷新 Gateway 状态。

## 存储布局

```text
userData/
  storage/
    app.json
    instances.json
    instances/
      <instanceId>/
        metadata.json
        credential.json
        kanban.json
        ai-action-runs.json
        agent-team-profile.json
        office-profile.json
        office-layout-instructions.json
```

当前文件职责：

| 文件 | 职责 |
|------|------|
| `app.json` | schemaVersion、当前实例 id、全局设置 |
| `instances.json` | 实例索引和非敏感摘要 |
| `metadata.json` | 助手名、头像、Gateway 用户画像等实例元数据 |
| `credential.json` | 当前短期保存 token；后续应替换为系统密钥链 |
| `kanban.json` | 当前实例的本地看板 |
| `ai-action-runs.json` | AI Action Center 的动作记录、状态、计划、审批和对应 Gateway session/run 映射 |
| `agent-team-profile.json` | Agent 团队的本地扩展画像、虚拟公司角色资料和自然语言编排记录 |
| `office-profile.json` | 3D 办公室展示资料，如公司名、前台问候语等 |
| `office-layout-instructions.json` | 未来自然语言调整办公室布局的指令记录和应用结果 |

## 数据流

```text
应用启动
  -> local-persistence.loadAppSnapshot()
  -> Electron IPC storage:loadAppState
  -> hydrate useSettingsStore / useStore
  -> React 渲染

用户修改设置或实例数据
  -> Zustand/React state 立即 set
  -> UI 订阅方自动更新
  -> local-persistence 异步调用 IPC
  -> 主进程原子写入 JSON 文件
```

实例级页面（如看板）在 `currentInstanceId` 变化时重新 hydrate 对应文件，保存时使用 `saveInstanceData(instanceId, key, value)`。页面内 state 仍是交互期间的响应式源。

## 错误恢复策略

本地文件存储必须把启动期并发写和文件缺失视为正常情况处理：

- **读失败 fallback**：文件不存在、JSON 解析失败或首次启动时，主进程返回调用方提供的默认值，不阻塞 UI 启动。
- **唯一临时文件**：每次写入使用 `pid + randomUUID` 生成独立 `.tmp` 文件，避免同一毫秒内并发写复用临时文件名。
- **同文件串行队列**：对同一个 JSON 文件的读改写按文件路径排队，避免 `settings` 和 `currentInstanceId` 并发保存时互相覆盖。
- **原子替换**：先写完整临时文件，再 `rename` 到目标文件，减少半写入 JSON 被读取的概率。
- **渲染进程容错**：运行期保存是异步副作用；保存失败只记录非敏感 warning，不能打断 Zustand / React state 的响应式更新。

## 迁移策略

首次启动时，`local-persistence` 会读取旧的 `localStorage` key：

- `openclaw-settings`
- `openclaw-instances`
- `openclaw-current-instance`

如果 Electron 文件存储为空，则迁移旧数据到文件存储。迁移成功后清理旧 key，避免 token 继续留在渲染进程可读的 `localStorage`。

## 安全说明

当前重构先把凭证从渲染进程 `localStorage` 移到主进程受控文件中，降低暴露面。`credential.json` 仍不是最终凭证方案，下一阶段应接入系统密钥链或加密存储，并让实例索引只保留非敏感摘要。

## 后续扩展

新增实例级本地数据时：

1. 在主进程存储服务中登记允许的 data key。
2. 使用 `loadInstanceData` / `saveInstanceData` 读写。
3. 保持 UI 内存状态响应式，不能让组件直接依赖文件读取结果作为唯一状态。
4. 如数据来自 Gateway，连接恢复后必须刷新远端事实源。
