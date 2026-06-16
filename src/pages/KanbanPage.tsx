import { forwardRef, useImperativeHandle, useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { CSSProperties, DragEvent } from 'react';
import {
  Card,
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
import { useStore } from '../lib';
import type { AgentInfo } from '../lib/types';
import type { KanbanCard, KanbanColumn } from '../lib/types';
import { loadInstanceData, saveInstanceData } from '../lib/local-persistence';

const { Text } = Typography;

function agentNameString(name: unknown): string {
  if (typeof name === 'string') return name;
  return '';
}

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

function getColumnStyle(status: string): CSSProperties {
  const base: CSSProperties = {
    borderRadius: 8,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    minHeight: 260,
    flex: 1,
    transition: 'background-color 0.2s, box-shadow 0.2s',
  };
  switch (status) {
    case 'todo':
      return { ...base, backgroundColor: 'rgba(var(--semi-blue-5-rgb), 0.055)' };
    case 'in_progress':
      return { ...base, backgroundColor: 'rgba(var(--semi-amber-5-rgb), 0.060)' };
    case 'review':
      return { ...base, backgroundColor: 'rgba(var(--semi-purple-5-rgb), 0.065)' };
    case 'done':
      return { ...base, backgroundColor: 'rgba(var(--semi-green-5-rgb), 0.060)' };
    default:
      return base;
  }
}

interface KanbanColumnPanelStyle {
  card: CSSProperties;
  header: CSSProperties;
  body: CSSProperties;
  shadows?: 'hover' | 'always';
  bordered?: boolean;
}

function getKanbanColumnPanelStyle(status: string): KanbanColumnPanelStyle {
  const baseCard: CSSProperties = {
    height: '100%',
    minHeight: 420,
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: 'rgba(var(--semi-white), 0.88)',
    border: '1px solid rgba(var(--semi-grey-4-rgb), 0.68)',
    boxShadow: '0 0px 10px rgba(0, 0, 0, 0.18)',
    backdropFilter: 'blur(10px)',
  };
  const baseHeader: CSSProperties = {
    padding: '14px 16px 13px',
    borderBottom: '1px solid rgba(var(--semi-grey-3-rgb), 0.45)',
  };
  const baseBody: CSSProperties = {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
  };

  switch (status) {
    case 'todo':
      return {
        card: {
          ...baseCard,
          borderTop: '4px solid var(--semi-color-primary)',
        },
        header: {
          ...baseHeader,
          backgroundColor: 'rgba(var(--semi-blue-5-rgb), 0.085)',
        },
        body: baseBody,
      };
    case 'in_progress':
      return {
        card: {
          ...baseCard,
          borderTop: '4px solid var(--semi-color-warning)',
        },
        header: {
          ...baseHeader,
          backgroundColor: 'rgba(var(--semi-amber-5-rgb), 0.090)',
        },
        body: baseBody,
      };
    case 'review':
      return {
        card: {
          ...baseCard,
          borderTop: '4px solid var(--semi-color-tertiary)',
        },
        header: {
          ...baseHeader,
          backgroundColor: 'rgba(var(--semi-purple-5-rgb), 0.090)',
        },
        body: baseBody,
      };
    case 'done':
      return {
        card: {
          ...baseCard,
          borderTop: '4px solid var(--semi-color-success)',
        },
        header: {
          ...baseHeader,
          backgroundColor: 'rgba(var(--semi-green-5-rgb), 0.085)',
        },
        body: baseBody,
      };
    default:
      return {
        card: baseCard,
        header: baseHeader,
        body: baseBody,
      };
  }
}

interface KanbanCardVisualStyle {
  wrapper: CSSProperties;
  card: CSSProperties;
  body: CSSProperties;
  handle: CSSProperties;
  title: CSSProperties;
  accent?: CSSProperties;
  shadows?: 'hover' | 'always';
  bordered?: boolean;
}

function getKanbanCardVisualStyle(status: string): KanbanCardVisualStyle {
  const baseWrapper: CSSProperties = {
    position: 'relative',
    cursor: 'grab',
    transition: 'transform 0.15s',
    userSelect: 'none',
  };
  const baseCard: CSSProperties = {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'var(--semi-color-bg-1)',
  };
  const baseBody: CSSProperties = {
    padding: '14px 16px',
  };
  const baseTitle: CSSProperties = {
    fontWeight: 600,
    fontSize: 14,
    color: 'var(--semi-color-text-0)',
    display: 'block',
    lineHeight: 1.4,
    marginBottom: 10,
    wordBreak: 'break-word',
  };

  switch (status) {
    case 'in_progress':
      return {
        wrapper: baseWrapper,
        card: {
          ...baseCard,
          border: '1px solid rgba(var(--semi-amber-5-rgb), 0.24)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        },
        body: baseBody,
        handle: { color: 'var(--semi-color-warning)' },
        title: baseTitle,
        shadows: 'hover',
      };
    case 'review':
      return {
        wrapper: baseWrapper,
        card: {
          ...baseCard,
          border: '1px solid rgba(var(--semi-purple-5-rgb), 0.18)',
          backgroundColor: 'rgba(var(--semi-purple-5-rgb), 0.06)',
        },
        body: { ...baseBody, paddingLeft: 18 },
        handle: { color: 'var(--semi-color-info)' },
        title: { ...baseTitle, color: 'var(--semi-color-text-0)' },
        accent: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: 'var(--semi-color-info)',
        },
      };
    case 'done':
      return {
        wrapper: baseWrapper,
        card: {
          ...baseCard,
          backgroundColor: 'rgba(var(--semi-green-5-rgb), 0.07)',
          border: '1px solid rgba(var(--semi-green-5-rgb), 0.16)',
        },
        body: { ...baseBody, padding: '12px 14px' },
        handle: { color: 'var(--semi-color-success)' },
        title: { ...baseTitle, fontWeight: 500 },
        bordered: false,
      };
    default:
      return {
        wrapper: baseWrapper,
        card: {
          ...baseCard,
          border: '1px solid var(--semi-color-border)',
        },
        body: baseBody,
        handle: { color: 'var(--semi-color-text-2)' },
        title: baseTitle,
      };
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

function createDefaultColumns(): KanbanColumn[] {
  return COLUMN_DEFS.map((def) => ({
    id: def.id,
    title: def.title,
    cards: [],
  }));
}

function normalizeColumns(columns: KanbanColumn[] | null): KanbanColumn[] {
  if (!columns) return createDefaultColumns();
  const columnMap = new Map(columns.map((c) => [c.id, c]));
  return COLUMN_DEFS.map((def) => {
    const existing = columnMap.get(def.id);
    return existing
      ? { ...existing, title: def.title }
      : { id: def.id, title: def.title, cards: [] };
  });
}

function generateCardId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Kanban Card Component ─────────────────────────────────────────────

interface KanbanCardItemProps {
  card: KanbanCard;
  agentName?: string;
  onDelete: (id: string) => void;
  onDragStart: (e: DragEvent, cardId: string, sourceStatus: string) => void;
}

function KanbanCardItem({ card, agentName, onDelete, onDragStart }: KanbanCardItemProps) {
  const { t } = useTranslation();
  const visualStyle = getKanbanCardVisualStyle(card.status);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, card.id, card.status)}
      style={visualStyle.wrapper}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {visualStyle.accent && <span style={visualStyle.accent} />}
      <Card
        bordered={visualStyle.bordered}
        shadows={visualStyle.shadows}
        style={visualStyle.card}
        bodyStyle={visualStyle.body}
        headerStyle={{ display: 'none' }}
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
          <IconHandle style={{ ...visualStyle.handle, fontSize: 14, cursor: 'grab' }} />
          <Tooltip content={t('kanban.deleteCard')}>
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
        <Text style={visualStyle.title}>
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
      </Card>
    </div>
  );
}

// ── Main Kanban Page ──────────────────────────────────────────────────

export interface KanbanPageHandle {
  getCardCount(): number;
}

const KanbanPage = forwardRef<KanbanPageHandle, { embedded?: boolean }>(function KanbanPage({ embedded: _embedded = false }, ref) {
  const { t } = useTranslation();
  const agents = useStore((s) => s.agents);
  const currentInstanceId = useStore((s) => s.currentInstanceId);

  const [columns, setColumns] = useState<KanbanColumn[]>(() => createDefaultColumns());
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addTargetColumn, setAddTargetColumn] = useState<string>('todo');
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const dragSourceRef = useRef<{ cardId: string; sourceStatus: string } | null>(null);
  const loadedInstanceRef = useRef<string | null>(null);

  // Hydrate board for the active OpenClaw instance. React state remains the responsive source.
  useEffect(() => {
    let cancelled = false;
    loadedInstanceRef.current = null;

    if (!currentInstanceId) {
      Promise.resolve().then(() => {
        if (!cancelled) setColumns(createDefaultColumns());
      });
      return () => {
        cancelled = true;
      };
    }

    loadInstanceData<KanbanColumn[]>(currentInstanceId, 'kanban')
      .then((storedColumns) => {
        if (cancelled) return;
        setColumns(normalizeColumns(storedColumns));
        loadedInstanceRef.current = currentInstanceId;
      })
      .catch(() => {
        if (cancelled) return;
        setColumns(createDefaultColumns());
        loadedInstanceRef.current = currentInstanceId;
      });

    return () => {
      cancelled = true;
    };
  }, [currentInstanceId]);

  // Persist on change without blocking in-memory updates.
  useEffect(() => {
    if (!currentInstanceId || loadedInstanceRef.current !== currentInstanceId) return;
    saveInstanceData(currentInstanceId, 'kanban', columns);
  }, [columns, currentInstanceId]);

  // ── Drag & Drop handlers ─────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: DragEvent, cardId: string, sourceStatus: string) => {
      dragSourceRef.current = { cardId, sourceStatus };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', cardId);
    },
    [],
  );

  const handleDragOver = useCallback((e: DragEvent, status: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStatus(null);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent, targetStatus: string) => {
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
    Toast.success(t('kanban.cardDeleted'));
  }, [t]);

  const handleAddCard = useCallback(
    (values: Record<string, unknown>) => {
      const title = String(values.title ?? '').trim();
      if (!title) {
        Toast.error(t('kanban.cardTitleRequired'));
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
      Toast.success(t('kanban.cardAdded'));
    },
    [addTargetColumn, t],
  );

  const openAddModal = useCallback((status: string) => {
    setAddTargetColumn(status);
    setAddModalVisible(true);
  }, []);

  // ── Render helpers ───────────────────────────────────────────────

  const getAgentName = (agentId?: string): string | undefined => {
    if (!agentId) return undefined;
    const agent = agents.find((a: AgentInfo) => a.id === agentId);
    return agentNameString(agent?.name) || agent?.id;
  };

  useImperativeHandle(ref, () => ({
    getCardCount: () => columns.reduce((sum, col) => sum + col.cards.length, 0),
  }), [columns]);

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
      {/* ── Board Columns ─────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '10px 24px 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        {columns.map((col) => {
          const columnStyle = getKanbanColumnPanelStyle(col.id);
          const columnTitle = (
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
          );

          return (
          <Card
            key={col.id}
            bordered={columnStyle.bordered}
            shadows={columnStyle.shadows}
            title={columnTitle}
            headerExtraContent={
              <Button
                icon={<IconPlus />}
                size="small"
                theme="borderless"
                type="primary"
                onClick={() => openAddModal(col.id)}
                style={{ borderRadius: 6 }}
              />
            }
            style={columnStyle.card}
            headerStyle={columnStyle.header}
            bodyStyle={columnStyle.body}
          >
            <div
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              style={{
                ...getColumnStyle(col.id),
                border: getColumnBorder(col.id),
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
                    {t('kanban.dragHere')}
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
          </Card>
          );
        })}
      </div>

      {/* ── Add Card Modal ───────────────────────────────────── */}
      <Modal
        title={t('kanban.addCardFor', { title: COLUMN_DEFS.find((d) => d.id === addTargetColumn)?.title })}
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={480}
        destroyOnClose
      >
        <Form onSubmit={handleAddCard} labelPosition="top" labelWidth={80}>
          <Form.Input
            field="title"
            label={t('kanban.cardTitle')}
            placeholder={t('kanban.cardTitlePlaceholder')}
            rules={[{ required: true, message: t('kanban.cardTitleRequired') }]}
            style={{ width: '100%' }}
          />
          <Form.Select
            field="priority"
            label={t('kanban.cardPriority')}
            style={{ width: '100%' }}
            initValue="medium"
          >
            <Form.Select.Option value="high">
              <Space>
                <Tag color="red" size="small">{t('kanban.priorityHigh')}</Tag>
                <span>{t('kanban.priorityHigh')}</span>
              </Space>
            </Form.Select.Option>
            <Form.Select.Option value="medium">
              <Space>
                <Tag color="orange" size="small">{t('kanban.priorityMedium')}</Tag>
                <span>{t('kanban.priorityMedium')}</span>
              </Space>
            </Form.Select.Option>
            <Form.Select.Option value="low">
              <Space>
                <Tag color="grey" size="small">{t('kanban.priorityLow')}</Tag>
                <span>{t('kanban.priorityLow')}</span>
              </Space>
            </Form.Select.Option>
          </Form.Select>
          <Form.Select
            field="agentId"
            label={t('kanban.assignAgent')}
            placeholder={t('kanban.assignAgentPlaceholder')}
            style={{ width: '100%' }}
            showClear
          >
            {agents.map((a: AgentInfo) => (
              <Form.Select.Option key={a.id} value={a.id}>
                {agentNameString(a.name) || a.id}
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
            <Button onClick={() => setAddModalVisible(false)}>{t('common.cancel')}</Button>
            <Button type="primary" htmlType="submit">
              {t('kanban.add')}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
});

KanbanPage.displayName = 'KanbanPage';

export default KanbanPage;
