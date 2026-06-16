export default function AdminLoading() {
  return (
    <div className="space-y-6 max-w-7xl animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-lg" style={{ background: "#E2E8F4" }} />
        <div className="h-4 w-80 rounded-lg" style={{ background: "#E2E8F4" }} />
      </div>

      {/* Health cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl p-5 h-24" style={{ background: "#E9EEF8" }} />
        ))}
      </div>

      {/* Two col */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl p-6 h-64" style={{ background: "#E9EEF8" }} />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl p-6 space-y-3" style={{ background: "#E9EEF8" }}>
        <div className="h-5 w-48 rounded-lg" style={{ background: "#D8E0EE" }} />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 rounded-xl" style={{ background: "#D8E0EE" }} />
        ))}
      </div>
    </div>
  );
}
