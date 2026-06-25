import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'info' | 'success' | 'danger' | 'warning';

const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-primary/10 text-primary',
  success: 'bg-emerald-100 text-emerald-700',
  danger: 'bg-destructive/10 text-destructive',
  warning: 'bg-amber-100 text-amber-700',
};

export function StatusBadge({
  label,
  tone = 'neutral',
  className,
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
