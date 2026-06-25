import { Avatar } from '@douyinfe/semi-ui';
import type { AgentInfo } from '../lib/types';
import { getAgentAvatarValue, getAgentDisplayName } from '../lib/agent-presentation';

function isImageAvatar(value: string): boolean {
  return /^(https?:|data:|file:|blob:)/i.test(value) || value.startsWith('/');
}

export default function AgentSelectOption({ agent }: { agent: AgentInfo }) {
  const name = getAgentDisplayName(agent);
  const avatar = getAgentAvatarValue(agent);
  const imageAvatar = isImageAvatar(avatar);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <Avatar size="extra-small" src={imageAvatar ? avatar : undefined} style={{ flexShrink: 0 }}>
        {imageAvatar ? name.charAt(0).toUpperCase() : avatar}
      </Avatar>
      <div style={{ minWidth: 0, lineHeight: 1.25 }}>
        <span
          className="agent-select-option-name"
          title={name}
          style={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 13,
            color: 'var(--semi-color-text-0)',
          }}
        >
          {name}
        </span>
      </div>
    </div>
  );
}
