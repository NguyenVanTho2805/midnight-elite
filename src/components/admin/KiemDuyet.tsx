// Giữ lại để vỏ quản trị (AdminShell, tệp chung do COO giữ) vẫn nhập được QUEUE_CHANGED từ đường cũ.
// Nội dung thật đã chuyển sang HangCho.tsx (BU-08). Khi COO đổi AdminShell sang nhập từ "@/components/admin/HangCho" thì xoá tệp này.
export { QUEUE_CHANGED } from "./HangCho";
