# Knowledge 能力

Knowledge 用于管理仓库中的资料源和长期 Wiki。涉及当前仓库内容、路径、写入规则或项目目标时，必须以 Repository Context 和仓库 `AGENTS.md` 为准。

## 当前事实

- Knowledge 读取绑定仓库中的 `sources/`、`wiki/`、`wiki/index.md` 和 `wiki/log.md`。
- Knowledge Snapshot 会列出资料源、Wiki、索引入口、最近更新、Wiki 反链、相关事项和成果链接。
- Knowledge 页面提供搜索、资料阅读、Wiki 阅读、索引/日志查看和自动改写入口。
- 自动消化资料或改写 Wiki 通过 `knowledge_rewrite` ActionRun 发起；写入仓库前必须请求审批。

## 健康检查

Knowledge Snapshot 会基于当前仓库事实生成只读健康报告。第一片检查覆盖：

- 孤立资料：资料源没有出现在索引中，也没有被 Wiki 引用。
- 未进入索引的 Wiki：Wiki 页面存在，但没有出现在 `wiki/index.md`。
- 索引陈旧：`wiki/index.md` 指向不存在的资料源或 Wiki。
- 知识库内断链：Wiki 页面链接到不存在的资料源或 Wiki。
- 无来源引用 Wiki：Wiki 页面没有直接引用资料源，后续难以追溯事实来源。

这些问题会出现在 Knowledge 的“健康检查”视图，也会进入 Dashboard 的知识动态，并跳转到 `/knowledge?section=health`。

## 边界

健康检查只做可观测事实，不自动改写 Wiki、不更新索引、不删除资料、不写入 `reviews/weekly/`。如果需要修复，应发起 Knowledge ActionRun 或使用 Desktop repository tools，并在写入前请求审批。
