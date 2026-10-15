// FE-144 — khung chờ khi tải "Lớp của tôi" (server component tải số liệu từ DB).
// 15/10/2026: vệt sáng quét chung cả màn hình (.kin-skel, Lucian No.079) thay cho nhấp nháy.
export default function Loading() {
  const sk = "kin-skel kin-skel--soft";
  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }} aria-busy="true" aria-label="Đang tải">
      <div className="kin-m max-w-5xl mx-auto px-4 py-6">
        <div className={`h-8 w-48 rounded mb-6 ${sk}`} />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">{[0, 1, 2].map(i => <div key={i} className={`h-24 rounded-xl ${sk}`} />)}</div>
        <div className={`h-5 w-32 rounded mb-2 ${sk}`} />
        <div className="space-y-2 mb-6">{[0, 1].map(i => <div key={i} className={`h-12 rounded-xl ${sk}`} />)}</div>
        <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map(i => <div key={i} className={`h-36 rounded-xl ${sk}`} />)}</div>
      </div>
    </div>
  );
}
