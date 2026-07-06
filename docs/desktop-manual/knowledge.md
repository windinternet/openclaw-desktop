# Knowledge 能力

Knowledge 用于管理仓库中的资料源和长期 Wiki。涉及当前仓库内容、路径、写入规则或项目目标时，必须以 Repository Context 和仓库 `AGENTS.md` 为准。

## 当前事实

- Knowledge 读取绑定仓库中的 `sources/`、`wiki/`、`wiki/index.md` 和 `wiki/log.md`。
- Knowledge Snapshot 会列出资料源、Wiki、索引入口、最近更新、Wiki 反链、相关事项和成果链接。
- Knowledge Snapshot 会计算未消化资料队列：资料源没有出现在索引中、没有被 Wiki 引用，且 `wiki/log.md` 没有明确记录该资料源已消化时，会进入队列。
- Knowledge 页面提供“导入文本”入口，会把粘贴的原始资料写入 `sources/imported/`，并刷新未消化资料队列。
- Knowledge 页面提供“导入文件”和“导入文件夹”入口，也支持拖拽导入本地 Markdown / MDX / TXT / LOG / CSV / TSV / JSON / JSONL / YAML / TOML / INI / CONF / PROPERTIES / SQL / GraphQL / Proto / JavaScript / TypeScript / CSS / Python / Shell / HTML / XML / RTF / RST / AsciiDoc / SRT / VTT / PDF / Word / Excel / PowerPoint / SVG 图片 / 栅格图片 / 音频 / 视频文件；文本、表格文本和结构化文本文件会直接读取，RTF、RST、AsciiDoc、SRT 和 VTT 只作为原文文本资料源读取，PDF 与 Word/Excel/PowerPoint OOXML 会 best-effort 抽取文本，旧版 Word .doc 会在 macOS 上尝试通过 textutil（macOS textutil）best-effort 抽取文本，旧版 Excel 会尝试 BIFF8 结构化/printable-text best-effort 抽取文本，旧版 PowerPoint 会尝试 TextHeaderAtom text atom/printable-text best-effort 抽取文本，并在存在 SlideContainer/NotesContainer 时按 # Slide N / # Notes N 小节分节，制表符表格行会保留为 tabular text，SVG 图片会 best-effort 抽取 `<title>`、`<desc>` 和 `<text>` 等显式文本；抽取失败的旧版 Office、栅格图片/OCR 和音视频转写会作为不可抽取资料源写入 `sources/imported/`，并刷新未消化资料队列。
- Knowledge 页面提供“剪藏 URL”入口，会把网页链接、可选标题、可选摘录/备注，以及无手填摘录时的 best-effort 网页抓取片段写入 `sources/imported/`，并刷新未消化资料队列。
- Knowledge 页面提供搜索、资料阅读、Wiki 阅读、索引/日志查看和自动改写入口。
- Knowledge 健康检查会扫描当前绑定工作根下 active/someday 事项和 `reviews/weekly/`，标出长期没有近期复盘引用的工作事项；默认仓库对应 `work/active/` / `work/someday/`，语义映射仓库可对应 `10-ops/tasks/active/` / `10-ops/tasks/someday/`。
- Knowledge 健康检查会识别 Wiki 和 `wiki/log.md` 中用 `矛盾:`、`冲突:`、`contradiction:`、`conflict:` 或 `conflictsWith:` 明确标记的相互矛盾记录，也会保守比较结构化 `Fact: key = value` / `事实：key = value` 或 `Fact: key: value` / `事实：key：value` 行里的同名事实值，并识别同一能力主题的明确“支持 / 不支持”、`supports / does not support`、`can / cannot`、`able to / unable to`、`able to / not able to`、`capable of / incapable of`、`capable of / not capable of`、`has ability / lacks ability`、`has ability / does not have ability`、`compatible with / incompatible with`、`equipped to / not equipped to`、`ready to / not ready to`、`prepared to / not prepared to`、`enabled / disabled`、`available / unavailable`、`required / optional`、`requires / does not require`、`uses / does not use`、`relies on / does not rely on`、`depends on / does not depend on`、`integrates with / does not integrate with`、`connects to / does not connect to`、`communicates with / does not communicate with`、`routes to / does not route to`、`sends to / does not send to`、`receives from / does not receive from`、`listens to / does not listen to`、`subscribes to / does not subscribe to`、`publishes to / does not publish to`、`emits to / does not emit to`、`broadcasts to / does not broadcast to`、`forwards to / does not forward to`、`delivers to / does not deliver to`、`writes to / does not write to`、`saves to / does not save to`、`stores in / does not store in`、`persists to / does not persist to`、`recommended / not recommended`、`permitted to / not permitted to`、`permitted to / forbidden to`、`permitted / prohibited from`、`permitted / restricted from`、`permitted / blocked from`、`permitted / barred from`、`permitted / prevented from`、`permitted / precluded from`、`allowed to / not allowed to`、`authorized to / not authorized to`、`approved to / not approved to`、`should / should not`、`must / must not`、`shall / shall not`、`may / may not`、`mandatory / compulsory / prohibited`、“可以 / 不能”、“已启用 / 已禁用”、“可用 / 不可用”、“必须 / 可选”、“必须 / 不得”、“建议 / 不建议”或“应该 / 不应该”自由文本能力矛盾。
- Knowledge 健康检查还会保守识别明确 `Desktop has access to X` / `Desktop does not have access to X` / `Desktop has no access to X` / `Desktop lacks access to X` 访问权限短句里的同主题矛盾；该检查不从任意段落推断访问控制状态。
- Knowledge 健康检查视图提供“写入周复盘”入口，会把当前健康报告写入 `reviews/weekly/YYYY-MM-DD-knowledge-health.md`。
- 自动消化资料或改写 Wiki 通过 `knowledge_rewrite` ActionRun 发起；写入仓库前必须请求审批。
- `knowledge_rewrite` 的审批块应携带 `repositoryWrite.writes`，逐项给出 Wiki 条目、`wiki/index.md` 和 `wiki/log.md` 的完整路径与完整内容；用户在 Action Center 批准后，Desktop 只允许把这些内容写入当前知识库边界内，拒绝 `sources/`、`work/`、`plans/` 等越界路径，并在 ActionRun 结果摘要中保留具体写入路径。
- 普通“消化资料 / 自动改写 / 刷新索引日志”入口可以在发起前选择关联事项；Desktop 会把事项 `workItemPath` 和 frontmatter `id` 写入 `knowledge_rewrite` ActionRun。
- Dashboard 知识类尾动作进入 Knowledge 时会保留来源事项和尾动作 ID，并提供“发起知识更新 ActionRun”和“写复盘”入口；该入口创建带 `workItemPath` / `tailActionId` 的 `knowledge_rewrite` ActionRun。完成知识更新或确认无需写入后，用户可在 Knowledge 显式确认该尾动作，Desktop 只勾选来源事项中匹配的知识尾动作；用户也可从同一上下文显式进入 Workbench 复盘入口。
- Workbench 计划执行知识更新入口也会打开 Knowledge，并携带 `tailActionId=action-run-knowledge:<runId>` 与来源 `workItemPath`；这个 ID 只表示来源执行记录，不是事项 checklist 尾动作，因此 Knowledge 可发起 `knowledge_rewrite`，但不会显示“确认已处理并完成尾动作”。

## 导入文本

用户可以在 Knowledge 页面点击“导入文本”，粘贴会议记录、想法、网页摘录或其他原始资料。Desktop 会生成 Markdown 资料源，写入当前绑定仓库的 `sources/imported/` 目录，frontmatter 标记 `source: desktop-paste` 和导入时间。

导入成功后，Knowledge 会刷新 Snapshot、切到“未消化资料”视图，并打开刚导入的资料源。该导入只保存原始资料，不自动生成 Wiki、不更新 `wiki/index.md`、不写入 `wiki/log.md`；后续消化仍应通过 `knowledge_rewrite` ActionRun 走计划和审批。

## 导入文件

用户可以在 Knowledge 页面点击“导入文件”，通过系统文件选择器选择 Markdown / MDX / TXT / LOG / CSV / TSV / JSON / JSONL / YAML / TOML / INI / CONF / PROPERTIES / SQL / GraphQL / Proto / JavaScript / TypeScript / CSS / Python / Shell / HTML / XML / RTF / RST / AsciiDoc / LaTeX / Org-mode / Textile / Creole / MediaWiki / Texinfo / POD / RDoc / Wiki / DokuWiki / SRT / VTT / PDF / Word / Excel / PowerPoint / SVG 图片 / 栅格图片 / 音频 / 视频文件；也可以直接把这些资料文件拖拽到 Knowledge 页面完成拖拽导入。Desktop 会直接读取 Markdown / MDX / TXT / LOG / CSV / TSV / JSON / JSONL / YAML / TOML / INI / CONF / PROPERTIES / SQL / GraphQL / Proto / JavaScript / TypeScript / CSS / Python / Shell / HTML / XML / RTF / RST / AsciiDoc / LaTeX / Org-mode / Textile / Creole / MediaWiki / Texinfo / POD / RDoc / Wiki / DokuWiki / SRT / VTT 文本；RTF 不渲染富文本、不解析控制字、不抽取嵌入对象，RST / AsciiDoc 不渲染文档、不解析指令、不展开 include，LaTeX / Org-mode / Textile / Creole / MediaWiki 不渲染论文或 Wiki 页面、不运行导出器、不展开宏或模板，Texinfo / POD / RDoc / Wiki / DokuWiki 不渲染手册或帮助页面、不运行文档生成器、不展开 include/宏/模板，SRT / VTT 不代表自动转写音视频；PDF 与 Word/Excel/PowerPoint OOXML 会通过 Electron 侧抽取器做 best-effort 抽取文本；旧版 Word .doc 会在 macOS 上尝试通过 textutil best-effort 抽取文本；旧版 Excel 会尝试 BIFF8 结构化/printable-text best-effort 抽取文本，旧版 PowerPoint 会尝试 TextHeaderAtom text atom/printable-text best-effort 抽取文本，并在存在 SlideContainer/NotesContainer 时按 # Slide N / # Notes N 小节分节，制表符表格行会保留为 tabular text；SVG 图片会 best-effort 抽取显式文本，只读取 `<title>`、`<desc>` 和 `<text>` 等节点，不做栅格图片 OCR；抽取失败的旧版 Office、栅格图片/OCR 和音视频转写会作为不可抽取资料源导入，不读取正文，生成 Markdown 资料源，写入当前绑定仓库的 `sources/imported/` 目录。frontmatter 会标记 `source: desktop-file`、原始文件名、MIME 类型和导入时间；抽取型文件还会记录 `extractedFormat`、`extractionStatus: best_effort` 或 `extractionStatus: unavailable`、不可用时的 `extractionReason: legacy-binary-office` / `image-ocr-unavailable` / `audio-transcription-unavailable` / `video-transcription-unavailable`、`extractedBytesRead` 和 `extractedTruncated`。JSON / JSONL / YAML / TOML / INI / CONF / PROPERTIES / SQL / GraphQL / Proto / HTML / XML / RTF / RST / AsciiDoc / LaTeX / Org-mode / Textile / Creole / MediaWiki / Texinfo / POD / RDoc / Wiki / DokuWiki / SRT / VTT 只作为文本资料读取，不做 schema 推断、不恢复结构化查询能力、不自动写 Wiki/index/log。

LaTeX、Org-mode、Textile、Creole 和 MediaWiki 源文件 `.tex`、`.latex`、`.org`、`.textile`、`.creole`、`.mediawiki` 也会作为原文文本资料源导入。Desktop 不渲染论文或 Wiki 页面，不运行 TeX/Org 导出器，不展开 include/宏/模板，不解析链接图谱，不自动写 Wiki/index/log。

Texinfo、POD、RDoc、Wiki 和 DokuWiki 帮助系统源码 `.texi`、`.texinfo`、`.pod`、`.rdoc`、`.wiki`、`.dokuwiki` 也会作为原文文本资料源导入。Desktop 不渲染手册或帮助页面，不运行文档生成器，不展开 include/宏/模板，不解析链接图谱，不自动写 Wiki/index/log。

JSON5、JSONC、HJSON、NDJSON 和 JSON-LD 文件 `.json5`、`.jsonc`、`.hjson`、`.ndjson`、`.jsonld` 也会作为原文文本资料源导入。Desktop 不解析宽松 JSON，不剥离注释，不展开 JSON-LD 语义图，不验证结构，不自动写 Wiki/index/log。

RDF/Turtle、N3、N-Triples、N-Quads、TriG 和 TriX linked-data 图谱文本 `.ttl`、`.n3`、`.nt`、`.nq`、`.trig`、`.trix` 也会作为原文文本资料源导入。Desktop 不解析 RDF 图谱，不执行 SPARQL，不展开 linked-data 语义，不验证 ontology，不自动写 Wiki/index/log。

版本控制补丁、reject 和 Git 元数据文件 `.patch`、`.diff`、`.rej`、`.gitmodules`、`.gitconfig`、`.mailmap` 也会作为原文文本资料源导入。Desktop 不应用 patch，不运行 git，不解析冲突或 author 映射，不读取远程仓库，不自动写 Wiki/index/log。

VCS blame ignore、占位和忽略规则标记文件 `.git-blame-ignore-revs`、`.gitkeep`、`.keep`、`.hgignore`、`.svnignore`、`.cvsignore` 也会作为原文文本资料源导入。Desktop 不改写 ignore 规则，不保留空目录，不运行 git/hg/svn/cvs，不解析 blame 或版本历史，不自动写 Wiki/index/log。

工程构建、包配置与测试环境配置文件 `CMakeLists.txt`、`CMakePresets.json`、`meson.options`、`pyproject.toml`、`setup.cfg`、`tox.ini` 也会作为原文文本资料源导入。Desktop 不运行 CMake/Meson/Python packaging/tox，不解析依赖图，不生成构建计划，不验证配置，不自动写 Wiki/index/log。

额外构建工具入口文件 `SConstruct`、`SConscript`、`BUCK`、`TARGETS`、`BUILD.gn`、`build.ninja`、`.gn`、`.gni`、`.ninja` 也会作为原文文本资料源导入。Desktop 不运行 SCons/Buck/Pants/GN/Ninja，不生成构建图，不解析 target graph，不执行构建，不自动写 Wiki/index/log。

导入成功后，Knowledge 会刷新 Snapshot、切到“未消化资料”视图，并打开最后一个导入的资料源。PDF / Word / Excel / PowerPoint OOXML、旧版 Word .doc、抽到文本的旧版 Excel/PowerPoint 和 SVG 图片会带有“抽取限制”小节，提醒复杂版式、图片、批注、表格、嵌入对象、公式、单元格结构、幻灯片层级、图表和非显式 SVG 文本可能丢失，二进制 printable-text 结果也可能包含少量噪声；抽取失败的旧版 Office、栅格图片、音频和视频资料源会写入“抽取状态”小节，提醒转换格式、手动粘贴摘录，或等待 OCR/转写能力。该导入不自动生成 Wiki、不更新索引或日志，后续消化仍应通过 `knowledge_rewrite` ActionRun 走计划和审批。

## 导入文件夹

用户可以在 Knowledge 页面点击“导入文件夹”，选择一个本地目录。Desktop 会读取该目录中浏览器可访问的 Markdown / MDX / TXT / LOG / CSV / TSV / JSON / JSONL / YAML / TOML / INI / CONF / PROPERTIES / SQL / GraphQL / Proto / JavaScript / TypeScript / CSS / Python / Shell / HTML / XML / RTF / RST / AsciiDoc / SRT / VTT / PDF / Word / Excel / PowerPoint / SVG 图片 / 栅格图片 / 音频 / 视频文件，并为每个支持文件写入 `sources/imported/`。文件夹导入的资料源 frontmatter 会标记 `source: desktop-folder`、原始文件名、相对路径、MIME 类型和导入时间；抽取型文件同样会记录 best-effort 或 unavailable 抽取元数据，旧版 Excel BIFF8 结构化/printable-text 中的制表符表格行会保留为 tabular text，旧版 PowerPoint TextHeaderAtom text atom/printable-text 在存在 SlideContainer/NotesContainer 时可按 # Slide N / # Notes N 小节分节，便于后续追溯原始目录结构。

导入成功后，Knowledge 会刷新 Snapshot、切到“未消化资料”视图，并打开最后一个导入的资料源。当前文件夹导入可记录旧版 Word .doc 的 macOS textutil best-effort 抽取文本，也可记录旧版 Excel 的 BIFF8 结构化/printable-text best-effort 抽取文本和旧版 PowerPoint 的 TextHeaderAtom text atom/printable-text best-effort 抽取文本，并在存在 SlideContainer/NotesContainer 时按 # Slide N / # Notes N 小节分节，还可记录 SVG 图片显式文本；抽取失败的旧版 Office、栅格图片、音频和视频仍会作为不可抽取资料源保留。该能力仍不会恢复 Excel 单元格结构、完整 PowerPoint 幻灯片层级、栅格图片/OCR 或音视频转写；这些内容导入仍需要后续专门能力。文件夹导入本身不会抓取网页正文；网页标题和正文片段仍属于“剪藏 URL”入口，并按 `urlFetchStatus`、`## 网页抓取内容` 和 `## 抓取边界` 记录。

## 剪藏 URL

用户可以在 Knowledge 页面点击“剪藏 URL”，保存网页链接、可选标题和摘录/备注。Desktop 会生成 Markdown 资料源，写入当前绑定仓库的 `sources/imported/` 目录，frontmatter 标记 `source: desktop-url`、`url` 和导入时间。

当用户没有手填摘录且 Electron URL fetching 可用时，Desktop 会 best-effort 抓取网页标题和正文片段，并在资料源 frontmatter / 正文中记录 `urlFetchStatus`、可选抓取标题、读取字节数、截断状态、`## 网页抓取内容` 和 `## 抓取边界`。失败、不支持内容类型或抓取不可用时仍保留 URL source 和用户提供的 URL/备注。该入口只保存资料源并进入未消化资料队列，不自动写 Wiki/index/log、不绕过审批；后续消化、索引和日志更新仍通过 `knowledge_rewrite` ActionRun 走计划和审批。

## 健康检查

Knowledge Snapshot 会基于当前仓库事实生成只读健康报告。第一片检查覆盖：

- 孤立资料：资料源没有出现在索引中，也没有被 Wiki 引用。
- 未进入索引的 Wiki：Wiki 页面存在，但没有出现在 `wiki/index.md`。
- 索引陈旧：`wiki/index.md` 指向不存在的资料源或 Wiki。
- 知识库内断链：Wiki 页面链接到不存在的资料源或 Wiki。
- 无来源引用 Wiki：Wiki 页面没有直接引用资料源，后续难以追溯事实来源。
- 长期未复盘事项：当前绑定工作根下 active/someday 中长期没有近期 `reviews/weekly/` 复盘引用的事项。
- 相互矛盾记录：Wiki 或 `wiki/log.md` 中已经明确标记为矛盾/冲突的记录；健康检查会把同一行里的第一个仓库内 Markdown 链接作为目标线索。
- 结构化事实矛盾：Wiki 或 `wiki/log.md` 中的 `Fact: key = value` / `事实：key = value` 或 `Fact: key: value` / `事实：key：value` 行如果出现同一个 key 的不同 value，会提示复核最早记录和冲突记录。
- 自由文本能力矛盾：Wiki 或 `wiki/log.md` 中如果同一能力主题同时出现明确“支持 X / 不支持 X”、`supports X / does not support X`、`Desktop can X / Desktop cannot X`、`Desktop is able to X / Desktop is unable to X`、`Desktop is able to X / Desktop is not able to X`、`Desktop is capable of X / Desktop is incapable of X`、`Desktop is capable of X / Desktop is not capable of X`、`Desktop has the ability to X / Desktop lacks the ability to X`、`Desktop has the ability to X / Desktop does not have the ability to X`、`Desktop is compatible with X / Desktop is incompatible with X`、`Desktop is equipped to X / Desktop is not equipped to X`、`Desktop is ready to X / Desktop is not ready to X`、`Desktop is prepared to X / Desktop is not prepared to X`、`Desktop X is enabled / Desktop X is disabled`、`Desktop X is available / Desktop X is unavailable`、`Desktop X is required / Desktop X is optional`、`Desktop requires X / Desktop does not require X`、`Desktop uses X / Desktop does not use X`、`Desktop relies on X / Desktop does not rely on X`、`Desktop depends on X / Desktop does not depend on X`、`Desktop integrates with X / Desktop does not integrate with X`、`Desktop connects to X / Desktop does not connect to X`、`Desktop communicates with X / Desktop does not communicate with X`、`Desktop routes to X / Desktop does not route to X`、`Desktop sends to X / Desktop does not send to X`、`Desktop receives from X / Desktop does not receive from X`、`Desktop listens to X / Desktop does not listen to X`、`Desktop subscribes to X / Desktop does not subscribe to X`、`Desktop publishes to X / Desktop does not publish to X`、`Desktop emits to X / Desktop does not emit to X`、`Desktop broadcasts to X / Desktop does not broadcast to X`、`Desktop forwards to X / Desktop does not forward to X`、`Desktop delivers to X / Desktop does not deliver to X`、`Desktop writes to X / Desktop does not write to X`、`Desktop saves to X / Desktop does not save to X`、`Desktop stores in X / Desktop does not store in X`、`Desktop persists to X / Desktop does not persist to X`、`Desktop X is recommended / Desktop X is not recommended`、`Desktop is permitted to X / Desktop is not permitted to X`、`Desktop is permitted to X / Desktop is forbidden to X`、`Desktop X is permitted / Desktop is prohibited from X`、`Desktop X is permitted / Desktop is restricted from X`、`Desktop X is permitted / Desktop is blocked from X`、`Desktop X is permitted / Desktop is barred from X`、`Desktop X is permitted / Desktop is prevented from X`、`Desktop X is permitted / Desktop is precluded from X`、`Desktop is allowed to X / Desktop is not allowed to X`、`Desktop is authorized to X / Desktop is not authorized to X`、`Desktop is approved to X / Desktop is not approved to X`、`Desktop should X / Desktop should not X`、`Desktop must X / Desktop must not X`、`Desktop shall X / Desktop shall not X`、`Desktop may X / Desktop may not X`、`Desktop X is mandatory / Desktop X is compulsory / Desktop X is prohibited`、“可以 X / 不能 X”、“已启用 X / 已禁用 X”、“X 可用 / X 不可用”、“必须 X / 可选 X”、“小龙虾必须 X / 小龙虾不得 X”、“小龙虾建议 X / 小龙虾不建议 X”或“小龙虾应该 X / 小龙虾不应该 X”句式，会提示复核最早记录和冲突记录。

这些问题会出现在 Knowledge 的“健康检查”视图，也会进入 Dashboard 的知识动态，并跳转到 `/knowledge?section=health`。用户可以点击“写入周复盘”，把当前健康报告沉淀到 `reviews/weekly/YYYY-MM-DD-knowledge-health.md`，用于每周复盘、后续修复和 Agent 接力。

## 未消化资料

Knowledge 的“未消化资料”视图对应 `/knowledge?section=digest`。它列出还没有被索引、没有被 Wiki 引用，且 `wiki/log.md` 中没有明确消化记录的资料源。用户可以先打开资料阅读，也可以直接点击“消化”发起 `knowledge_rewrite` ActionRun。

消化动作会在 ActionRun 输入和 prompt 中带上“消化计划”清单：读取资料源、提取可复用事实、对照现有 Wiki/index/log、输出 `approval_required` 或 `no_write_needed`。写入或改写任何仓库文件前必须请求审批。审批块应携带 `repositoryWrite.writes`；批准后 Desktop 会通过 Action Center 写入 Wiki、更新 `wiki/index.md`，并向 `wiki/log.md` 追加维护记录。

## 普通知识更新事项关联

用户从 Knowledge 普通入口发起 `knowledge_rewrite` 时，如果不是从 Dashboard 知识尾动作进入，页面会列出当前绑定 Repository 的 Workbench Snapshot 中已有 active / someday / completed 事项，也就是当前绑定工作根下的事项集合；默认仓库可包含 `work/active`、`work/someday` 和 `work/completed`，语义映射仓库可包含 `10-ops/tasks/active`、`10-ops/tasks/someday` 和 `10-ops/tasks/completed`。用户可在发起前选择关联事项，Desktop 会读取事项 frontmatter `id`，并把 `workItemPath` 和 `workItemId` 写入 ActionRun。

该选择只用于把知识更新纳入事项推进记录，不会自动创建事项、猜测事项、直接写 Wiki、勾选尾动作或绕过审批。Dashboard 知识尾动作入口已经有来源 `workItemPath` 时，应优先使用来源事项和 `tailActionId`，不被普通选择器覆盖。

## 事项知识尾动作

当 Dashboard 从工作事项 `## 收尾动作` 中识别到知识更新尾动作时，会打开 Knowledge 维护上下文，并通过 URL 携带 `tailAction=knowledge`、`tailActionId` 和 `workItemPath`。Knowledge 会显示来源事项，并提供“发起知识更新 ActionRun”。

该入口创建 `knowledge_rewrite` ActionRun，把来源 `workItemPath` 写入运行记录，并在 prompt 中要求 Agent 先读取来源事项、关联执行记录、关联成果和现有知识库，再提出写入 Wiki、更新 `wiki/index.md` / `wiki/log.md` 的审批计划；如果没有必要写入，应输出 `no_write_needed`。该入口不绕过 Action Center 审批直接改 Wiki、不自动勾选知识尾动作、不更新事项状态，也不替代复盘。

当用户完成知识更新，或确认这次执行不需要写入知识库后，可以点击“确认已处理并完成尾动作”。Desktop 会读取来源事项 Markdown，要求 `tailActionId` 匹配、尾动作尚未完成且文本属于知识类动作，然后只把该 `## 收尾动作` 行写回为 `[x]`。这个确认不会写 Wiki、不会更新 `wiki/index.md` / `wiki/log.md`、不会更新事项状态、不会沉淀成果，也不会写复盘。

知识尾动作上下文也提供“写复盘”。点击后会复用 Dashboard 尾动作路由进入 `/workbench?tailAction=review`，并携带同一个 `workItemPath`、`tailActionId` 和可选 `assetRunPath`，让 Workbench reviews 继续创建或确认复盘草稿。该入口只做显式导航，不自动创建复盘、不确认复盘、不勾选复盘尾动作、不更新事项状态、不沉淀成果，也不写 Wiki/index/log。

## 计划执行知识更新入口

Workbench 预览活跃计划时，如果最近一次 `plan_execute` 已完成、有 `resultSummary` 且有安全 `workItemPath`，`shouldOfferPlanExecutionKnowledgeUpdate` 会显示“更新知识 / Update Knowledge”。点击后会打开 Knowledge 的 `tailAction=knowledge` 上下文，并携带 `tailActionId=action-run-knowledge:<runId>` 与来源 `workItemPath`。

该入口创建的 `knowledge_rewrite` prompt 会同时说明来源事项和来源执行记录 `action-run-knowledge:<runId>`，让 Agent 基于这次计划执行判断是否需要写入 Wiki、更新 `wiki/index.md` 或追加 `wiki/log.md`。如果没有必要写入，应输出 `no_write_needed`。

`action-run-knowledge:<runId>` 不是事项 `## 收尾动作` checklist ID，所以 Knowledge 不显示“确认已处理并完成尾动作”，也不会勾选任何事项尾动作。该入口不自动写 Wiki、不更新事项状态、不沉淀成果、不写复盘、不移动事项文件；写入仍必须通过 ActionRun 审批，审批通过后只写入知识库边界内的 Wiki/index/log。

## 边界

健康检查和未消化资料队列默认只做可观测事实，不自动改写 Wiki、不更新索引、不删除资料。结构化事实矛盾检测只比较显式 `Fact: key = value` / `事实：key = value` 或 `Fact: key: value` / `事实：key：value` 行；自由文本能力矛盾只识别明确“支持 / 不支持”、`can / cannot`、`able to / unable to`、`able to / not able to`、`capable of / incapable of`、`capable of / not capable of`、`has ability / lacks ability`、`has ability / does not have ability`、`compatible with / incompatible with`、`equipped to / not equipped to`、`ready to / not ready to`、`prepared to / not prepared to`、`enabled / disabled`、`available / unavailable`、`required / optional`、`requires / does not require`、`uses / does not use`、`relies on / does not rely on`、`depends on / does not depend on`、`integrates with / does not integrate with`、`connects to / does not connect to`、`communicates with / does not communicate with`、`routes to / does not route to`、`sends to / does not send to`、`receives from / does not receive from`、`listens to / does not listen to`、`subscribes to / does not subscribe to`、`publishes to / does not publish to`、`emits to / does not emit to`、`broadcasts to / does not broadcast to`、`forwards to / does not forward to`、`delivers to / does not deliver to`、`writes to / does not write to`、`saves to / does not save to`、`stores in / does not store in`、`persists to / does not persist to`、`recommended / not recommended`、`permitted to / not permitted to`、`permitted to / forbidden to`、`permitted / prohibited from`、`permitted / restricted from`、`permitted / blocked from`、`permitted / barred from`、`permitted / prevented from`、`permitted / precluded from`、`allowed to / not allowed to`、`authorized to / not authorized to`、`approved to / not approved to`、`should / should not`、`must / must not`、`shall / shall not`、`may / may not`、`mandatory / compulsory / prohibited`、“可以 / 不能”、“已启用 / 已禁用”、“可用 / 不可用”、“必须 / 可选”、“必须 / 不得”、“建议 / 不建议”和“应该 / 不应该”能力句式，不做开放式模型语义推断。健康检查可以由用户主动写入 `reviews/weekly/`；如果需要修复，应发起 Knowledge ActionRun 或使用 Desktop repository tools，并在写入前请求审批。
