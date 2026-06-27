import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildModelOptions,
  extractGatewayDefaultModel,
  formatModelOptionLabel,
  resolvePreferredModel,
} from '../lib/model-selection';
import type { AgentInfo, ModelInfo } from '../lib/types';

describe('model selection helpers', () => {
  const models: ModelInfo[] = [
    { id: 'deepseek-pro', provider: 'DeepSeek', name: 'Pro' },
    { id: 'deepseek-flash', provider: 'DeepSeek', name: 'Flash' },
    { id: 'gpt-4.1', provider: 'OpenAI', name: 'GPT 4.1', alias: 'GPT 4.1' },
  ];

  it('prefers the selected agent default model before the Gateway global default', () => {
    const agents: AgentInfo[] = [
      { id: 'main', default: true, model: { primary: 'deepseek-pro' } },
      { id: 'writer', model: { primary: 'deepseek-flash' } },
    ];

    expect(
      resolvePreferredModel({
        models,
        agents,
        selectedAgentId: 'writer',
        gatewayDefaultModel: 'gpt-4.1',
      }),
    ).toBe('DeepSeek/deepseek-flash');
  });

  it('falls back to the Gateway global default before the first configured model', () => {
    expect(
      resolvePreferredModel({
        models,
        agents: [],
        selectedAgentId: '',
        gatewayDefaultModel: 'gpt-4.1',
      }),
    ).toBe('OpenAI/gpt-4.1');
  });

  it('preserves an existing session model before applying defaults', () => {
    expect(
      resolvePreferredModel({
        models,
        agents: [{ id: 'main', model: { primary: 'deepseek-pro' } }],
        selectedAgentId: 'main',
        gatewayDefaultModel: 'gpt-4.1',
        sessionModel: 'session-model',
      }),
    ).toBe('session-model');
  });

  it('matches provider-qualified defaults against bare model list ids', () => {
    expect(
      resolvePreferredModel({
        models: [
          { id: 'deepseek-v4-flash', provider: 'deepseek', name: 'DeepSeek V4 Flash', alias: 'DeepSeek' },
          { id: 'mimo-v2.5-pro', provider: 'mimo', name: '小米 Mimo V2.5 Pro', alias: '小米 Mimo' },
        ],
        agents: [{ id: 'main', model: { primary: 'mimo/mimo-v2.5-pro' } }],
        selectedAgentId: 'main',
        gatewayDefaultModel: 'mimo/mimo-v2.5-pro',
      }),
    ).toBe('mimo/mimo-v2.5-pro');
  });

  it('formats model labels with provider, display name, and concrete model id', () => {
    expect(formatModelOptionLabel({ id: 'deepseek-pro', provider: 'DeepSeek', name: 'Pro' })).toBe(
      'DeepSeek / Pro · deepseek-pro',
    );
    expect(formatModelOptionLabel({ id: 'deepseek-flash', provider: 'DeepSeek', name: 'Flash' })).toBe(
      'DeepSeek / Flash · deepseek-flash',
    );
    expect(formatModelOptionLabel({ id: 'gpt-4.1', provider: 'OpenAI', name: 'gpt-4.1' })).toBe('OpenAI / gpt-4.1');
    expect(
      formatModelOptionLabel({
        id: 'deepseek-v4-flash',
        provider: 'deepseek',
        name: 'DeepSeek V4 Flash',
        alias: 'DeepSeek',
      }),
    ).toBe('deepseek / DeepSeek V4 Flash');
    expect(
      formatModelOptionLabel({ id: 'mimo-v2.5-pro', provider: 'mimo', name: '小米 Mimo V2.5 Pro', alias: '小米 Mimo' }),
    ).toBe('mimo / 小米 Mimo V2.5 Pro');
  });

  it('uses provider-qualified option values for chat configuration', () => {
    expect(buildModelOptions([{ id: 'deepseek-v4-flash', provider: 'deepseek', name: 'DeepSeek V4 Flash' }])).toEqual([
      { value: 'deepseek/deepseek-v4-flash', label: 'deepseek / DeepSeek V4 Flash' },
    ]);
  });

  it('extracts Gateway default model from config.get payloads', () => {
    expect(
      extractGatewayDefaultModel({
        parsed: { agents: { defaults: { model: { primary: 'deepseek-pro' } } } },
      }),
    ).toBe('deepseek-pro');
    expect(
      extractGatewayDefaultModel({
        parsed: { agents: { defaults: { model: 'gpt-4.1' } } },
      }),
    ).toBe('gpt-4.1');
  });

  it('documents new session and chat pages use shared model defaults and full labels', () => {
    const newSessionComposer = readFileSync('src/components/NewSessionComposer.tsx', 'utf8');
    const chat = readFileSync('src/pages/SessionChatPage.tsx', 'utf8');

    expect(newSessionComposer).toContain('resolvePreferredModel');
    expect(newSessionComposer).toContain('buildModelOptions');
    expect(newSessionComposer).not.toContain('setSelectedModel(models[0].id)');
    expect(chat).toContain('resolvePreferredModel');
    expect(chat).toContain('buildModelOptions');
    expect(chat).not.toContain('setChatModel(models[0].id)');
  });
});
