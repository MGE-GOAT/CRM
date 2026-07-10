export default function Loading() {
  return (
    <div className="animate-pulse">
      {/* Header — mirrors PageHeader (title + gold count chip + controls). */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-5 sm:px-6">
        <div className="space-y-2">
          <div className="h-6 w-28 rounded bg-surface-3" />
          <div className="h-5 w-24 rounded-full bg-[var(--gold-tint)]" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-9 w-48 rounded-lg bg-surface-2" />
          <div className="h-9 w-32 rounded-lg bg-surface-2" />
          <div className="h-9 w-28 rounded-lg bg-surface-3" />
        </div>
      </div>

      {/* Floated panel table skeleton. */}
      <div className="p-4 sm:p-6">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-md)]">
          <div className="border-b-2 border-[color:var(--rule)] bg-surface-2 px-4 py-3">
            <div className="h-3.5 w-20 rounded bg-surface-3" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                <div className="h-8 w-8 shrink-0 rounded-full bg-surface-3" />
                <div className="h-4 w-40 rounded bg-surface-3" />
                <div className="ms-auto hidden h-4 w-24 rounded bg-surface-2 sm:block" />
                <div className="hidden h-4 w-28 rounded bg-surface-2 lg:block" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
