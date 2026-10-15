export default function AdminLoading() {
  return (
    <div className="space-y-6 max-w-7xl kin-m">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-lg kin-skel" />
        <div className="h-4 w-80 rounded-lg kin-skel" />
      </div>

      {/* Health cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl p-5 h-24 kin-skel" />
        ))}
      </div>

      {/* Two col */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl p-6 h-64 kin-skel" />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl p-6 space-y-3 kin-skel">
        <div className="h-5 w-48 rounded-lg kin-skel" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 rounded-xl kin-skel" />
        ))}
      </div>
    </div>
  );
}
