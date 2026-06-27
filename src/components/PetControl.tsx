import React, { useState, useEffect, useCallback } from 'react';
import { Button, Switch, Slider, Popover } from '@douyinfe/semi-ui';
import { IconGithubLogo } from '@douyinfe/semi-icons';
import { getPetState, setPetSize, setPetAiLink, togglePet } from '../lib/pet-bridge';
import type { PetPersistedState } from '../lib/pet-types';

const SIZE_MARKS: Record<number, string> = { 0.5: '小', 1: '中', 1.5: '大' };

export function PetControl(): React.ReactElement {
  const [state, setState] = useState<PetPersistedState | null>(null);

  useEffect(() => {
    getPetState()
      .then(setState)
      .catch(() => setState(null));
  }, []);

  const handleToggle = useCallback(async () => {
    const visible = await togglePet();
    setState((prev) => (prev ? { ...prev, enabled: visible } : null));
  }, []);

  const handleSizeChange = useCallback((value: number | number[] | undefined) => {
    if (value === undefined) return;
    const scale = Array.isArray(value) ? value[0] : value;
    setPetSize(scale);
    setState((prev) => (prev ? { ...prev, size: scale } : null));
  }, []);

  const handleAiLinkChange = useCallback(async (checked: boolean) => {
    await setPetAiLink(checked);
    setState((prev) => (prev ? { ...prev, aiLinkEnabled: checked } : null));
  }, []);

  const content = (
    <div style={{ padding: 8, minWidth: 200 }}>
      <div style={{ marginBottom: 12 }}>
        <Switch checked={state?.enabled ?? false} onChange={handleToggle} checkedText="开启" uncheckedText="关闭" />
      </div>
      {state?.enabled && (
        <>
          <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--semi-color-text-1)' }}>宠物大小</div>
          <Slider min={0.5} max={1.5} step={0.5} value={state.size} onChange={handleSizeChange} marks={SIZE_MARKS} />
          <div style={{ marginTop: 12 }}>
            <Switch
              checked={state.aiLinkEnabled}
              onChange={handleAiLinkChange}
              checkedText="AI 联动"
              uncheckedText="仅待机"
              size="small"
            />
          </div>
        </>
      )}
    </div>
  );

  return (
    <Popover content={content} trigger="click" position="bottomRight">
      <Button theme="borderless" icon={<IconGithubLogo />} type="tertiary">
        桌面宠物
      </Button>
    </Popover>
  );
}
