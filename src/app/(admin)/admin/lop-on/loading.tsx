export default function DangTaiLopOn() {
  return (
    <div className="max-w-7xl space-y-6" role="status" aria-label="Đang tải Lớp ôn">
      <div className="h-9 w-64 rounded-lg kin-skel" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-20 rounded-2xl kin-skel" />)}</div>
      <div className="h-64 rounded-2xl kin-skel" />
    </div>
  );
}
