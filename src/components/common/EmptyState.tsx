interface EmptyStateProps {
  title: string;
  hint?: string;
}

export function EmptyState({ title, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-3xl border border-dashed border-line px-6 py-12 text-center">
      <p className="text-base text-ink-soft">{title}</p>
      {hint ? <p className="text-sm text-ink-faint">{hint}</p> : null}
    </div>
  );
}
