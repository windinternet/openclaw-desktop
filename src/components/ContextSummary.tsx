import { Collapse, Typography } from '@douyinfe/semi-ui';

const { Text } = Typography;

export default function ContextSummary({ summary }: { summary: string }) {
  return (
    <Collapse style={{ marginBottom: 8 }}>
      <Collapse.Panel header="上下文摘要" itemKey="context-summary">
        <Text
          type="tertiary"
          size="small"
          style={{ display: 'block', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
        >
          {summary}
        </Text>
      </Collapse.Panel>
    </Collapse>
  );
}
