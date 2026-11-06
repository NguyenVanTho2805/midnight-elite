# -*- coding: utf-8 -*-
import json, io, os, unicodedata, re, sys

# Chạy được từ bất kỳ thư mục nào: đọc/ghi cạnh chính file này.
THU_MUC = os.path.dirname(os.path.abspath(__file__))
NGUON = os.path.join(THU_MUC, "bien-figma.json")
DICH = os.path.join(THU_MUC, "tokens.css")

DATA = json.load(io.open(NGUON, encoding="utf-8"))

def ascii_kebab(s):
    s = s.replace("đ","d").replace("Đ","D")
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower().replace("/", "-").replace(" ", "-")
    s = re.sub(r"[^a-z0-9-]", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s

SHORT = {
    "khoang-cach": "kc", "bo-goc": "bo", "vung-cham": "cham",
    "chu-trang-thai": "tt-chu", "cham-trang-thai": "tt-cham",
    "thuong-hieu": "th", "phan-he": "ph",
}
def cssname(v):
    k = ascii_kebab(v)
    for long, short in SHORT.items():
        if k.startswith(long + "-"):
            k = short + "-" + k[len(long)+1:]
            break
    return "--kin-" + k

mau   = DATA["Màu"]["vars"]
sodo  = DATA["Số đo"]["vars"]
chude = DATA["Chủ đề"]["vars"]
chu   = DATA["Chữ"]["vars"]

# Tám bậc theo thứ tự to → nhỏ. Tên bậc lấy từ Figma, không gõ tay.
BAC = [n.split("/", 1)[1] for n in chu if n.startswith("cỡ/")]

# Chuỗi dự phòng cho từng họ chữ. Brand book: Be Vietnam Pro dự phòng Plus Jakarta Sans.
DU_PHONG = {
    "Be Vietnam Pro": '"Be Vietnam Pro", "Plus Jakarta Sans", system-ui, sans-serif',
    "Inter": '"Inter", system-ui, "Segoe UI", sans-serif',
    "JetBrains Mono": '"JetBrains Mono", ui-monospace, "SFMono-Regular", monospace',
}
def ho(ten):
    if ten not in DU_PHONG:
        sys.exit("Họ chữ lạ trong Figma: %r — thêm chuỗi dự phòng vào DU_PHONG." % ten)
    return DU_PHONG[ten]

def so(x):
    # 39.8 → "39.8", 16.0 → "16", 23.0 → "23"
    x = round(float(x), 2)
    return ("%g" % x)

def gia_tri(ten):
    return chu[ten]["Giá trị"]

THEMES = [("Navy","navy"),("Cổ vịt","co-vit"),("Mận","man"),("Cà phê","ca-phe"),("Mực","muc")]

def block(pairs, indent="  "):
    return "\n".join(indent + k + ": " + v + ";" for k, v in pairs)

L = []
L.append("/* ============================================================")
L.append("   KiN — token giao diện")
L.append("   Sinh tự động từ file Figma KiN Design System (2orXvoHL2upkiGoMjlq8aX).")
L.append("   ĐỪNG SỬA TAY. Sửa biến trong Figma rồi sinh lại file này.")
L.append("")
L.append("   Cách dùng:")
L.append("     <html data-chu-de=\"navy\">                  chủ đề mặc định")
L.append("     <html data-chu-de=\"co-vit\" data-che-do=\"toi\">")
L.append("   Không đặt data-che-do thì tự theo cài đặt của máy.")
L.append("   ============================================================ */")
L.append("")

# ---- :root : màu sáng + số đo + chủ đề Navy sáng
pairs = [("/* nền, viền, chữ — chế độ sáng */","")]
rows = []
for name, vals in mau.items():
    rows.append((cssname(name), vals["Sáng"]))
L.append(":root {")
L.append("  /* --- Màu nền, viền, chữ (chế độ sáng) --- */")
L.append(block(rows))
L.append("")
L.append("  /* --- Số đo --- */")
L.append(block([(cssname(n), str(v["Giá trị"]) + "px") for n, v in sodo.items()]))
L.append("")
L.append("  /* --- Chữ: thang Minor Third 1.200, tám bậc (Figma: bộ biến Chữ) ---")
L.append("     Không chế thêm cỡ ở giữa; cần to hơn thì lên bậc.")
L.append("     Nội dung đề thi BẮT BUỘC dùng body: 16px, dòng 1,6.")
L.append("     Dùng gọn nhất:  font: var(--kin-kieu-body);  */")
L.append(block([("--kin-co-" + b, so(gia_tri("cỡ/" + b)) + "px") for b in BAC]))
L.append(block([("--kin-dong-" + b, so(gia_tri("dòng/" + b))) for b in BAC]))
L.append(block([("--kin-dam-" + b, so(gia_tri("đậm/" + b))) for b in BAC]))
L.append(block([("--kin-ho-" + b, ho(gia_tri("họ/" + b))) for b in BAC]))
L.append(block([("--kin-ho-ma", ho(gia_tri("họ/mã")))]))
L.append("  /* kiểu gộp cho thuộc tính font: đậm cỡ/dòng họ */")
L.append(block([("--kin-kieu-" + b, "%s %spx/%s %s" % (so(gia_tri("đậm/" + b)), so(gia_tri("cỡ/" + b)),
                 so(gia_tri("dòng/" + b)), ho(gia_tri("họ/" + b)))) for b in BAC]))
L.append("")
L.append("  /* --- Chủ đề mặc định: Navy, chế độ sáng --- */")
L.append(block([(cssname(n), v["Navy · Sáng"]) for n, v in chude.items()]))
L.append("}")
L.append("")

# ---- chế độ tối
dark_rows = [(cssname(n), v["Tối"]) for n, v in mau.items()]
L.append("/* ---------- Chế độ tối ---------- */")
L.append(":root[data-che-do=\"toi\"] {")
L.append(block(dark_rows))
L.append("}")
L.append("")
L.append("@media (prefers-color-scheme: dark) {")
L.append("  :root:not([data-che-do=\"sang\"]) {")
L.append(block(dark_rows, "    "))
L.append("  }")
L.append("}")
L.append("")

# ---- 5 chủ đề
L.append("/* ---------- Năm chủ đề ---------- */")
L.append("/* Chủ đề CHỈ đổi màu nhấn. Xanh lá, vàng, đỏ trạng thái không bao giờ đổi. */")
for ten, slug in THEMES:
    L.append("")
    L.append("/* %s */" % ten)
    L.append(":root[data-chu-de=\"%s\"] {" % slug)
    L.append(block([(cssname(n), v[ten + " · Sáng"]) for n, v in chude.items()]))
    L.append("}")
    dk = [(cssname(n), v[ten + " · Tối"]) for n, v in chude.items()
          if v[ten + " · Tối"] != v[ten + " · Sáng"]]
    if dk:
        L.append(":root[data-chu-de=\"%s\"][data-che-do=\"toi\"] {" % slug)
        L.append(block(dk))
        L.append("}")
        L.append("@media (prefers-color-scheme: dark) {")
        L.append("  :root[data-chu-de=\"%s\"]:not([data-che-do=\"sang\"]) {" % slug)
        L.append(block(dk, "    "))
        L.append("  }")
        L.append("}")

# ---- phòng thi khoá cứng
L.append("")
L.append("/* ---------- Phòng thi: KHOÁ CỨNG, không theo chủ đề ----------")
L.append("   Hai lý do:")
L.append("   1. Ô đáp án đang chọn mà tô xanh cổ vịt thì học sinh đọc nhầm là \"đáp án đúng\".")
L.append("   2. Học sinh đi thi không nên thấy màu ưa thích của thầy cô. Phòng thi phải")
L.append("      giống hệt nhau với mọi người — đó là một phần của việc thi công bằng.")
L.append("   Bọc mọi màn hình phòng thi trong [data-vung=\"phong-thi\"]. */")
L.append("[data-vung=\"phong-thi\"] {")
L.append(block([(cssname(n), v["Navy · Sáng"]) for n, v in chude.items()]))
L.append("}")
L.append("[data-vung=\"phong-thi\"][data-che-do=\"toi\"],")
L.append("[data-che-do=\"toi\"] [data-vung=\"phong-thi\"] {")
L.append(block([(cssname(n), v["Navy · Tối"]) for n, v in chude.items()]))
L.append("}")

io.open(DICH,"w",encoding="utf-8").write("\n".join(L) + "\n")
print("dòng:", len("\n".join(L).split("\n")))
print("biến màu:", len(mau), "| số đo:", len(sodo), "| biến chủ đề:", len(chude),
      "| chủ đề:", len(THEMES), "| bậc chữ:", len(BAC))
