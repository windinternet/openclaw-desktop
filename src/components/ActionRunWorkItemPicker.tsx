import { useCallback, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Button, Input, Select, Space, Toast, Typography } from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import type { WorkbenchWorkItemOption } from '../lib/workbench-work-items';

const { Text } = Typography;

interface ActionRunWorkItemPickerProps {
  description: ReactNode;
  selectPlaceholder: string;
  createLabel: string;
  createPlaceholder: string;
  createSuccessMessage: string;
  options: WorkbenchWorkItemOption[];
  selectedPath: string;
  onSelectedPathChange: (path: string) => void;
  createWorkItem: (title: string) => Promise<WorkbenchWorkItemOption>;
  disabled?: boolean;
  creating?: boolean;
  loading?: boolean;
  showCreate?: boolean;
  size?: 'small' | 'default' | 'large';
  style?: CSSProperties;
}

export function ActionRunWorkItemPicker({
  description,
  selectPlaceholder,
  createLabel,
  createPlaceholder,
  createSuccessMessage,
  options,
  selectedPath,
  onSelectedPathChange,
  createWorkItem,
  disabled = false,
  creating = false,
  loading = false,
  showCreate = true,
  size = 'default',
  style,
}: ActionRunWorkItemPickerProps) {
  const [newWorkItemTitle, setNewWorkItemTitle] = useState('');
  const trimmedTitle = newWorkItemTitle.trim();

  const handleCreateWorkItem = useCallback(async () => {
    if (!trimmedTitle || disabled || creating || !showCreate) return;

    try {
      await createWorkItem(trimmedTitle);
      setNewWorkItemTitle('');
      Toast.success(createSuccessMessage);
    } catch (error) {
      Toast.error(error instanceof Error ? error.message : String(error));
    }
  }, [createSuccessMessage, createWorkItem, creating, disabled, showCreate, trimmedTitle]);

  if (options.length === 0 && !showCreate) return null;

  return (
    <div style={{ display: 'grid', gap: 6, ...style }}>
      <Text type="tertiary" size="small">
        {description}
      </Text>
      {options.length > 0 ? (
        <Select
          size={size}
          value={selectedPath}
          placeholder={selectPlaceholder}
          onChange={(value) => onSelectedPathChange(String(value))}
          loading={loading}
          disabled={disabled || creating}
          style={{ width: '100%' }}
        >
          {options.map((item) => (
            <Select.Option key={item.path} value={item.path}>
              {item.name} · {item.path}
            </Select.Option>
          ))}
        </Select>
      ) : null}
      {showCreate ? (
        <Space spacing={8} align="center" style={{ width: '100%' }}>
          <Input
            size={size}
            value={newWorkItemTitle}
            placeholder={createPlaceholder}
            onChange={setNewWorkItemTitle}
            disabled={disabled || creating}
            style={{ flex: 1 }}
          />
          <Button
            size={size}
            icon={<IconPlus />}
            loading={creating}
            disabled={!trimmedTitle || disabled || creating}
            onClick={() => void handleCreateWorkItem()}
          >
            {createLabel}
          </Button>
        </Space>
      ) : null}
    </div>
  );
}
