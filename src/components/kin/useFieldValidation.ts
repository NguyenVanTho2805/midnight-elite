// HT-02 — hook gắn luật kiểm tra (src/lib/fieldRules.ts) vào biểu mẫu: lỗi chỉ hiện sau khi người dùng rời ô (hoặc đã bấm gửi), rồi cập nhật theo từng phím.
// Dùng:  const fv = useFieldValidation({ email: [required("…"), email()] });
//        <KinInput {...fv.bind("email", value)} value={value} onChange=… />     // bind trả { error, onBlur }
//        onSubmit: if (!fv.validateAll({ email: value })) { fv.focusFirst(formEl); return; }
"use client";
import { useCallback, useState } from "react";
import { firstError, validateAll as run, type FieldRule } from "@/lib/fieldRules";

export function useFieldValidation(rules: Record<string, readonly FieldRule[]>) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  /** Gọi mỗi lần render với giá trị hiện tại của ô để biết lỗi tức thời. */
  const bind = useCallback((name: string, value: string) => {
    const error = touched[name] ? firstError(value, rules[name] ?? []) ?? undefined : undefined;
    return { error, onBlur: () => { setTouched(t => (t[name] ? t : { ...t, [name]: true })) } };
  }, [touched, rules]);

  /** Đánh dấu mọi ô đã chạm và trả true nếu không ô nào lỗi. */
  const validateAll = useCallback((vals: Record<string, string>) => {
    setTouched(Object.fromEntries(Object.keys(rules).map(k => [k, true])));
    return Object.keys(run(vals, rules)).length === 0;
  }, [rules]);

  /** Đưa tiêu điểm tới ô lỗi đầu tiên (sau khi giao diện đã vẽ lại lỗi). */
  const focusFirst = useCallback((root: HTMLElement | null) => {
    requestAnimationFrame(() => root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
  }, []);

  const reset = useCallback(() => setTouched({}), []);
  return { bind, validateAll, focusFirst, reset };
}
