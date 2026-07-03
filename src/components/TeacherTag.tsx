type Props = {
  name: string;
  avatar: string;
  size?: number;                    // đường kính avatar (px), mặc định 28
  variant?: "onDark" | "onLight";   // nền tối (overlay trên ảnh/màu) hay nền sáng
  role?: string;                    // chú thích dưới tên, vd "Gia sư phụ trách"
  blur?: boolean;                   // backdrop-blur cho avatar (khi nền là ảnh)
  maxNameWidth?: number;            // px, giới hạn độ rộng tên khi không gian hẹp
  className?: string;
};

export default function TeacherTag({
  name, avatar, size = 28, variant = "onLight", role, blur, maxNameWidth, className = "",
}: Props) {
  const avatarStyle = variant === "onDark"
    ? { background: "rgba(255,255,255,0.25)", border: "2px solid rgba(255,255,255,0.6)", backdropFilter: blur ? "blur(4px)" : undefined }
    : { background: "linear-gradient(135deg, #0068FF, #2680FF)" };
  const nameColor = variant === "onDark" ? "rgba(255,255,255,0.85)" : role ? "#1E2938" : "#6B7280";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="rounded-full flex items-center justify-center font-black text-white flex-shrink-0"
        style={{ width: size, height: size, fontSize: size >= 34 ? 14 : 12, ...avatarStyle }}
      >
        {avatar}
      </div>
      <div className="min-w-0">
        <p
          className={`truncate ${role ? "text-sm font-bold" : "text-xs font-semibold"}`}
          style={{ color: nameColor, maxWidth: maxNameWidth, opacity: variant === "onDark" ? 0.85 : 1 }}
        >
          {name}
        </p>
        {role && <p className="text-xs truncate" style={{ color: "#9CA3AF" }}>{role}</p>}
      </div>
    </div>
  );
}
