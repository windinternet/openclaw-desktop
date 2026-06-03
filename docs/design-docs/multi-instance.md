# 多实例管理

> 状态：活跃  
> 最新设计：`../superpowers/specs/2026-06-03-multi-instance-runtime-design.md`

OpenClaw Desktop 的实例切换只改变当前 UI 上下文，不中断其他实例的 Gateway 连接、
后台任务或事件处理。每个实例拥有独立运行时，后台完成事件会继续发送通知，并在实例抽屉
中展示未读关注状态和最近变化摘要。

完整的数据模型、连接生命周期、通知规则和测试策略见最新设计文档。
