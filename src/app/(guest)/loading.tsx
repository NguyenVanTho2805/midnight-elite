export default function GuestLoading() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-7xl mx-auto kin-m">
      {/* Header block */}
      <div className="text-center mb-10 space-y-3">
        <div className="h-5 w-40 rounded-full mx-auto kin-skel" />
        <div className="h-8 w-72 rounded-xl mx-auto kin-skel" />
        <div className="h-4 w-96 rounded-lg mx-auto kin-skel" />
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-3xl h-64 kin-skel" />
        ))}
      </div>
    </div>
  );
}
