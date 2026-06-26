import { useEffect, useMemo, useState } from 'react';
import { Typography } from '@douyinfe/semi-ui';
import {
  IconBolt,
  IconCalendarClock,
  IconCheckList,
  IconClock,
  IconFile,
  IconFolderOpen,
  IconPlusCircle,
} from '@douyinfe/semi-icons';
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
  tone: LaunchCardTone;
}

type LaunchCardTone = 'coral' | 'sky' | 'peach' | 'violet' | 'gold' | 'mint';

interface LaunchCard extends StarterPrompt {
  source: 'starter' | 'workbench';
}

export default function NewSessionPage() {
  const { t } = useTranslation();
  const connectionStatus = useStore((s) => s.connectionStatus);
  const currentInstanceId = useStore((s) => s.currentInstanceId);
  const actionRunsVersion = useStore((s) => s.actionRunsVersion);

  const [workbenchSnapshot, setWorkbenchSnapshot] = useState<WorkbenchSnapshot | null>(null);
  const [workbenchLoading, setWorkbenchLoading] = useState(false);
  const [starterMessage, setStarterMessage] = useState('');
  const [starterMessageKey, setStarterMessageKey] = useState(0);
  const [starterLabel, setStarterLabel] = useState('');

  useEffect(() => {
    let cancelled = false;
    setWorkbenchSnapshot(null);

    if (!currentInstanceId) {
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
      })
      .catch(() => undefined)
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
        id: 'reminder-task',
        title: t('newSessionPage.scenarioReminderTitle'),
        description: t('newSessionPage.scenarioReminderDesc'),
        message: t('newSessionPage.scenarioReminderPrompt'),
        icon: <IconClock />,
        tone: 'coral',
      },
      {
        id: 'plan-day',
        title: t('newSessionPage.scenarioPlanTitle'),
        description: t('newSessionPage.scenarioPlanDesc'),
        message: t('newSessionPage.scenarioPlanPrompt'),
        icon: <IconCheckList />,
        tone: 'sky',
      },
      {
        id: 'knowledge-update',
        title: t('newSessionPage.scenarioKnowledgeTitle'),
        description: t('newSessionPage.scenarioKnowledgeDesc'),
        message: t('newSessionPage.scenarioKnowledgePrompt'),
        icon: <IconFile />,
        tone: 'peach',
      },
      {
        id: 'review-delivery',
        title: t('newSessionPage.scenarioReviewTitle'),
        description: t('newSessionPage.scenarioReviewDesc'),
        message: t('newSessionPage.scenarioReviewPrompt'),
        icon: <IconBolt />,
        tone: 'violet',
      },
      {
        id: 'schedule-day',
        title: t('newSessionPage.scenarioScheduleTitle'),
        description: t('newSessionPage.scenarioScheduleDesc'),
        message: t('newSessionPage.scenarioSchedulePrompt'),
        icon: <IconCalendarClock />,
        tone: 'gold',
      },
    ],
    [t],
  );

  const workbenchContinuations = useMemo(
    () => buildNewSessionWorkbenchContinuations(workbenchSnapshot, 2),
    [workbenchSnapshot],
  );

  const launchCards = useMemo<LaunchCard[]>(() => {
    const continuationCards = workbenchContinuations.map((item: NewSessionWorkbenchContinuation, index) => ({
      id: item.id,
      title: item.title,
      description: t('newSessionPage.workbenchCardDesc', { source: item.meta }),
      message: item.message,
      icon: <IconFolderOpen />,
      tone: (index === 0 ? 'mint' : 'violet') as LaunchCardTone,
      source: 'workbench' as const,
    }));
    return [...continuationCards, ...starterPrompts.map((prompt) => ({ ...prompt, source: 'starter' as const }))].slice(
      0,
      5,
    );
  }, [starterPrompts, t, workbenchContinuations]);

  const applyStarterMessage = (message: string, label: string) => {
    setStarterMessage(message);
    setStarterLabel(label);
    setStarterMessageKey((value) => value + 1);
  };

  const renderLaunchCard = (card: LaunchCard) => (
    <button
      key={card.id}
      type="button"
      className={`new-session-launch-card new-session-launch-card--${card.tone}`}
      onClick={() => applyStarterMessage(card.message, card.title)}
    >
      <span className="new-session-card-body">
        <span className="new-session-card-title">{card.title}</span>
        <span className="new-session-card-desc">{card.description}</span>
      </span>
      <span className="new-session-card-visual" aria-hidden="true">
        <span className="new-session-card-illustration">
          <span className="new-session-card-icon">{card.icon}</span>
          <span className="new-session-card-line new-session-card-line-a" />
          <span className="new-session-card-line new-session-card-line-b" />
          <span className="new-session-card-chip" />
        </span>
      </span>
    </button>
  );

  return (
    <div className="new-session-page">
      <div className="new-session-shell">
        <main className="new-session-launch">
          <section className="new-session-hero">
            <div className="new-session-logo-mark">
              <IconPlusCircle size="extra-large" />
              <span className="new-session-logo-spark">✦</span>
            </div>
            <Title heading={1} className="new-session-brand-title">
              {t('newSessionPage.title')}
            </Title>
            <Text className="new-session-hero-subtitle">{t('newSessionPage.subtitle')}</Text>
          </section>

          <section className="new-session-card-row" aria-label={t('newSessionPage.quickStartTitle')}>
            {launchCards.map(renderLaunchCard)}
          </section>
        </main>

        <section className="new-session-bottom-composer">
          {connectionStatus !== 'connected' && (
            <div className="new-session-connection-warning">
              {connectionStatus === 'connecting' ? t('connection.connecting') : t('connection.notConnected')}
            </div>
          )}

          <div className="new-session-composer-card">
            {starterLabel || workbenchLoading ? (
              <div className="new-session-composer-hint">
                {starterLabel
                  ? t('newSessionPage.starterApplied', { title: starterLabel })
                  : t('newSessionPage.loadingWorkbench')}
              </div>
            ) : null}
            <NewSessionComposer
              inputKeyPrefix="new-session-page"
              initialMessage={starterMessage}
              initialMessageKey={starterMessageKey}
              style={{
                width: '100%',
                borderRadius: 16,
              }}
            />
          </div>
          <Text className="new-session-disclaimer">{t('newSessionPage.disclaimer')}</Text>
        </section>
      </div>
    </div>
  );
}
