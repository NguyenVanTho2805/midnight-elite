// TK-183 (09/10/2026) — bộ component KiN (tokens --kin-*).
// Dùng trong các màn KiN mới. Component cũ ở src/components/ui/* vẫn
// hoạt động cho đến khi được migrate dần.
export { KinInput, type KinInputProps } from "./Input";
export { KinButton, kinButtonClass, type KinButtonProps, type KinButtonVariant } from "./Button";
export { KinStatus, STATUS_DOT, STATUS_TEXT, type StatusTone } from "./Status";
export { KinTabs, KinTabInner, KIN_TAB_BOX, type KinTabsProps, type KinTabItem } from "./Tabs";
export { KinToast, type KinToastProps, type ToastTone } from "./Toast";
export { KinConfirm, type KinConfirmProps } from "./Confirm";
export { KinMark, KinLogo } from "./KinLogo";
export { CodeBoxes, type CodeBoxesProps } from "./CodeBoxes";
