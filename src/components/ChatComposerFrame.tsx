import type { CSSProperties, ReactNode } from 'react';

interface ChatComposerFrameProps {
  variant: 'new-session' | 'session-chat';
  children: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
  active?: boolean;
  className?: string;
  cardClassName?: string;
  style?: CSSProperties;
  cardStyle?: CSSProperties;
}

const rootClassByVariant: Record<ChatComposerFrameProps['variant'], string> = {
  'new-session': 'new-session-bottom-composer',
  'session-chat': 'session-chat-composer-shell',
};

const frameClassByVariant: Record<ChatComposerFrameProps['variant'], string> = {
  'new-session': 'chat-composer-frame--new-session',
  'session-chat': 'chat-composer-frame--session-chat',
};

const cardClassByVariant: Record<ChatComposerFrameProps['variant'], string> = {
  'new-session': 'new-session-composer-card',
  'session-chat': 'session-chat-composer-card',
};

function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export default function ChatComposerFrame({
  variant,
  children,
  before,
  after,
  active = false,
  className,
  cardClassName,
  style,
  cardStyle,
}: ChatComposerFrameProps) {
  return (
    <div
      className={classNames(
        'chat-composer-frame',
        frameClassByVariant[variant],
        rootClassByVariant[variant],
        active && 'chat-composer-frame--active',
        className,
      )}
      style={style}
    >
      {before ? <div className="chat-composer-frame__before">{before}</div> : null}
      <div
        className={classNames(
          'chat-composer-frame__card',
          cardClassByVariant[variant],
          cardClassName,
        )}
        style={cardStyle}
      >
        {children}
      </div>
      {after ? <div className="chat-composer-frame__after">{after}</div> : null}
    </div>
  );
}
