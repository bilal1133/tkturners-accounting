type PieSlice = {
  value: number;
  color: string;
};

type PieShareChartProps = {
  slices: PieSlice[];
  size?: number;
  strokeWidth?: number;
  className?: string;
  ariaLabel?: string;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function PieShareChart({
  slices,
  size = 180,
  strokeWidth = 46,
  className,
  ariaLabel,
}: PieShareChartProps) {
  const normalized = slices
    .map((slice) => ({ ...slice, value: clampPercent(slice.value) }))
    .filter((slice) => slice.value > 0);

  const total = normalized.reduce((sum, slice) => sum + slice.value, 0);
  const center = size / 2;
  const radius = Math.max(0, (size - strokeWidth) / 2);
  const circumference = 2 * Math.PI * radius;

  let offsetAccumulator = 0;

  return (
    <svg
      className={className}
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label={ariaLabel || 'Pie chart'}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--chart-muted)"
        strokeWidth={strokeWidth}
      />
      {normalized.map((slice, index) => {
        const ratio = total > 0 ? slice.value / total : 0;
        const length = circumference * ratio;
        const dasharray = `${length} ${Math.max(circumference - length, 0)}`;
        const dashoffset = -offsetAccumulator;
        offsetAccumulator += length;

        return (
          <circle
            key={`${index}-${slice.color}`}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth={strokeWidth}
            strokeDasharray={dasharray}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        );
      })}
    </svg>
  );
}
