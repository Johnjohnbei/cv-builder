/**
 * ScoreGauge — SVG circular gauge displaying a score 0-100.
 * Color tiers: green (75+), orange (50-74), red (<50).
 * Design System atom.
 */

interface ScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

/** Return hex color based on score tier. */
function getScoreColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

export function ScoreGauge({
  score,
  size = 120,
  strokeWidth = 8,
  label,
  className,
}: ScoreGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const color = getScoreColor(clamped);
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={`Score: ${clamped}${label ? ` - ${label}` : ''}`}
    >
      {/* Background ring */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={strokeWidth}
      />
      {/* Foreground arc */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
      {/* Score number */}
      <text
        x={center}
        y={label ? center - 4 : center}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.28}
        fontWeight="bold"
        fill={color}
      >
        {clamped}
      </text>
      {/* Optional label */}
      {label && (
        <text
          x={center}
          y={center + size * 0.16}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * 0.11}
          fill="#6b7280"
        >
          {label}
        </text>
      )}
    </svg>
  );
}
