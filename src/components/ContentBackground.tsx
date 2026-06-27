import { memo } from 'react';

const PARTICLE_POSITIONS = [
  '15% 22%',
  '28% 45%',
  '42% 12%',
  '55% 78%',
  '68% 34%',
  '82% 55%',
  '95% 18%',
  '8% 62%',
  '35% 88%',
  '50% 50%',
  '72% 6%',
  '90% 72%',
  '5% 85%',
  '45% 35%',
  '75% 92%',
  '20% 70%',
  '60% 25%',
  '85% 40%',
  '12% 50%',
  '38% 65%',
];

function ContentBackground() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* Orb 1 — top-right, primary/indigo tint */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          top: -60,
          right: -40,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--semi-color-primary) 0%, transparent 70%)',
          filter: 'blur(100px)',
          opacity: 0.16,
          pointerEvents: 'none',
          animation: 'bg-orb-1 25s ease-in-out infinite alternate',
        }}
      />

      {/* Orb 2 — bottom-left, info/cyan tint */}
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          bottom: -50,
          left: -50,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--semi-color-info) 0%, transparent 70%)',
          filter: 'blur(80px)',
          opacity: 0.14,
          pointerEvents: 'none',
          animation: 'bg-orb-2 30s ease-in-out infinite alternate',
        }}
      />

      {/* Orb 3 — center-right, violet/purple tint */}
      <div
        style={{
          position: 'absolute',
          width: 350,
          height: 350,
          top: '35%',
          right: '6%',
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--semi-color-danger) 0%, transparent 70%)',
          filter: 'blur(90px)',
          opacity: 0.1,
          pointerEvents: 'none',
          animation: 'bg-orb-3 20s ease-in-out infinite alternate',
        }}
      />

      {/* Subtle particle dots */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: PARTICLE_POSITIONS.map(
            (pos) => `radial-gradient(2px 2px at ${pos}, var(--semi-color-text-2) 0%, transparent 100%)`,
          ).join(', '),
          backgroundRepeat: 'no-repeat',
          opacity: 0.2,
          animation: 'bg-particles-pulse 8s ease-in-out infinite',
        }}
      />

      <style>{`
        @keyframes bg-orb-1 {
          0%   { transform: translate(0, 0) scale(1); }
          33%  { transform: translate(-24px, 16px) scale(1.06); }
          66%  { transform: translate(16px, -12px) scale(0.94); }
          100% { transform: translate(-12px, 22px) scale(1.02); }
        }
        @keyframes bg-orb-2 {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(28px, -18px) scale(1.08); }
          100% { transform: translate(-16px, 12px) scale(0.92); }
        }
        @keyframes bg-orb-3 {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-18px, -20px) scale(1.06); }
        }
        @keyframes bg-particles-pulse {
           0%, 100% { opacity: 0.14; }
           50%      { opacity: 0.26; }
        }
      `}</style>
    </div>
  );
}

export default memo(ContentBackground);
