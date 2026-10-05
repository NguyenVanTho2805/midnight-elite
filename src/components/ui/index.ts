// Barrel export cho design system FE-091 → FE-097 (2.1.2).
// Import gọn: `import { Table, Drawer, ConfirmModal, useToast } from "@/components/ui";`

export { Table } from "./Table";
export type { TableColumn, TablePagination, TableProps } from "./Table";

export { Drawer } from "./Drawer";
export type { DrawerAction, DrawerProps } from "./Drawer";

export { ConfirmModal } from "./ConfirmModal";
export type { ConfirmModalProps } from "./ConfirmModal";

export { ToastProvider, useToast } from "./Toast";

export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";

export { ErrorState } from "./ErrorState";
export type { ErrorStateProps } from "./ErrorState";

export { SkeletonBlock, SkeletonPrimitive, SkeletonCourseCard, SkeletonLessonRow, SkeletonDashboardCard, SkeletonTable } from "./Skeleton";
export type { SkeletonVariant, SkeletonVariantProps } from "./Skeleton";
