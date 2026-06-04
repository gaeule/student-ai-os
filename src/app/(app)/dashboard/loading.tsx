export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 통계 그리드 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="h-4 w-16 rounded bg-muted" />
            <div className="mt-2 h-8 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
      {/* 캘린더 */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="h-5 w-20 rounded bg-muted mb-3" />
        <div className="h-48 w-full rounded-lg bg-muted" />
      </div>
      {/* 과제 목록 */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="h-5 w-24 rounded bg-muted" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 w-full rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  );
}
