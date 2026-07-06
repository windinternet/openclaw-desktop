import { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Steps, Button, Toast, Typography } from '@douyinfe/semi-ui';
import { IconBolt, IconBranch, IconTickCircle } from '@douyinfe/semi-icons';
import { useSettingsStore } from '../lib/settings-store';
import { PRESET_THEME_COLORS, DEFAULT_SETTINGS } from '../lib/settings-types';
import type { ThemeMode, SupportedLocale } from '../lib/settings-types';
import { applyTheme } from '../lib/theme';
import { useStore } from '../lib';
import i18n from '../i18n';
import ConnectionWizard from '../components/ConnectionWizard';
import WorkSystemWorkspaceChoice from '../components/WorkSystemWorkspaceChoice';
import type { RepositoryBinding } from '../lib/agentic-repository';
import {
  buildSkippedWorkspaceSessionState,
  WORK_SYSTEM_ONBOARDING_ANCHOR,
  WORK_SYSTEM_ONBOARDING_ROUTE,
} from '../lib/work-system-onboarding';
import { createFirstWorkbenchMatter } from '../lib/workbench-first-matter';

const { Title, Text } = Typography;

const THEME_MODES: { key: ThemeMode; emoji: string; labelKey: string }[] = [
  { key: 'light', emoji: '☀️', labelKey: 'wizard.lightMode' },
  { key: 'dark', emoji: '🌙', labelKey: 'wizard.darkMode' },
  { key: 'auto', emoji: '🖥️', labelKey: 'wizard.autoMode' },
];

const LANGUAGE_OPTIONS: { key: SupportedLocale; native: string; selfName: string }[] = [
  { key: 'zh-CN', native: '中文', selfName: '简体中文' },
  { key: 'en-US', native: 'English', selfName: 'English (US)' },
];

function getInitialStep(search: string): number {
  return new URLSearchParams(search).get('step') === 'workspace' ? 3 : 0;
}

export default function SetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const instances = useStore((s) => s.instances);
  const initialSettings = useSettingsStore.getState().settings;

  const [currentStep, setCurrentStep] = useState(() => getInitialStep(location.search));
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialSettings.themeMode);
  const [themeColor, setThemeColor] = useState<string>(initialSettings.themeColor);
  const [locale, setLocale] = useState<SupportedLocale>(initialSettings.locale);
  const [firstMatterDraft, setFirstMatterDraft] = useState('');
  const [firstMatterCreating, setFirstMatterCreating] = useState(false);

  useEffect(() => {
    const settings = { ...DEFAULT_SETTINGS, themeMode, themeColor, locale };
    useSettingsStore.getState().updateSettings({ themeMode, themeColor, locale });
    applyTheme(settings);
    i18n.changeLanguage(locale);
    document.documentElement.setAttribute('lang', locale);
  }, [themeMode, themeColor, locale]);

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleFinish = useCallback(() => {
    useSettingsStore.getState().markInitialized();
    navigate('/', { replace: true });
  }, [navigate]);

  const handleCreateFirstMatter = useCallback(
    async (binding: RepositoryBinding) => {
      const title = firstMatterDraft.trim();
      if (!title) {
        Toast.warning(t('dashboard.firstMatterRequired'));
        return;
      }

      setFirstMatterCreating(true);
      try {
        const matter = await createFirstWorkbenchMatter(binding, title);
        setFirstMatterDraft('');
        useSettingsStore.getState().markInitialized();
        Toast.success(t('dashboard.firstMatterCreated'));
        navigate(`/workbench?view=tasks&workItemPath=${encodeURIComponent(matter.path)}`, { replace: true });
      } catch (err) {
        Toast.error(err instanceof Error ? err.message : t('dashboard.firstMatterCreateFailed'));
      } finally {
        setFirstMatterCreating(false);
      }
    },
    [firstMatterDraft, navigate, t],
  );

  const handleSkipWorkspaceSetup = useCallback(() => {
    useSettingsStore.getState().markInitialized();
    Toast.info(t('dashboard.workspaceChoiceSkipToast'));
    navigate('/new-session', {
      replace: true,
      state: buildSkippedWorkspaceSessionState(firstMatterDraft, t('dashboard.workspaceChoiceSkip')),
    });
  }, [firstMatterDraft, navigate, t]);

  const handleConnectionReady = useCallback(() => {
    setCurrentStep(3);
    if (location.search !== '?step=workspace') {
      navigate(WORK_SYSTEM_ONBOARDING_ROUTE, { replace: true });
    }
  }, [location.search, navigate]);

  const isLastStep = currentStep === 3;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--semi-color-bg-0)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          gap: 28,
          padding: '24px 40px',
          maxWidth: currentStep === 3 ? 920 : 720,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div style={{ textAlign: 'center', flexShrink: 0, paddingTop: 32 }}>
          <Text type="secondary" size="small">
            {t('wizard.subtitle')}
          </Text>
          <Text strong style={{ fontSize: 18, display: 'block', marginTop: 4 }}>
            {t('wizard.title')}
          </Text>
        </div>

        <Steps current={currentStep} type="basic" style={{ flexShrink: 0 }}>
          <Steps.Step title={t('wizard.stepTheme')} />
          <Steps.Step title={t('wizard.stepLanguage')} />
          <Steps.Step title={t('wizard.stepConnection')} />
          <Steps.Step title={t('wizard.stepWorkspace')} />
        </Steps>

        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            paddingTop: 32,
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          {currentStep === 0 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 28,
                width: '100%',
                maxWidth: 560,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <Title heading={3} style={{ marginBottom: 8 }}>
                  {t('wizard.themeTitle')}
                </Title>
                <Text type="secondary">{t('wizard.themeDesc')}</Text>
              </div>

              <div style={{ display: 'flex', gap: 14, width: '100%' }}>
                {THEME_MODES.map((mode) => {
                  const isSelected = themeMode === mode.key;
                  return (
                    <div
                      key={mode.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setThemeMode(mode.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setThemeMode(mode.key);
                      }}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 10,
                        padding: '24px 12px',
                        borderRadius: 12,
                        border: `2px solid ${isSelected ? 'var(--semi-color-primary)' : 'var(--semi-color-border)'}`,
                        backgroundColor: isSelected
                          ? 'var(--semi-color-primary-light-default)'
                          : 'var(--semi-color-fill-0)',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s, background-color 0.2s',
                        outline: 'none',
                      }}
                    >
                      <span style={{ fontSize: 32, lineHeight: 1 }}>{mode.emoji}</span>
                      <Text strong={isSelected} style={{ color: isSelected ? 'var(--semi-color-primary)' : undefined }}>
                        {t(mode.labelKey)}
                      </Text>
                    </div>
                  );
                })}
              </div>

              <div style={{ width: '100%', textAlign: 'center' }}>
                <Text type="secondary" size="small" style={{ display: 'block', marginBottom: 14 }}>
                  {t('wizard.themeColor')}
                </Text>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 20,
                    flexWrap: 'wrap',
                  }}
                >
                  {PRESET_THEME_COLORS.map((color) => {
                    const isSelected = themeColor === color.name;
                    return (
                      <div
                        key={color.name}
                        role="button"
                        tabIndex={0}
                        onClick={() => setThemeColor(color.name)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') setThemeColor(color.name);
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            backgroundColor: color.value,
                            border: isSelected ? '2px solid var(--semi-color-text-0)' : '2px solid transparent',
                            boxShadow: isSelected ? `0 0 0 3px ${color.value}40` : 'none',
                            transition: 'box-shadow 0.2s, border-color 0.2s',
                          }}
                        />
                        <Text
                          size="small"
                          style={{
                            textTransform: 'capitalize',
                            color: isSelected ? 'var(--semi-color-primary)' : 'var(--semi-color-text-2)',
                          }}
                        >
                          {color.name}
                        </Text>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 28,
                width: '100%',
                maxWidth: 560,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <Title heading={3} style={{ marginBottom: 8 }}>
                  {t('wizard.languageTitle')}
                </Title>
                <Text type="secondary">{t('wizard.languageDesc')}</Text>
              </div>

              <div style={{ display: 'flex', gap: 14, width: '100%' }}>
                {LANGUAGE_OPTIONS.map((lang) => {
                  const isSelected = locale === lang.key;
                  return (
                    <div
                      key={lang.key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setLocale(lang.key)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') setLocale(lang.key);
                      }}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        padding: '28px 12px',
                        borderRadius: 12,
                        border: `2px solid ${isSelected ? 'var(--semi-color-primary)' : 'var(--semi-color-border)'}`,
                        backgroundColor: isSelected
                          ? 'var(--semi-color-primary-light-default)'
                          : 'var(--semi-color-fill-0)',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s, background-color 0.2s',
                        outline: 'none',
                      }}
                    >
                      <Text
                        strong
                        style={{
                          fontSize: 20,
                          color: isSelected ? 'var(--semi-color-primary)' : undefined,
                        }}
                      >
                        {lang.native}
                      </Text>
                      <Text type="tertiary" size="small">
                        {lang.selfName}
                      </Text>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 20,
                width: '100%',
                maxWidth: 560,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <Title heading={3} style={{ marginBottom: 8 }}>
                  {t('wizard.connectionTitle')}
                </Title>
                <Text type="secondary">{t('wizard.connectionDesc')}</Text>
              </div>
              <ConnectionWizard
                onConnected={() => {
                  handleConnectionReady();
                }}
              />
            </div>
          )}

          {currentStep === 3 && (
            <div
              id={WORK_SYSTEM_ONBOARDING_ANCHOR}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 20,
                width: '100%',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <Title heading={3} style={{ marginBottom: 8 }}>
                  {t('dashboard.onboardingTitle')}
                </Title>
                <Text type="secondary">{t('dashboard.onboardingDesc')}</Text>
              </div>

              <div className="dashboard-onboarding-steps">
                <div className="dashboard-onboarding-step dashboard-onboarding-step-done">
                  <span className="dashboard-onboarding-step-icon">
                    <IconTickCircle />
                  </span>
                  <span>
                    <Text strong>{t('dashboard.onboardingGatewayDone')}</Text>
                    <Text type="tertiary" size="small">
                      {t('dashboard.onboardingGatewayDoneDesc')}
                    </Text>
                  </span>
                </div>
                <div className="dashboard-onboarding-step dashboard-onboarding-step-active">
                  <span className="dashboard-onboarding-step-icon">
                    <IconBranch />
                  </span>
                  <span>
                    <Text strong>{t('dashboard.onboardingRepositoryNext')}</Text>
                    <Text type="tertiary" size="small">
                      {t('dashboard.onboardingRepositoryNextDesc')}
                    </Text>
                  </span>
                </div>
                <div className="dashboard-onboarding-step">
                  <span className="dashboard-onboarding-step-icon">
                    <IconBolt />
                  </span>
                  <span>
                    <Text strong>{t('dashboard.onboardingFirstThingNext')}</Text>
                    <Text type="tertiary" size="small">
                      {t('dashboard.onboardingFirstThingNextDesc')}
                    </Text>
                  </span>
                </div>
              </div>

              <WorkSystemWorkspaceChoice
                firstMatterDraft={firstMatterDraft}
                firstMatterCreating={firstMatterCreating}
                onFirstMatterDraftChange={setFirstMatterDraft}
                onCreateFirstMatter={(binding) => {
                  void handleCreateFirstMatter(binding);
                }}
                onSkipWorkspace={handleSkipWorkspaceSetup}
              />
            </div>
          )}
        </div>

        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 0 8px',
          }}
        >
          <Button
            onClick={handlePrev}
            disabled={currentStep === 0}
            theme="borderless"
            type="tertiary"
            style={{
              visibility: currentStep === 0 ? 'hidden' : 'visible',
              minWidth: 72,
            }}
          >
            {t('wizard.back')}
          </Button>

          {isLastStep ? (
            <Button theme="solid" type="primary" size="large" onClick={handleFinish}>
              {t('wizard.finish')}
            </Button>
          ) : (
            <Button
              theme="solid"
              type="primary"
              onClick={handleNext}
              disabled={currentStep === 2 && instances.length === 0}
            >
              {t('wizard.next')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
