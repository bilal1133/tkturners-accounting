type ProgressMeterProps = {
  value: number;
  max?: number;
  className?: string;
  ariaLabel?: string;
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function ProgressMeter({ value, max = 100, className, ariaLabel }: ProgressMeterProps) {
  const normalizedMax = Number.isFinite(max) && max > 0 ? max : 100;
  const normalizedValue = clamp(value, 0, normalizedMax);

  return (
    <progress
      className={className ? `progress-meter ${className}` : 'progress-meter'}
      value={normalizedValue}
      max={normalizedMax}
      aria-label={ariaLabel || 'Progress'}
    />
  );
}
