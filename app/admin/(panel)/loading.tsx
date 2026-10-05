export default function AdminLoading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4">
      <div className="skeleton h-8 w-64" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-24" />)}</div>
      <div className="skeleton h-64" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
