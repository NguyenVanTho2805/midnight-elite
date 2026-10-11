// FE-144 — khung chờ khi tải "Lớp của tôi" (server component tải số liệu từ DB).
export default function Loading() {
  const bar = { background: "var(--kin-nen-nhan)" } as const;
  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }} aria-busy="true" aria-label="Đang tải">
      <div className="max-w-5xl mx-auto px-4 py-6 animate-pulse">
        <div className="h-8 w-48 rounded mb-6" style={bar} />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">{[0, 1, 2].map(i => <div key={i} className="h-24 rounded-xl" style={bar} />)}</div>
        <div className="h-5 w-32 rounded mb-2" style={bar} />
        <div className="space-y-2 mb-6">{[0, 1].map(i => <div key={i} className="h-12 rounded-xl" style={bar} />)}</div>
        <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map(i => <div key={i} className="h-36 rounded-xl" style={bar} />)}</div>
      </div>
    </div>
  );
}
