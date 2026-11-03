// BU-05 — biểu tượng nét 1.8px dùng currentColor (không màu cứng). Luôn đi kèm chữ, nên đặt aria-hidden.
import type { SVGProps } from "react";

const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const HeartIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" /></svg>;
export const CommentIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M20.5 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.5A8 8 0 1 1 20.5 11.5Z" /></svg>;
export const BookmarkIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M6.5 4h11v16.5L12 16.8 6.5 20.5V4Z" /></svg>;
export const FlagIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="M5 21V4m0 0h11l-2 4 2 4H5" /></svg>;
export const MoreIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} fill="currentColor" stroke="none" {...p}><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>;
export const ImageIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m4 18 5.5-5 4 3.5 2.5-2L20 17" /></svg>;
export const ClipIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base} {...p}><path d="m20 11-8.2 8.2a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.2a1.7 1.7 0 0 1-2.4-2.4L14.5 7" /></svg>;
