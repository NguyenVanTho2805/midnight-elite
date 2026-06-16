export default function StudentLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Welcome banner skeleton */}
      <div className="rounded-3xl h-32" style={{ background: "#E2E8F4" }} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-5 w-36 rounded-lg" style={{ background: "#E2E8F4" }} />
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl p-5 space-y-3" style={{ background: "#E9EEF8" }}>
              <div className="flex justify-between">
                <div className="h-4 w-48 rounded-lg" style={{ background: "#D8E0EE" }} />
                <div className="h-4 w-10 rounded-lg" style={{ background: "#D8E0EE" }} />
              </div>
              <div className="h-2.5 rounded-full w-full" style={{ background: "#D8E0EE" }} />
              <div className="h-12 rounded-xl" style={{ background: "#D8E0EE" }} />
            </div>
          ))}
        </div>

        {/* Right col */}
        <div className="space-y-4">
          <div className="h-5 w-32 rounded-lg" style={{ background: "#E2E8F4" }} />
          <div className="rounded-2xl p-4 space-y-2" style={{ background: "#E9EEF8" }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 rounded-xl" style={{ background: "#D8E0EE" }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-2xl h-20" style={{ background: "#E9EEF8" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
