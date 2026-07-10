export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-5 sm:px-6">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-text">{title}</h1>
        {subtitle && (
          <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--gold-tint)] px-2.5 py-0.5 text-xs font-medium text-[color:var(--gold-ink)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--gold-mid)]" aria-hidden="true" />
            {subtitle}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}
