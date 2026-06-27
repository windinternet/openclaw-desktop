import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Steps, Button, Typography } from '@douyinfe/semi-ui';
import { useSettingsStore } from '../lib/settings-store';
import { PRESET_THEME_COLORS, DEFAULT_SETTINGS } from '../lib/settings-types';
import type { ThemeMode, SupportedLocale } from '../lib/settings-types';
import { applyTheme } from '../lib/theme';
import ConnectionWizard from './ConnectionWizard';

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

interface SetupWizardProps {
  onComplete: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  console.log('[SetupWizard] 🧩 COMPONENT MOUNTED');
  const { t } = useTranslation();

  const [currentStep, setCurrentStep] = useState(0);
  const [themeMode, setThemeMode] = useState<ThemeMode>(DEFAULT_SETTINGS.themeMode);
  const [themeColor, setThemeColor] = useState<string>(DEFAULT_SETTINGS.themeColor);
  const [locale, setLocale] = useState<SupportedLocale>(DEFAULT_SETTINGS.locale);

  const saveStepSelections = useCallback(
    (step: number) => {
      const store = useSettingsStore.getState();
      if (step === 0) {
        store.updateSettings({ themeMode, themeColor });
      } else if (step === 1) {
        store.updateSettings({ locale });
      }
    },
    [themeMode, themeColor, locale],
  );

  const handleNext = useCallback(() => {
    saveStepSelections(currentStep);
    setCurrentStep((prev) => Math.min(prev + 1, 2));
  }, [currentStep, saveStepSelections]);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleFinish = useCallback(() => {
    const settings = {
      ...DEFAULT_SETTINGS,
      themeMode,
      themeColor,
      locale,
    };
    useSettingsStore.getState().updateSettings(settings);
    useSettingsStore.getState().markInitialized();
    applyTheme(settings);
    onComplete();
  }, [themeMode, themeColor, locale, onComplete]);

  const isLastStep = currentStep === 2;

  return (
    <Modal
      visible={true}
      fullScreen={true}
      closable={false}
      maskClosable={false}
      footer={null}
      title={
        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" size="small">
            {t('wizard.subtitle')}
          </Text>
          <Text strong style={{ fontSize: 18, display: 'block', marginTop: 4 }}>
            {t('wizard.title')}
          </Text>
        </div>
      }
      bodyStyle={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)',
        padding: '24px 40px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          gap: 28,
        }}
      >
        <Steps current={currentStep} type="basic" style={{ flexShrink: 0 }}>
          <Steps.Step title={t('wizard.stepTheme')} />
          <Steps.Step title={t('wizard.stepLanguage')} />
          <Steps.Step title={t('wizard.stepConnection')} />
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
              <ConnectionWizard onConnected={() => {}} />
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
            <Button theme="solid" type="primary" onClick={handleNext}>
              {t('wizard.next')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
