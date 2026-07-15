import type { PhishingRiskLevel } from '@cyberguard/shared';

const LEVEL_COLOR: Record<PhishingRiskLevel, string> = {
  LOW: '#22c55e',      // --success
  MEDIUM: '#eab308',
  HIGH: '#f97316',
  CRITICAL: '#ef4444', // --danger
};

export function RiskScoreGauge({ score, level }: { score: number; level: PhishingRiskLevel }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const color = LEVEL_COLOR[level];

  return (
    <div className="risk-gauge">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius} fill="none" stroke="var(--border)" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={radius} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="70" y="64" textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--text)">{clamped}</text>
        <text x="70" y="84" textAnchor="middle" fontSize="11" fill="var(--text-muted)">/ 100</text>
      </svg>
      <div className="risk-level-badge" style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
        {level}
      </div>
    </div>
  );
}
