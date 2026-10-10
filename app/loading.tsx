export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="h-8 w-32 animate-pulse rounded bg-surface-2" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card flex flex-col gap-2 py-3">
          <div className="h-4 w-2/3 animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
        </div>
      ))}
    </div>
  );
}
