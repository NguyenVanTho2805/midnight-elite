// HP-LOP-TRUONG — chữ cảnh báo / thông điệp do máy chủ trả (có thể chứa số tiền như "Đơn giá riêng 45.000đ cao hơn…").
// Công tắc "ẩn số tiền" (KinMoney) chỉ che số được bọc, nên mỗi số tiền trong câu được bọc riêng; phần chữ còn lại giữ nguyên.
"use client";
import { KinMoney } from "@/components/kin/MoneyVisibility";

/** "45.000đ", "1.250.000đ", "300000đ". Nhóm bắt để split() giữ lại phần số tiền ở vị trí lẻ. */
const MONEY_RE = /(\d{1,3}(?:\.\d{3})+đ|\d+đ)/g;

export default function BangHocPhiChu({ text }: { text: string }) {
  const parts = text.split(MONEY_RE);
  return <>{parts.map((p, i) => (i % 2 === 1 ? <KinMoney key={i}>{p}</KinMoney> : p))}</>;
}
