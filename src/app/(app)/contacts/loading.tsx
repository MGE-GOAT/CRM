export default function Loading() {
  return (
    <div className="p-4 sm:p-6">
      <div className="animate-pulse space-y-3">
        <div className="h-10 w-full rounded-lg bg-gray-100" />
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <div className="h-8 w-8 shrink-0 rounded-full bg-gray-100" />
            <div className="h-4 flex-1 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
