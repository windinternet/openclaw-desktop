import { useEffect, useMemo, useState } from 'react';
import { Button, Empty, Tag, Typography } from '@douyinfe/semi-ui';
import { IconBolt, IconCheckList, IconFile, IconPlusCircle } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { useStore } from '../lib';
import NewSessionComposer from '../components/NewSessionComposer';
import { loadRepositoryBinding } from '../lib/agentic-repository-store';
import { buildNewSessionWorkbenchContinuations, type NewSessionWorkbenchContinuation } from '../lib/new-session';
import { loadWorkbenchSnapshot, type WorkbenchSnapshot } from '../lib/repository-workbench';

const { Title, Text } = Typography;

interface StarterPrompt {
  id: string;
  title: string;
  description: string;
  message: string;
  icon: JSX.Element;
}

export default function NewSessionPage() {
  const { t } = useTranslation();
  const connectionStatus = useStore((s) => s.connectionStatus);
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const actionRunsVersion = useStore((s) => s.actionRunsVersion);

  const [workbenchSnapshot, setWorkbenchSnapshot] = useState<WorkbenchSnapshot | null>(null);
  const [workbenchLoading, setWorkbenchLoading] = useState(false);
  const [workbenchUnavailable, setWorkbenchUnavailable] = useState(false);
  const [starterMessage, setStarterMessage] = useState('');
  const [starterMessageKey, setStarterMessageKey] = useState(0);
  const [starterLabel, setStarterLabel] = useState('');

  useEffect(() => {
    let cancelled = false;
    setWorkbenchSnapshot(null);
    setWorkbenchUnavailable(false);

    if (!currentInstanceId) {
      setWorkbenchUnavailable(true);
      return () => {
        cancelled = true;
      };
    }

    setWorkbenchLoading(true);
    void loadRepositoryBinding(currentInstanceId)
      .then((binding) => (binding ? loadWorkbenchSnapshot(binding) : null))
      .then((snapshot) => {
        if (cancelled) return;
        setWorkbenchSnapshot(snapshot);
        setWorkbenchUnavailable(!snapshot);
      })
      .catch(() => {
        if (!cancelled) setWorkbenchUnavailable(true);
      })
      .finally(() => {
        if (!cancelled) setWorkbenchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentInstanceId, actionRunsVersion]);

  const starterPrompts = useMemo<StarterPrompt[]>(
    () => [
      {
        id: 'plan-day',
        title: t('newSessionPage.scenarioPlanTitle'),
        description: t('newSessionPage.scenarioPlanDesc'),
        message: t('newSessionPage.scenarioPlanPrompt'),
        icon: <IconCheckList />,
      },
      {
        id: 'review-delivery',
        title: t('newSessionPage.scenarioReviewTitle'),
        description: t('newSessionPage.scenarioReviewDesc'),
        message: t('newSessionPage.scenarioReviewPrompt'),
        icon: <IconBolt />,
      },
      {
        id: 'knowledge-update',
        title: t('newSessionPage.scenarioKnowledgeTitle'),
        description: t('newSessionPage.scenarioKnowledgeDesc'),
        message: t('newSessionPage.scenarioKnowledgePrompt'),
        icon: <IconFile />,
      },
    ],
    [t],
  );

  const workbenchContinuations = useMemo(
    () => buildNewSessionWorkbenchContinuations(workbenchSnapshot, 5),
    [workbenchSnapshot],
  );

  const applyStarterMessage = (message: string, label: string) => {
    setStarterMessage(message);
    setStarterLabel(label);
    setStarterMessageKey((value) => value + 1);
  };

  const renderStarterCard = (prompt: StarterPrompt) => (
    <button
      key={prompt.id}
      type="button"
      className="new-session-starter-card"
      onClick={() => applyStarterMessage(prompt.message, prompt.title)}
    >
      <span className="new-session-card-icon">{prompt.icon}</span>
      <span className="new-session-card-body">
        <span className="new-session-card-title">{prompt.title}</span>
        <span className="new-session-card-desc">{prompt.description}</span>
      </span>
      <span className="new-session-card-action">{t('newSessionPage.useScenario')}</span>
    </button>
  );

  const renderWorkbenchCard = (item: NewSessionWorkbenchContinuation) => (
    <button
      key={item.id}
      type="button"
      className="new-session-workbench-card"
      onClick={() => applyStarterMessage(item.message, item.title)}
    >
      <span className="new-session-workbench-card-main">
        <span className="new-session-workbench-title">{item.title}</span>
        <span className="new-session-workbench-path">{item.sourcePath}</span>
      </span>
      <span className="new-session-workbench-meta">
        <Tag size="small" color={item.kind === 'task' ? 'blue' : 'green'}>
          {item.meta}
        </Tag>
        <span>{t('newSessionPage.continueWork')}</span>
      </span>
    </button>
  );

  return (
    <div className="new-session-page">
      <div className="new-session-shell">
        <header className="new-session-header">
          <div className="new-session-title-row">
            <div className="new-session-title-icon">
              <IconPlusCircle size="extra-large" />
            </div>
            <div>
              <Title heading={3} style={{ margin: 0 }}>
                {t('newSessionPage.title')}
              </Title>
              <Text type="tertiary">{t('newSessionPage.subtitle')}</Text>
            </div>
          </div>
          <Tag color="green" size="large">
            {t('chat.newSession')}
          </Tag>
        </header>

        {connectionStatus !== 'connected' && (
          <div className="new-session-connection-warning">
            {connectionStatus === 'connecting' ? t('connection.connecting') : t('connection.notConnected')}
          </div>
        )}

        <div className="new-session-layout">
          <main className="new-session-main">
            <section className="new-session-section">
              <div className="new-session-section-heading">
                <div>
                  <Text strong>{t('newSessionPage.quickStartTitle')}</Text>
                  <Text type="tertiary" size="small">
                    {t('newSessionPage.quickStartDesc')}
                  </Text>
                </div>
              </div>
              <div className="new-session-starter-grid">{starterPrompts.map(renderStarterCard)}</div>
            </section>

            <section className="new-session-composer-section">
              <div className="new-session-section-heading">
                <div>
                  <Text strong>{t('newSessionPage.composerTitle')}</Text>
                  <Text type="tertiary" size="small">
                    {starterLabel
                      ? t('newSessionPage.starterApplied', { title: starterLabel })
                      : t('newSessionPage.composerDesc')}
                  </Text>
                </div>
              </div>
              <NewSessionComposer
                inputKeyPrefix="new-session-page"
                initialMessage={starterMessage}
                initialMessageKey={starterMessageKey}
                style={{
                  width: '100%',
                  borderRadius: 8,
                }}
              />
            </section>
          </main>

          <aside className="new-session-workbench-panel">
            <div className="new-session-section-heading">
              <div>
                <Text strong>{t('newSessionPage.workbenchContinuations')}</Text>
                <Text type="tertiary" size="small">
                  {t('newSessionPage.workbenchContinuationsDesc')}
                </Text>
              </div>
              <Tag size="small" color="blue">
                {workbenchContinuations.length}
              </Tag>
            </div>

            {workbenchLoading ? (
              <div className="new-session-workbench-state">
                <Text type="tertiary">{t('newSessionPage.loadingWorkbench')}</Text>
              </div>
            ) : workbenchContinuations.length > 0 ? (
              <div className="new-session-workbench-list">{workbenchContinuations.map(renderWorkbenchCard)}</div>
            ) : (
              <Empty
                title={t('newSessionPage.noWorkbenchTitle')}
                description={
                  workbenchUnavailable
                    ? t('newSessionPage.noWorkbenchBindingDesc')
                    : t('newSessionPage.noWorkbenchDesc')
                }
              >
                <Button
                  type="tertiary"
                  onClick={() =>
                    applyStarterMessage(t('newSessionPage.scenarioPlanPrompt'), t('newSessionPage.scenarioPlanTitle'))
                  }
                >
                  {t('newSessionPage.useScenario')}
                </Button>
              </Empty>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
