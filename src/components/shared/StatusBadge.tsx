import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'info' | 'success' | 'danger' | 'warning';

// Semantic tokens, so a badge reads correctly in both themes. The washes are
// defined per theme in globals.css rather than mixed from the foreground here.
const TONES: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-info-wash text-info',
  success: 'bg-success-wash text-success',
  danger: 'bg-danger-wash text-danger',
  warning: 'bg-warning-wash text-warning',
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
