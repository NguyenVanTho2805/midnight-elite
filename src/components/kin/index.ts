// TK-183 (09/10/2026) — bộ component KiN (tokens --kin-*).
// Dùng trong các màn KiN mới. Component cũ ở src/components/ui/* vẫn
// hoạt động cho đến khi được migrate dần.
export { KinInput, type KinInputProps } from "./Input";
export { KinButton, kinButtonClass, type KinButtonProps, type KinButtonVariant } from "./Button";
export { KinStatus, STATUS_DOT, STATUS_TEXT, type StatusTone } from "./Status";
export { KinTabs, KinTabInner, KIN_TAB_BOX, type KinTabsProps, type KinTabItem } from "./Tabs";
export { KinToast, type KinToastProps, type ToastTone } from "./Toast";
export { KinConfirm, type KinConfirmProps } from "./Confirm";
export { useKinConfirm, type AskOptions } from "./useConfirm";
export { KinMark, KinLogo } from "./KinLogo";
export { KinLoader } from "./KinLoader";
export { KinCopyButton, type KinCopyButtonProps } from "./CopyButton";
export { KinFold, KinChevron } from "./Fold";
export { KinBookmark } from "./Bookmark";
export { KinSubmitButton } from "./SubmitButton";
export { LockCountdown } from "./LockCountdown";
export { CodeBoxes, type CodeBoxesProps } from "./CodeBoxes";
// 23/10/2026 — đợt dựng nền theo Figma (xem docs/kin/thiet-ke/COMPONENTS.md).
export { KinStat, KinStatRow } from "./Stat";
export { KinSectionHead } from "./SectionHead";
export { KinListRow, type KinListRowProps } from "./ListRow";
export { KinCallout } from "./Callout";
export { KinEmptyState } from "./EmptyState";
export { KinStateCard, KinSkeleton, type KinStateCardProps } from "./StateCard";
// 23/10/2026 — rà soát căn chỉnh trang gia sư: một bộ số đo chung.
export { KinPage, KinPageHeader, KinTwoCol, KinPageSkeleton, KinTableSkeleton, KIN_PAGE, KIN_TWO_COL, KIN_TABLE_HEAD, KIN_TABLE_ROW, KIN_FIELD, KIN_LABEL } from "./PageLayout";
// 24/10/2026 — khung dùng chung cho khối quan trọng (xem COMPONENTS.md).
export { KinPanel, type KinPanelVariant } from "./Panel";
// 24/10/2026 — HV-07 ẩn/hiện số tiền.
export { KinMoney, KinMoneyEye, useMoneyHidden, MONEY_HIDDEN_KEY } from "./MoneyVisibility";
// 24/10/2026 — HT-02 kiểm tra tại chỗ khi nhập (luật thuần ở src/lib/fieldRules.ts).
export { useFieldValidation } from "./useFieldValidation";
