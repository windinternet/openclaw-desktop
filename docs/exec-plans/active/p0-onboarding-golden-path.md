# 开箱金线独立推进设计与实施文档

> 状态：活跃
> 优先级：P0
> 适用线程：可由新的 Codex 会话并行推进
> 关联路线图：`docs/design-docs/product-goal-roadmap.md` 的 P0-0 与 P0-6

## 1. 核心修正

开箱金线不能把用户拖进复杂初始化。用户第一天打开 Desktop，目标应该是尽快开始管理资料、推进事项、留下成果，而不是被迫理解或创建仓库。

新的金线口径：

```text
打开应用 -> 选择语言/主题 -> 自动发现或安装 Gateway -> 选择工作空间 -> 输入第一件事或先体验 -> 进入工作台
```

关键原则：

- Gateway 是基础设施，不是用户目标。
- 不要把仓库初始化做成强制门槛。
- “创建本地工作仓库”只是一个推荐选项，不是唯一入口。
- 用户可以先跳过工作空间配置，进入轻量体验；等要沉淀长期事实时再选择仓库。
- 如果用户已有仓库，应该能绑定已有仓库，而不是被要求新建。
- 如果已有仓库符合推荐结构，Desktop 可以生成映射并直接开始。
- 如果已有仓库不符合推荐结构，Desktop 可以提供可审批的改造建议，而不是直接拒绝或强制迁移。

## 2. 工作空间选择模型

开箱中的“工作空间”应提供四条路径，按低摩擦优先：

1. **跳过仓库初始化**
   - 适合只想先试用、聊天、生成临时成果、看 Desktop 能力的用户。
   - Desktop 明确提示：跳过后仍可使用 Gateway 和部分 Desktop 功能，但长期知识、事项、计划、执行记录、成果和复盘不会完整沉淀到仓库。
   - 后续任何需要长期沉淀的动作，再引导用户绑定或创建工作空间。

2. **新建推荐结构仓库**
   - 适合没有现成工作仓库的用户。
   - Desktop 创建推荐目录结构，例如 `sources/`、`wiki/`、`work/`、`plans/`、`runs/`、`outputs/`、`reviews/`。
   - 这是推荐路径，但不能是强制路径。

3. **绑定已有仓库**
   - 适合已经有项目、资料库、笔记库或工作仓库的用户。
   - Desktop 先做只读检查，识别是否已有推荐目录、`AGENTS.md`、工作事项、知识库或输出目录。
   - 如果符合推荐结构，直接生成映射，进入工作台。

4. **映射或改造已有仓库**
   - 适合仓库不符合推荐结构，但用户不想迁移的情况。
   - Desktop 可以生成映射，把用户现有目录对应到资料、知识、事项、计划、执行记录、成果、复盘。
   - 如果缺目录或协议，Desktop 提供改造建议和可审批写入，不自动改造。
   - 用户可以选择只映射不改造，或者逐步接受改造。

## 3. 当前代码事实

当前已经落地的第一片：

- `src/lib/work-system-onboarding.ts` 定义 `/?onboarding=work-system` 和 `work-system-onboarding` 锚点。
- `WelcomePage` / `SetupPage` 连接成功后会进入 `/?onboarding=work-system`。
- `App` 会让该 query 绕过默认首页偏好，进入 Dashboard。
- Dashboard 在 Gateway 已连接但当前实例没有可用工作仓库时，会显示“创建你的工作系统”引导。
- 当前实现会复用 `RepositoryGate area="workbench"` 创建本地工作仓库。
- 仓库就绪后，用户输入第一件事会通过 `createFirstWorkbenchMatter()` 写入 `work/active/YYYY-MM-DD-HHmmss-*.md`。
- 写入成功后会进入 `/workbench?view=tasks&workItemPath=<matter>`，打开 Workbench 事项预览。

需要修正的地方：

- 当前产品叙事仍偏向“创建本地工作仓库”。
- 新线程应把它改成“选择工作空间”：跳过、新建、绑定、映射/改造。
- 当前第一件事写入依赖仓库就绪；跳过仓库初始化后，需要设计轻量的临时事项或会话内事项承接方式，等用户决定沉淀时再写入仓库。

## 4. 推荐首版实现范围

首版不要做复杂初始化向导。最小可交付是一个轻量的“工作空间选择”卡片或面板。

必须有：

- 继续体验：跳过仓库初始化。
- 新建推荐仓库：复用现有 `RepositoryGate` 创建能力。
- 绑定已有仓库：复用现有仓库选择/绑定能力。
- 检查已有仓库：只读识别推荐结构是否存在。
- 生成映射：对符合推荐结构的仓库生成 Desktop 可理解的映射。
- 改造建议：对不符合推荐结构的仓库给出可审批写入建议。

不要在首版做：

- 多屏复杂向导。
- 强制用户填写大量元数据。
- 自动迁移、自动改造或自动写入已有仓库。
- 不以产物系统为主线；产物是后续承接价值，不是开箱初始化的入口负担。
- 把完整“开始一件事闭环”塞进开箱初始化。
- 让用户必须先理解 Repository、runs、schemas、protocol。

## 5. 实施切片

### Phase 1：文案与入口降复杂度

目标：把开箱入口从“创建本地工作仓库”改成“选择工作空间”。

涉及文件：

- `src/pages/DashboardPage.tsx`
- `src/i18n/locales/zh-CN.json`
- `src/i18n/locales/en-US.json`
- `src/__tests__/dashboard-redesign.test.ts`
- `src/__tests__/work-system-onboarding.test.ts`

验收命令：

```bash
npm test -- src/__tests__/dashboard-redesign.test.ts src/__tests__/work-system-onboarding.test.ts -- --reporter=dot
```

### Phase 2：跳过仓库初始化

目标：用户可以先进入 Desktop，而不是被仓库选择挡住。

设计要求：

- 跳过后要清楚说明哪些能力是临时的。
- 用户仍能进入 Dashboard / New Session / Workbench 的轻量入口。
- 需要沉淀资料、知识、事项、计划、执行记录、成果或复盘时，再引导选择工作空间。
- 不要静默创建仓库，也不要把临时数据伪装成长期事实源。

验收命令：

```bash
npm test -- src/__tests__/work-system-onboarding.test.ts src/__tests__/dashboard-redesign.test.ts -- --reporter=dot
```

### Phase 3：绑定已有仓库与生成映射

目标：已有仓库可以直接成为工作空间。

设计要求：

- 只读扫描已有仓库。
- 识别推荐目录是否存在。
- 符合推荐结构时生成映射并进入工作台。
- 不符合推荐结构时展示缺口，不阻塞用户继续。
- 映射结果要可解释，让 Gateway / Desktop 知道资料、知识、事项、计划、运行、成果、复盘分别在哪里。

建议测试：

```bash
npm test -- src/__tests__/repository-workbench-mapping.test.ts src/__tests__/repository-context.test.ts -- --reporter=dot
```

### Phase 4：可审批改造已有仓库

目标：已有仓库不符合推荐结构时，可以选择逐步改造。

设计要求：

- 改造必须是建议，不是默认动作。
- 写入必须经用户确认。
- 只创建必要目录或协议文件。
- 不移动用户已有文件。
- 不覆盖已有 `AGENTS.md`、README、Wiki 或项目文件。

建议测试：

```bash
npm test -- src/__tests__/repository-path-safety.test.ts src/__tests__/repository-workbench.test.ts -- --reporter=dot
```

## 6. 并行新会话启动提示

可以把下面这段直接发给新的 Codex 会话：

```text
请阅读 AGENTS.md，并以 docs/exec-plans/active/p0-onboarding-golden-path.md 为主线推进 P0 开箱金线。

这份文档刚被修正：不要把开箱做成强制“创建本地工作仓库”。新的目标是“选择工作空间”：跳过仓库初始化、新建推荐结构仓库、绑定已有仓库、对已有仓库生成映射或提供可审批改造建议。

必须保留的产品判断：Gateway 是基础设施，不是用户目标；不要把仓库初始化做成强制门槛；复杂初始化会让普通用户直接放弃。首版优先降低摩擦，让用户能尽快进入 Desktop 和 Workbench。

当前代码事实：/?onboarding=work-system、Dashboard 创建工作系统引导、createFirstWorkbenchMatter、/workbench?view=tasks&workItemPath=<matter> 已有第一片，但当前叙事偏“创建本地工作仓库”。请先写测试锁定“选择工作空间 / 可跳过 / 可绑定已有 / 可生成映射 / 可审批改造”的口径，再做最小实现。
```

## 7. 维护规则

- 新线程如果改开箱路径，必须同步更新本文。
- 如果实现支持跳过、绑定已有仓库或映射已有仓库，应同步更新 `docs/PLANS.md` 和 `docs/design-docs/product-goal-roadmap.md`。
- 不允许再把“创建本地工作仓库”写成开箱唯一必经路径。
