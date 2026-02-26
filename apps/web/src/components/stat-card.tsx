import { formatMinor } from '@/lib/format';

type Props = {
  label: string;
  valueMinor: number;
  currency: string;
  tone?: 'default' | 'good' | 'bad';
};

export function StatCard({ label, valueMinor, currency, tone = 'default' }: Props) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <p>{label}</p>
      <h3>{formatMinor(valueMinor, currency)}</h3>
    </div>
  );
}
