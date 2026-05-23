# Semi Design 参考文档

> **版本**: `@douyinfe/semi-ui` ^2.74.0 | `@douyinfe/semi-icons` ^2.74.0
> **来源**: https://semi.design/zh-CN
> **定位**: OpenClaw Desktop 项目的 UI 组件库编码参考，帮助 AI Agent 写出类型正确、风格一致的组件代码

---

## 一、概述

Semi Design 是由**抖音前端团队**开发维护的企业级设计系统，提供 70+ React 组件。本项目的所有 UI 均基于 Semi Design 构建。

**核心特性**：
- 暗色模式原生支持（本项目默认暗色）
- CSS Variables 主题系统（`--semi-color-*`）
- TypeScript 类型完备
- Figma 设计资源配套

**本项目配置**：
- React 18 + Vite 6（无需额外编译配置，直接 `import` 使用）
- 样式按需加载，构建时自动 tree-shaking

---

## 二、设计令牌 (Design Tokens)

Semi Design 使用 CSS 变量实现主题化。**编码时必须使用变量名，禁止硬编码颜色值**。

### 2.1 功能色（最常用）

| CSS 变量 | 用途 | 示例场景 |
|----------|------|---------|
| `--semi-color-primary` | 主强调色 | 主按钮、选中态、链接 |
| `--semi-color-primary-hover` | 主色悬停 | 按钮 hover |
| `--semi-color-primary-active` | 主色按下 | 按钮 active |
| `--semi-color-primary-light-default` | 主色浅背景 | 选中行背景、标签背景 |
| `--semi-color-secondary` | 次要色 | 次要按钮 |
| `--semi-color-tertiary` | 第三色 | 弱化操作 |
| `--semi-color-info` | 信息色 | 提示信息 |
| `--semi-color-success` | 成功色 | 成功状态 |
| `--semi-color-warning` | 警示色 | 警告状态 |
| `--semi-color-danger` | 危险色 | 错误、删除操作 |

### 2.2 文本色（四级）

| CSS 变量 | 层级 | 用途 |
|----------|------|------|
| `--semi-color-text-0` | 最主要 | 标题、正文 |
| `--semi-color-text-1` | 次主要 | 次要文字 |
| `--semi-color-text-2` | 稍次要 | 辅助说明、占位符 |
| `--semi-color-text-3` | 最次要 | 禁用文字 |

### 2.3 背景色（分层层级）

| CSS 变量 | 层级 | 用途 |
|----------|------|------|
| `--semi-color-bg-0` | 最底层 | 页面背景 |
| `--semi-color-bg-1` | 第一层 | 卡片、容器背景 |
| `--semi-color-bg-2` | 第二层 | 嵌套容器、表头 |
| `--semi-color-bg-3` | 第三层 | 悬浮面板 |
| `--semi-color-bg-4` | 第四层 | 最深容器 |

### 2.4 其他常用变量

| 类别 | CSS 变量 | 说明 |
|------|---------|------|
| 填充色 | `--semi-color-fill-0` ~ `--semi-color-fill-2` | 表单控件填充 |
| 描边色 | `--semi-color-border` | 默认边框 |
| 链接色 | `--semi-color-link` | 超链接 |
| 禁用态 | `--semi-color-disabled-text/bg/border/fill` | 禁用元素 |
| 阴影 | `--semi-color-shadow` | 浅阴影（常用于 Table） |
| 圆角 | `--semi-border-radius-small/medium/large` | 组件圆角 |

### 2.5 间距系统

```typescript
// 常用间距值（CSS变量）
--semi-spacing-tight: 4px;     // 紧凑间距
--semi-spacing-base: 8px;      // 基础间距
--semi-spacing-base-tight: 12px;
--semi-spacing-base-loose: 16px;  // 宽松间距（组件内常用）
--semi-spacing-medium: 24px;       // 中等间距（区块间距）
--semi-spacing-large: 32px;        // 大间距（页面级）
```

### 2.6 排版

| 属性 | 值 | 说明 |
|------|-----|------|
| 默认字号 | `14px` | 正文 |
| 小号 | `12px` | 辅助文字 |
| 标题 | `16px/18px/20px/24px` | H4/H3/H2/H1 |
| 默认字重 | `400` | 正文 |
| 粗体字重 | `600` | 标题 |
| 英文字体 | Inter（需手动 `@font-face` 引入） | 默认不加载以减少包体积 |

### 2.7 暗色模式

本项目**默认暗色**。切换方式：

```tsx
// 方式一：在 body 上设置属性（本项目使用）
document.body.setAttribute('theme-mode', 'dark');

// 方式二：通过 ConfigProvider（包裹在 App 根组件）
import { ConfigProvider } from '@douyinfe/semi-ui';
<ConfigProvider theme={{ mode: 'dark' }}>
  <App />
</ConfigProvider>
```

暗色模式下，所有 `--semi-color-*` 变量自动切换到暗色调色板，**无需任何额外代码**。

---

## 三、本项目高频组件 API 速查

### 3.1 导入规范

```tsx
// ✅ 正确：从主包导入组件
import { Button, Table, Tag, ... } from '@douyinfe/semi-ui';

// ✅ 正确：从图标包导入
import { IconSend, IconRefresh, ... } from '@douyinfe/semi-icons';

// ✅ 正确：从插画包导入空状态图
import { IllustrationNoContent } from '@douyinfe/semi-illustrations';
```

### 3.2 Typography 版式

```tsx
import { Typography } from '@douyinfe/semi-ui';
const { Title, Text, Paragraph } = Typography;

// Title: 标题 (heading={1|2|3|4|5|6})
<Title heading={3} style={{ margin: 0 }}>页面标题</Title>

// Text: 文本
<Text type="tertiary" size="small">辅助文字</Text>
// type: 'primary' | 'secondary' | 'tertiary' | 'quaternary' | 'warning' | 'danger' | 'success'
// size: 'small' | 'normal' （默认 normal=14px, small=12px）

// Text 的 ellipsis 属性实现溢出省略 + Tooltip
<Text ellipsis={{ showTooltip: true }} style={{ width: 200 }}>
  超长文本自动省略并显示 Tooltip
</Text>
```

### 3.3 Button 按钮

```tsx
import { Button } from '@douyinfe/semi-ui';

// 类型
<Button type="primary">主按钮</Button>
<Button type="secondary">次按钮</Button>
<Button type="tertiary">第三按钮</Button>
<Button type="warning">警示按钮</Button>
<Button type="danger">危险按钮</Button>

// 样式
<Button theme="borderless">无边框</Button>  // 图标按钮常用
<Button theme="solid">实心</Button>

// 尺寸
<Button size="small">小</Button>
<Button size="default">默认</Button>
<Button size="large">大</Button>

// 图标 + 加载
<Button icon={<IconPlus />}>新建</Button>
<Button loading={true}>加载中</Button>
<Button disabled>禁用</Button>
```

### 3.4 Table 表格

```tsx
import { Table } from '@douyinfe/semi-ui';

// ✅ 基础用法
<Table
  columns={columns}        // 列配置数组
  dataSource={data}        // 数据源数组（每项必须有唯一 key）
  pagination={false}       // 关闭分页
/>

// ✅ 常用属性
<Table
  rowKey="id"              // 指定主键字段名（默认 'key'）
  loading={true}           // 加载状态
  empty={<Empty />}        // 自定义空状态
  size="small"             // 紧凑模式: 'small' | 'middle' | 'default'
  scroll={{ y: 400 }}      // 固定表头（y=高度），固定列（x=宽度）
  sticky={{ top: 60 }}     // v2.21+ 表头粘性定位
  onRow={(record) => ({    // 行事件绑定
    onClick: () => handleClick(record),
    style: { cursor: 'pointer' },
  })}
/>

// ✅ Column 配置
interface Column {
  title: string | ReactNode;     // 列标题
  dataIndex: string;             // 数据字段名
  key?: string;                  // React key
  width?: number | string;       // 列宽
  fixed?: 'left' | 'right';      // 固定列
  align?: 'left' | 'center' | 'right';
  render?: (text, record, index, options) => ReactNode;
  // options: { expandIcon, selection, indentText, isHovering }
  filters?: { text: string; value: any }[];  // 筛选器
  onFilter?: (value, record) => boolean;     // 筛选逻辑
  sorter?: ((a, b) => number) | boolean;     // 排序
  sortOrder?: 'ascend' | 'descend';          // 受控排序
  showSortTip?: boolean;                      // v2.65+ 排序提示
  defaultSortOrder?: 'ascend' | 'descend';
}
```

**⚠️ 常见陷阱**：
- `onFilter` 的 `record` 参数类型是 `RecordType | undefined`，需要处理 undefined
- `Column.sorter` 函数签名：`(a?: RecordType, b?: RecordType, sortOrder?: 'ascend' | 'descend') => number`
- 展开行使用 `expandedRowRender`，函数签名：`(record, index, expanded, { expandRow }) => ReactNode`

### 3.5 Form 表单

```tsx
import { Form } from '@douyinfe/semi-ui';

// ✅ 函数式表单
<Form onSubmit={handleSubmit}>
  <Form.Input field="name" label="名称" rules={[{ required: true }]} />
  <Form.Select field="type" label="类型" optionList={options} />
  <Form.Switch field="enabled" label="启用" />
  <Form.TextArea field="desc" label="描述" maxCount={500} />
</Form>

// ✅ 自定义子元素
<Form onSubmit={handleSubmit}>
  {({ formState, formApi }) => (
    <>
      <Form.Input field="title" />
      <Button onClick={() => formApi.setValue('title', '')}>清空</Button>
    </>
  )}
</Form>
```

### 3.6 Modal 模态框

```tsx
import { Modal } from '@douyinfe/semi-ui';

// ✅ 声明式
<Modal
  title="标题"
  visible={visible}
  onOk={handleOk}
  onCancel={() => setVisible(false)}
  okText="确认"
  cancelText="取消"
  closeOnEsc={true}
  maskClosable={false}     // 点击遮罩不关闭
  width={520}
>
  {/* 内容 */}
</Modal>

// ✅ 命令式（确认框）
Modal.confirm({
  title: '确认删除',
  content: '此操作不可撤销',
  onOk: () => handleDelete(),
});

// ✅ 无底部按钮
<Modal footer={null} visible={true}>...</Modal>
```

### 3.7 Card 卡片

```tsx
import { Card } from '@douyinfe/semi-ui';

// ⚠️ v2.74 Card 注意事项：
// - Card 没有 onClick 属性！需要用 wrapper div 包裹
// - Card 没有 hoverable 属性
// - bodyStyle 控制内容区样式

// ✅ 可点击卡片正确写法
<div onClick={handleClick} style={{ cursor: 'pointer' }}>
  <Card
    title="标题"
    headerExtraContent={<Tag>标签</Tag>}
    style={{ borderRadius: 12 }}
    bodyStyle={{ padding: 16 }}
  >
    内容
  </Card>
</div>

// ✅ 常用属性
<Card
  title="标题"
  headerStyle={{ borderBottom: 'none' }}
  bordered={false}           // 无边框模式
  shadows="hover"            // 悬浮阴影（'hover' | 'always'）
>
  内容
</Card>
```

### 3.8 Tag 标签

```tsx
import { Tag } from '@douyinfe/semi-ui';

// ✅ 颜色：使用预设颜色名（不是 'success'/'danger'/'primary'！）
<Tag color="green">成功</Tag>
<Tag color="red">错误</Tag>
<Tag color="orange">警告</Tag>
<Tag color="blue">信息</Tag>
<Tag color="grey">默认</Tag>
<Tag color="cyan">青色</Tag>
<Tag color="purple">紫色</Tag>

// 可用颜色: 'amber'|'blue'|'cyan'|'green'|'grey'|'indigo'|
//           'light-blue'|'light-green'|'lime'|'orange'|'pink'|
//           'purple'|'red'|'teal'|'violet'|'yellow'|'white'

// ✅ 样式
<Tag size="small">小</Tag>      // 'small' | 'default' | 'large'（无 'medium'）
<Tag type="solid">实心</Tag>    // 'solid' | 'light' | 'ghost'
<Tag shape="circle">圆形</Tag>  // 'circle' | 'square'

// ✅ 可关闭
<Tag closable onClose={() => {}}>可关闭</Tag>
```

### 3.9 Badge 徽章

```tsx
import { Badge } from '@douyinfe/semi-ui';

// ✅ 类型：使用特定的 BadgeType 值
// 'primary' | 'secondary' | 'tertiary' | 'danger' | 'warning' | 'success'
// ⚠️ 注意：没有 'default'！

<Badge dot type="success" />     // 绿点
<Badge dot type="warning" />     // 黄点
<Badge dot type="danger" />      // 红点
<Badge count={5} type="primary" />  // 数字徽章
<Badge count={99} overflowCount={99} />  // 溢出限制
```

### 3.10 Tabs 标签栏

```tsx
import { Tabs, TabPane } from '@douyinfe/semi-ui';
// 注意：TabPane 需单独导入

// ✅ 正确用法
<Tabs type="line" activeKey={activeKey} onChange={setActiveKey}>
  <TabPane tab="标签1" itemKey="1">
    内容1
  </TabPane>
  <TabPane tab="标签2" itemKey="2">
    内容2
  </TabPane>
</Tabs>

// type: 'line' | 'card' | 'button' | 'segment'
// TabPane 的 style 属性可能不被支持，如需样式请包裹 div

// ⚠️ 不要在 TabPane 上直接放 style，用 wrap div
<TabPane tab="标签" itemKey="key">
  <div style={{ padding: 16 }}>内容</div>
</TabPane>
```

### 3.11 Select 选择器

```tsx
import { Select } from '@douyinfe/semi-ui';

// ✅ 基础用法
<Select
  value={value}
  onChange={(v) => setValue(v as string)}  // ⚠️ onChange 类型是 broad union，需要断言
  optionList={[
    { value: 'a', label: '选项A' },
    { value: 'b', label: '选项B' },
  ]}
  placeholder="请选择"
/>

// ✅ onChange 签名: (value: string | number | boolean | Record<string,any> | any[] | undefined) => void
// ⚠️ 总是需要类型断言: onChange={(v) => setValue(v as string)}
```

### 3.12 Input 输入框

```tsx
import { Input } from '@douyinfe/semi-ui';

// ✅ 基础
<Input value={text} onChange={setText} placeholder="输入" />

// ✅ 带前缀/后缀图标
<Input prefix={<IconSearch />} suffix={<IconClose />} />

// ✅ 文本域
<Input.TextArea maxCount={500} rows={4} />

// ⚠️ onChange 签名: (value: string, e: React.ChangeEvent) => void
//    注意第一个参数是 value 字符串，不是 event！
```

### 3.13 Switch 开关

```tsx
import { Switch } from '@douyinfe/semi-ui';

<Switch checked={enabled} onChange={(checked) => setEnabled(checked)} />
// onChange 签名: (checked: boolean, e: React.MouseEvent) => void
```

### 3.14 Toast 提示

```tsx
import { Toast } from '@douyinfe/semi-ui';

// 四种类型
Toast.success('操作成功');
Toast.warning('请注意');
Toast.error('操作失败');
Toast.info('提示信息');

// 带配置
Toast.success({
  content: '已保存',
  duration: 3,       // 显示秒数（0=不自动关闭）
  showClose: true,   // 显示关闭按钮
});
```

### 3.15 Spin 加载

```tsx
import { Spin } from '@douyinfe/semi-ui';

// ✅ 居中加载
<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
  <Spin size="large" />
</div>

// ✅ 包裹内容
<Spin spinning={loading} tip="加载中...">
  <Content />
</Spin>

// size: 'small' | 'middle' | 'large'
```

### 3.16 Empty 空状态

```tsx
import { Empty } from '@douyinfe/semi-ui';
import { IllustrationNoContent, IllustrationNoContentDark } from '@douyinfe/semi-illustrations';

// ✅ 基础
<Empty description="暂无数据" />

// ✅ 带插画（暗色模式兼容）
<Empty
  image={<IllustrationNoContent />}
  darkModeImage={<IllustrationNoContentDark />}
  description="暂无数据"
/>

// ⚠️ Empty.EmptyImage 不存在！不要使用
```

### 3.17 List 列表

```tsx
import { List } from '@douyinfe/semi-ui';

<List
  dataSource={items}
  renderItem={(item) => (
    <List.Item
      main={<Text>{item.title}</Text>}
      extra={<Tag>{item.status}</Tag>}
    />
  )}
/>
```

### 3.18 Descriptions 描述列表

```tsx
import { Descriptions } from '@douyinfe/semi-ui';

<Descriptions
  row                           // 水平布局
  size="small"                  // 'small' | 'default' | 'large'
  data={[
    { key: '名称', value: '张三' },
    { key: '状态', value: <Tag color="green">运行中</Tag> },
  ]}
/>
```

### 3.19 Tooltip 工具提示

```tsx
import { Tooltip } from '@douyinfe/semi-ui';

<Tooltip content="提示文字" position="top">
  <Button>悬停查看</Button>
</Tooltip>
```

### 3.20 Space 间距

```tsx
import { Space } from '@douyinfe/semi-ui';

<Space spacing={12} align="center">
  <Button>按钮1</Button>
  <Button>按钮2</Button>
</Space>

// spacing: number | 'tight' | 'medium' | 'loose'
// align: 'start' | 'center' | 'end' | 'baseline'
```

### 3.21 Grid 栅格

```tsx
import { Row, Col } from '@douyinfe/semi-ui';

// 24 列栅格系统（类 Bootstrap）
<Row gutter={[16, 16]}>          // 水平16px 垂直16px 间距
  <Col span={6}>25%</Col>        // 24分格，span=6 占 25%
  <Col span={6}>25%</Col>
  <Col span={6}>25%</Col>
  <Col span={6}>25%</Col>
</Row>
```

---

## 四、本项目常用图标速查

```tsx
import { 
  // 操作
  IconPlus,          // +
  IconDelete,        // 🗑
  IconEdit,          // ✏️
  IconRefresh,       // ↻
  IconSend,          // ➤
  IconStop,          // ■
  IconSearch,        // 🔍
  IconClose,         // ✕
  IconMore,          // ⋯
  IconPlay,          // ▶

  // 状态
  IconTickCircle,    // ✅
  IconAlertCircle,   // ⚠️
  IconClear,         // ⊘
  IconMinusCircle,   // ⊖

  // 导航
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconChevronUp,

  // 功能
  IconSetting,        // ⚙
  IconHome,           // ⌂
  IconUser,           // 👤
  IconComment,        // 💬
  IconFolder,         // 📁
  IconFile,           // 📄
  IconCalendar,       // 📅
  IconClock,          // 🕐
  IconBox,            // 📦
  IconBookmark,       // 🔖
  IconStar,           // ⭐
  IconDownload,       // ⬇
  IconUpload,         // ⬆
  IconDesktop,        // 🖥
  IconServer,         // 🖧
  IconBranch,         // ⎇
  IconLink,           // 🔗

  // 组件特定
  IconPlusCircle,     // ⊕
  IconCheckList,      // ☑
  IconPieChart2Stroked,  // 饼图
  IconTreeTriangleDown,  // ▼ (展开)
  IconGithubLogo,     // GitHub
  IconSun,            // ☀
  IconMoon,           // ☽
  IconUserGroup,      // 👥
  IconPuzzle,         // 🧩
  IconKanban,         // 看板
} from '@douyinfe/semi-icons';
```

---

## 五、本项目编码规范

### 5.1 样式写法

```tsx
// ✅ 推荐：内联样式 + CSS 变量
<div style={{
  backgroundColor: 'var(--semi-color-bg-1)',
  color: 'var(--semi-color-text-0)',
  borderRadius: 12,
  padding: 16,
}}>

// ✅ 允许：数字直接写（间距、圆角等非颜色值）
<div style={{ padding: 24, gap: 12, borderRadius: 12 }}>

// ❌ 禁止：硬编码颜色值
<div style={{ backgroundColor: '#1a1a1a' }}>   // NO!
<div style={{ color: 'white' }}>               // NO!

// ❌ 禁止：使用 CSS 文件（本项目统一 inline styles）
```

### 5.2 暗色模式

```tsx
// ✅ 始终使用 Semi CSS 变量，暗色模式自动适配
// 无需任何额外代码

// ✅ 当需要使用纯黑/纯白时（极少情况）
style={{ color: 'var(--semi-color-text-0)' }}   // 暗色下自动变白
style={{ backgroundColor: 'var(--semi-color-bg-0)' }}  // 暗色下自动变黑
```

### 5.3 布局模式

```tsx
// ✅ 页面容器（一致模式）
<div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
  {/* 页面内容 */}
</div>

// ✅ 页面标题区
<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
  <div>
    <Typography.Title heading={3} style={{ margin: 0 }}>标题</Typography.Title>
    <Typography.Text type="tertiary">描述</Typography.Text>
  </div>
  <Space>
    <Button icon={<IconRefresh />}>刷新</Button>
    <Button type="primary" icon={<IconPlus />}>新建</Button>
  </Space>
</div>

// ✅ 居中加载/空状态（最小高度 300px）
<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
  <Spin size="large" />
</div>

// ✅ 表格页面全高布局
<div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 24 }}>
  <div style={{ marginBottom: 16 }}>{/* 操作栏 */}</div>
  <div style={{ flex: 1, overflow: 'auto' }}>
    <Table ... />
  </div>
</div>
```

### 5.4 常见类型错误避免

| 错误写法 | 正确写法 | 原因 |
|---------|---------|------|
| `<Tag color="success">` | `<Tag color="green">` | Tag color 用颜色名，不是语义名 |
| `<Badge type="default">` | `<Badge type="primary">` | Badge type 无 'default' |
| `<Badge type="success">` | ✅ 正确 | Badge type 支持 'success' |
| `<Tag size="medium">` | `<Tag size="default">` | Tag size 无 'medium' |
| `<Card onClick={...}>` | `<div onClick={...}><Card>...</Card></div>` | Card 无 onClick |
| `<Card hoverable>` | 移除该属性 | Card v2.74 无 hoverable |
| `<Empty.EmptyImage />` | 使用 `@douyinfe/semi-illustrations` | Empty 无 EmptyImage 子组件 |
| `<Select onChange={setValue}>` | `onChange={(v) => setValue(v as string)}` | Select 的 onChange 类型是 union |
| `Tabs.TabPane` 上放 `style` | 内部 wrap `<div style={...}>` | TabPane style 类型可能不支持 |

---

## 六、组件速查索引

| 组件 | 分类 | 常用场景 |
|------|------|---------|
| `Table` | 展示类 | 数据列表（Cron、Sessions、Extensions、Workspace） |
| `Card` | 展示类 | 统计卡片、信息容器 |
| `Tag` | 展示类 | 状态标签、分类标记 |
| `Badge` | 展示类 | 连接状态、新消息提示 |
| `Modal` | 展示类 | 表单弹窗、确认框 |
| `Form` | 输入类 | 创建/编辑表单 |
| `Select` | 输入类 | 下拉选择（Agent、Model、语言） |
| `Input` | 输入类 | 文本输入、搜索 |
| `Switch` | 输入类 | 开关切换 |
| `Button` | 基础 | 所有操作按钮 |
| `Typography` | 基础 | 标题、文本 |
| `Spin` | 反馈类 | 加载状态 |
| `Empty` | 展示类 | 空数据占位 |
| `Toast` | 反馈类 | 操作反馈提示 |
| `Tabs` | 导航类 | 内容切换（技能/工具、会话/网络搜索） |
| `List` | 展示类 | 会话列表、记忆列表 |
| `Descriptions` | 展示类 | Agent 详情展示 |
| `Space` | 基础 | 组件间距 |
| `Row/Col` | 基础 | 栅格布局 |
| `Tooltip` | 展示类 | 悬停提示 |
| `Avatar` | 展示类 | 头像、图标容器 |
| `Divider` | 基础 | 分割线 |
| `Dropdown` | 展示类 | 下拉菜单 |

---

## 七、参考链接

| 资源 | URL |
|------|-----|
| 官方文档 | https://semi.design/zh-CN |
| 设计变量 (Tokens) | https://semi.design/zh-CN/basic/tokens |
| 组件总览 | https://semi.design/zh-CN/start/overview |
| 暗色模式 | https://semi.design/zh-CN/advanced/dark-mode |
| 定制主题 (DSM) | https://semi.design/dsm |
| 图标搜索 | https://semi.design/zh-CN/basic/icon |
| GitHub | https://github.com/DouyinFE/semi-design |
| Figma 组件库 | https://www.figma.com/@semi |
