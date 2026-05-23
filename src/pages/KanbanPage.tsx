import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Tag,
  Button,
  Modal,
  Form,
  Typography,
  Space,
  Toast,
  Tooltip,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconDelete,
  IconHandle,
  IconAlertCircle,
  IconServer,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import type { AgentInfo } from '../lib/types';
import type { KanbanCard, KanbanColumn } from '../lib/types';

const { Title, Text } = Typography;

const STORAGE_KEY = 'openclaw-kanban';
const COLUMN_DEFS = [
  { id: 'todo', title: '待办', icon: '📋' },
  { id: 'in_progress', title: '进行中', icon: '🔄' },
  { id: 'review', title: '审核中', icon: '👁️' },
  { id: 'done', title: '已完成', icon: '✅' },
] as const;

// ── Priority helpers ─────────────────────────────────────────────────

function getPriorityColor(p: string): 'red' | 'orange' | 'grey' {
  switch (p) {
    case 'high':
      return 'red';
    case 'medium':
      return 'orange';
    default:
      return 'grey';
  }
}

function getPriorityLabel(p: string): string {
  switch (p) {
    case 'high':
      return '高';
    case 'medium':
      return '中';
    default:
      return '低';
  }
}

function getColumnStyle(status: string): React.CSSProperties {
  const base: React.CSSProperties = {
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: 200,
    transition: 'background-color 0.2s, box-shadow 0.2s',
  };
  switch (status) {
    case 'todo':
      return { ...base, backgroundColor: 'rgba(var(--semi-blue-5-rgb), 0.06)' };
    case 'in_progress':
      return { ...base, backgroundColor: 'rgba(var(--semi-amber-5-rgb), 0.06)' };
    case 'review':
      return { ...base, backgroundColor: 'rgba(var(--semi-purple-5-rgb), 0.06)' };
    case 'done':
      return { ...base, backgroundColor: 'rgba(var(--semi-green-5-rgb), 0.06)' };
    default:
      return base;
  }
}

function getColumnBorder(status: string): string {
  switch (status) {
    case 'todo':
      return '1px solid rgba(var(--semi-blue-5-rgb), 0.15)';
    case 'in_progress':
      return '1px solid rgba(var(--semi-amber-5-rgb), 0.15)';
    case 'review':
      return '1px solid rgba(var(--semi-purple-5-rgb), 0.15)';
    case 'done':
      return '1px solid rgba(var(--semi-green-5-rgb), 0.15)';
    default:
      return '1px solid var(--semi-color-border)';
  }
}

function getColumnAccent(status: string): string {
  switch (status) {
    case 'todo':
      return 'var(--semi-color-primary)';
    case 'in_progress':
      return 'var(--semi-color-warning)';
    case 'review':
      return 'var(--semi-color-info)';
    case 'done':
      return 'var(--semi-color-success)';
    default:
      return 'var(--semi-color-text-2)';
  }
}

// ── Persistence ───────────────────────────────────────────────────────

function loadColumns(): KanbanColumn[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: KanbanColumn[] = JSON.parse(raw);
      // ensure all 4 columns exist
      const columnMap = new Map(parsed.map((c) => [c.id, c]));
      return COLUMN_DEFS.map((def) => {
        const existing = columnMap.get(def.id);
        return existing
          ? { ...existing, title: def.title }
          : { id: def.id, title: def.title, cards: [] };
      });
    }
  } catch {
    // fall through
  }
  return COLUMN_DEFS.map((def) => ({
    id: def.id,
    title: def.title,
    cards: [],
  }));
}

function saveColumns(columns: KanbanColumn[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
}

function generateCardId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Kanban Card Component ─────────────────────────────────────────────

interface KanbanCardItemProps {
  card: KanbanCard;
  agentName?: string;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, cardId: string, sourceStatus: string) => void;
}

function KanbanCardItem({ card, agentName, onDelete, onDragStart }: KanbanCardItemProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card.id, card.status)}
      style={{
        borderRadius: 10,
        backgroundColor: 'var(--semi-color-bg-1)',
        border: '1px solid var(--semi-color-border)',
        padding: '14px 16px',
        cursor: 'grab',
        transition: 'box-shadow 0.15s, transform 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Card header: drag handle + delete */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <IconHandle style={{ color: 'var(--semi-color-text-2)', fontSize: 14, cursor: 'grab' }} />
        <Tooltip content="删除卡片">
          <Button
            icon={<IconDelete />}
            size="small"
            theme="borderless"
            type="tertiary"
            style={{ color: 'var(--semi-color-text-2)', padding: 2, minWidth: 'unset' }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(card.id);
            }}
          />
        </Tooltip>
      </div>

      {/* Title */}
      <Text
        style={{
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--semi-color-text-0)',
          display: 'block',
          lineHeight: 1.4,
          marginBottom: 10,
          wordBreak: 'break-word',
        }}
      >
        {card.title}
      </Text>

      {/* Footer: priority + agent + date */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <Tag
          color={getPriorityColor(card.priority)}
          size="small"
          prefixIcon={<IconAlertCircle size="extra-small" />}
          style={{ textTransform: 'capitalize' }}
        >
          {getPriorityLabel(card.priority)}
        </Tag>
        {agentName && (
          <Tag
            type="light"
            size="small"
            prefixIcon={<IconServer size="extra-small" />}
            style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {agentName}
          </Tag>
        )}
        <Text type="tertiary" size="small" style={{ marginLeft: 'auto', fontSize: 11 }}>
          {new Date(card.createdAt).toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </div>
    </div>
  );
}

// ── Main Kanban Page ──────────────────────────────────────────────────

export default function KanbanPage() {
  const { t } = useTranslation();
  const agents = useStore((s) => s.agents);

  const [columns, setColumns] = useState<KanbanColumn[]>(() => loadColumns());
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addTargetColumn, setAddTargetColumn] = useState<string>('todo');
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const dragSourceRef = useRef<{ cardId: string; sourceStatus: string } | null>(null);

  // Persist on change
  useEffect(() => {
    saveColumns(columns);
  }, [columns]);

  // ── Drag & Drop handlers ─────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.DragEvent, cardId: string, sourceStatus: string) => {
      dragSourceRef.current = { cardId, sourceStatus };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', cardId);
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStatus(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetStatus: string) => {
      e.preventDefault();
      setDragOverStatus(null);

      const source = dragSourceRef.current;
      if (!source) return;
      if (source.sourceStatus === targetStatus) return;

      setColumns((prev) => {
        const newCols = prev.map((col) => ({
          ...col,
          cards: [...col.cards],
        }));

        const sourceCol = newCols.find((c) => c.id === source.sourceStatus);
        const targetCol = newCols.find((c) => c.id === targetStatus);
        if (!sourceCol || !targetCol) return prev;

        const cardIndex = sourceCol.cards.findIndex((c) => c.id === source.cardId);
        if (cardIndex === -1) return prev;

        const [movedCard] = sourceCol.cards.splice(cardIndex, 1);
        movedCard.status = targetStatus as KanbanCard['status'];
        movedCard.updatedAt = Date.now();
        targetCol.cards.push(movedCard);

        return newCols;
      });

      dragSourceRef.current = null;
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    setDragOverStatus(null);
    dragSourceRef.current = null;
  }, []);

  // ── Card CRUD ────────────────────────────────────────────────────

  const handleDeleteCard = useCallback((cardId: string) => {
    setColumns((prev) =>
      prev.map((col) => ({
        ...col,
        cards: col.cards.filter((c) => c.id !== cardId),
      })),
    );
    Toast.success('卡片已删除');
  }, []);

  const handleAddCard = useCallback(
    (values: Record<string, unknown>) => {
      const title = String(values.title ?? '').trim();
      if (!title) {
        Toast.error('请输入任务标题');
        return;
      }

      const newCard: KanbanCard = {
        id: generateCardId(),
        title,
        agentId: values.agentId ? String(values.agentId) : undefined,
        status: addTargetColumn as KanbanCard['status'],
        priority: (values.priority as KanbanCard['priority']) || 'medium',
        createdAt: Date.now(),
      };

      setColumns((prev) =>
        prev.map((col) =>
          col.id === addTargetColumn
            ? { ...col, cards: [...col.cards, newCard] }
            : col,
        ),
      );
      setAddModalVisible(false);
      Toast.success('卡片已添加');
    },
    [addTargetColumn],
  );

  const openAddModal = useCallback((status: string) => {
    setAddTargetColumn(status);
    setAddModalVisible(true);
  }, []);

  // ── Render helpers ───────────────────────────────────────────────

  const getAgentName = (agentId?: string): string | undefined => {
    if (!agentId) return undefined;
    const agent = agents.find((a: AgentInfo) => a.id === agentId);
    return agent?.name || agent?.id;
  };

  const cardCounts = columns.reduce(
    (acc, col) => {
      acc[col.id] = col.cards.length;
      return acc;
    },
    {} as Record<string, number>,
  );

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onDragEnd={handleDragEnd}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <div
        style={{
          padding: '20px 24px 16px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <Title heading={3} style={{ margin: 0 }}>
              📋 {t('nav.kanban')}
            </Title>
            <Text type="tertiary" size="small">
              {t('page.kanbanDesc')}
            </Text>
          </div>
          <Space>
            <Text type="tertiary" size="small">
              {columns.reduce((sum, col) => sum + col.cards.length, 0)} 张卡片
            </Text>
          </Space>
        </div>
      </div>

      {/* ── Board Columns ─────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '0 24px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        {columns.map((col) => (
          <div key={col.id} style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {/* Column Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
                padding: '0 4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{COLUMN_DEFS.find((d) => d.id === col.id)?.icon}</span>
                <Text
                  style={{
                    fontWeight: 700,
                    fontSize: 15,
                    color: 'var(--semi-color-text-0)',
                  }}
                >
                  {col.title}
                </Text>
                <Tag
                  size="small"
                  type="light"
                  style={{
                    borderRadius: 10,
                    minWidth: 22,
                    textAlign: 'center',
                    fontWeight: 600,
                  }}
                >
                  {cardCounts[col.id] ?? 0}
                </Tag>
              </div>
              <Button
                icon={<IconPlus />}
                size="small"
                theme="borderless"
                type="primary"
                onClick={() => openAddModal(col.id)}
                style={{ borderRadius: 6 }}
              />
            </div>

            {/* Droppable Column Area */}
            <div
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              style={{
                ...getColumnStyle(col.id),
                border: getColumnBorder(col.id),
                flex: 1,
                overflow: 'auto',
                outline: dragOverStatus === col.id
                  ? `2px dashed ${getColumnAccent(col.id)}`
                  : 'none',
                outlineOffset: -2,
              }}
            >
              {col.cards.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 120,
                    opacity: 0.4,
                    gap: 4,
                  }}
                >
                  <Text type="tertiary" size="small">
                    拖拽卡片到此处
                  </Text>
                </div>
              ) : (
                col.cards.map((card) => (
                  <KanbanCardItem
                    key={card.id}
                    card={card}
                    agentName={getAgentName(card.agentId)}
                    onDelete={handleDeleteCard}
                    onDragStart={handleDragStart}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Add Card Modal ───────────────────────────────────── */}
      <Modal
        title={`添加卡片 — ${COLUMN_DEFS.find((d) => d.id === addTargetColumn)?.title}`}
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={480}
        destroyOnClose
      >
        <Form onSubmit={handleAddCard} labelPosition="top" labelWidth={80}>
          <Form.Input
            field="title"
            label="任务标题"
            placeholder="输入任务标题…"
            rules={[{ required: true, message: '请输入任务标题' }]}
            style={{ width: '100%' }}
          />
          <Form.Select
            field="priority"
            label="优先级"
            style={{ width: '100%' }}
            initValue="medium"
          >
            <Form.Select.Option value="high">
              <Space>
                <Tag color="red" size="small">高</Tag>
                <span>高优先级</span>
              </Space>
            </Form.Select.Option>
            <Form.Select.Option value="medium">
              <Space>
                <Tag color="orange" size="small">中</Tag>
                <span>中优先级</span>
              </Space>
            </Form.Select.Option>
            <Form.Select.Option value="low">
              <Space>
                <Tag color="grey" size="small">低</Tag>
                <span>低优先级</span>
              </Space>
            </Form.Select.Option>
          </Form.Select>
          <Form.Select
            field="agentId"
            label="分配 Agent"
            placeholder="选择 Agent（可选）"
            style={{ width: '100%' }}
            showClear
          >
            {agents.map((a: AgentInfo) => (
              <Form.Select.Option key={a.id} value={a.id}>
                {a.name || a.id}
              </Form.Select.Option>
            ))}
          </Form.Select>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 16,
            }}
          >
            <Button onClick={() => setAddModalVisible(false)}>取消</Button>
            <Button type="primary" htmlType="submit">
              添加
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
