# Knowledge 能力

Knowledge 用于管理仓库中的资料源和长期 Wiki。涉及当前仓库内容、路径、写入规则或项目目标时，必须以 Repository Context 和仓库 `AGENTS.md` 为准。

## 当前事实

- Knowledge 读取绑定仓库中的 `sources/`、`wiki/`、`wiki/index.md` 和 `wiki/log.md`。
- Knowledge Snapshot 会列出资料源、Wiki、索引入口、最近更新、Wiki 反链、相关事项和成果链接。
- Knowledge Snapshot 会计算未消化资料队列：资料源没有出现在索引中，也没有被 Wiki 引用时，会进入队列。
- Knowledge 页面提供“导入文本”入口，会把粘贴的原始资料写入 `sources/imported/`，并刷新未消化资料队列。
- Knowledge 页面提供“导入文件”和“导入文件夹”入口，也支持拖拽导入本地 Markdown / TXT 文本文件，写入 `sources/imported/` 并刷新未消化资料队列。
- Knowledge 页面提供“剪藏 URL”入口，会把网页链接和可选摘录/备注写入 `sources/imported/`，并刷新未消化资料队列。
- Knowledge 页面提供搜索、资料阅读、Wiki 阅读、索引/日志查看和自动改写入口。
- Knowledge 健康检查会同时扫描 `work/active/`、`work/someday/` 和 `reviews/weekly/`，标出长期没有近期复盘引用的工作事项。
- Knowledge 健康检查视图提供“写入周复盘”入口，会把当前健康报告写入 `reviews/weekly/YYYY-MM-DD-knowledge-health.md`。
- 自动消化资料或改写 Wiki 通过 `knowledge_rewrite` ActionRun 发起；写入仓库前必须请求审批。

## 导入文本

用户可以在 Knowledge 页面点击“导入文本”，粘贴会议记录、想法、网页摘录或其他原始资料。Desktop 会生成 Markdown 资料源，写入当前绑定仓库的 `sources/imported/` 目录，frontmatter 标记 `source: desktop-paste` 和导入时间。

导入成功后，Knowledge 会刷新 Snapshot、切到“未消化资料”视图，并打开刚导入的资料源。该导入只保存原始资料，不自动生成 Wiki、不更新 `wiki/index.md`、不写入 `wiki/log.md`；后续消化仍应通过 `knowledge_rewrite` ActionRun 走计划和审批。

## 导入文件

用户可以在 Knowledge 页面点击“导入文件”，通过系统文件选择器选择 Markdown 或 TXT 文本文件；也可以直接把 Markdown / TXT 文件拖拽到 Knowledge 页面完成拖拽导入。Desktop 会读取文件文本，生成 Markdown 资料源，写入当前绑定仓库的 `sources/imported/` 目录，frontmatter 标记 `source: desktop-file`、原始文件名、MIME 类型和导入时间。

导入成功后，Knowledge 会刷新 Snapshot、切到“未消化资料”视图，并打开最后一个导入的资料源。当前文件导入只覆盖浏览器可读取的文本文件，不做 Office/PDF/图片/音视频解析，也不自动生成 Wiki；后续消化仍应通过 `knowledge_rewrite` ActionRun 走计划和审批。

## 导入文件夹

用户可以在 Knowledge 页面点击“导入文件夹”，选择一个本地目录。Desktop 会读取该目录中浏览器可访问的 Markdown / TXT / text MIME 文件，并为每个文件写入 `sources/imported/`。文件夹导入的资料源 frontmatter 会标记 `source: desktop-folder`、原始文件名、相对路径、MIME 类型和导入时间，便于后续追溯原始目录结构。

导入成功后，Knowledge 会刷新 Snapshot、切到“未消化资料”视图，并打开最后一个导入的资料源。当前文件夹导入只处理文本文件；Office/PDF/图片/音视频和二进制内容导入仍需要后续专门能力。

## 剪藏 URL

用户可以在 Knowledge 页面点击“剪藏 URL”，保存网页链接、可选标题和摘录/备注。Desktop 会生成 Markdown 资料源，写入当前绑定仓库的 `sources/imported/` 目录，frontmatter 标记 `source: desktop-url`、`url` 和导入时间。

当前剪藏不会后台抓取网页正文，也不会绕过网络审批。它只把用户提供的 URL 与摘录保存为资料源，导入成功后同样进入未消化资料队列；后续消化、索引和日志更新仍通过 `knowledge_rewrite` ActionRun 走计划和审批。

## 健康检查

Knowledge Snapshot 会基于当前仓库事实生成只读健康报告。第一片检查覆盖：

- 孤立资料：资料源没有出现在索引中，也没有被 Wiki 引用。
- 未进入索引的 Wiki：Wiki 页面存在，但没有出现在 `wiki/index.md`。
- 索引陈旧：`wiki/index.md` 指向不存在的资料源或 Wiki。
- 知识库内断链：Wiki 页面链接到不存在的资料源或 Wiki。
- 无来源引用 Wiki：Wiki 页面没有直接引用资料源，后续难以追溯事实来源。
- 长期未复盘事项：`work/active/` 或 `work/someday/` 中长期没有近期 `reviews/weekly/` 复盘引用的事项。

这些问题会出现在 Knowledge 的“健康检查”视图，也会进入 Dashboard 的知识动态，并跳转到 `/knowledge?section=health`。用户可以点击“写入周复盘”，把当前健康报告沉淀到 `reviews/weekly/YYYY-MM-DD-knowledge-health.md`，用于每周复盘、后续修复和 Agent 接力。

## 未消化资料

Knowledge 的“未消化资料”视图对应 `/knowledge?section=digest`。它列出还没有被索引或 Wiki 引用的资料源。用户可以先打开资料阅读，也可以直接点击“消化”发起 `knowledge_rewrite` ActionRun。

消化动作必须先让 Agent 读取资料源、现有 Wiki、索引和日志，提出写入计划；写入或改写任何仓库文件前必须请求审批。批准后才可写入 Wiki、更新 `wiki/index.md`，并向 `wiki/log.md` 追加维护记录。

## 边界

健康检查和未消化资料队列默认只做可观测事实，不自动改写 Wiki、不更新索引、不删除资料。健康检查可以由用户主动写入 `reviews/weekly/`；如果需要修复，应发起 Knowledge ActionRun 或使用 Desktop repository tools，并在写入前请求审批。
