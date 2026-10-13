"use client";

export function GpaBar({ value }: { value: number }) {
  const pct   = Math.min((value / 10) * 100, 100);
  const color = value >= 8 ? "var(--kin-tt-chu-xong)" : value >= 6 ? "var(--kin-tt-chu-cho)" : "var(--kin-tt-chu-loi)";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-200">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold w-8 text-right" style={{ color }}>{value.toFixed(1)}</span>
    </div>
  );
}
