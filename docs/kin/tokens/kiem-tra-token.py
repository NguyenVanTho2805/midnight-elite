# -*- coding: utf-8 -*-
"""
Kiểm tra tokens.css có giữ đúng luật của KiN không.

    python3 kiem-tra-token.py            # kiểm tokens.css cạnh file này
    python3 kiem-tra-token.py --tu-kiem  # tự cấy lỗi để chắc bộ kiểm bắt được

Thoát mã 0 nếu đạt, 1 nếu có luật bị vi phạm. Chỉ dùng thư viện chuẩn.
Gắn vào CI trước bước build là đủ.
"""
import io, os, re, subprocess, sys, tempfile, shutil

THU_MUC = os.path.dirname(os.path.abspath(__file__))
TOKENS = os.path.join(THU_MUC, "tokens.css")

BAC_CHU = ["display", "h1", "h2", "h3", "h4", "body", "small", "caption"]
TI_LE = 1.2  # Minor Third


def doc_khoi(css):
    """Trả về danh sách (bộ-chọn, {biến: giá trị}). Khối trong @media giữ bộ chọn có tiền tố '@media … |'."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    khoi, ngan, dau, i, bo_chon = [], [], 0, 0, ""
    for m in re.finditer(r"[{}]", css):
        if m.group() == "{":
            bo_chon = css[dau:m.start()].strip()
            ngan.append(bo_chon)
            dau = m.end()
        else:
            than = css[dau:m.start()]
            chon = ngan.pop() if ngan else ""
            bien = dict(re.findall(r"(--[\w-]+)\s*:\s*([^;]+);", than))
            if bien:
                tien_to = " | ".join(ngan)
                khoi.append(((tien_to + " | " if tien_to else "") + chon, bien))
            dau = m.end()
    return khoi


def kiem(css):
    loi = []
    khoi = doc_khoi(css)
    goc = [b for c, b in khoi if c == ":root"]
    if not goc:
        return ["Không tìm thấy khối :root."]
    goc = goc[0]

    # Luật 1 — TK-169: ba màu ngữ nghĩa (--kin-tt-*) không bao giờ đổi theo chủ đề.
    for chon, bien in khoi:
        if "data-chu-de" in chon or "data-vung" in chon:
            for ten in bien:
                if ten.startswith("--kin-tt-"):
                    loi.append("Luật 1: %s bị đặt lại trong «%s». Màu trạng thái là nghĩa, không đổi theo chủ đề." % (ten, chon))

    # Luật 2: khối chủ đề chỉ được đổi màu nhấn (--kin-nhan-*).
    for chon, bien in khoi:
        if "data-chu-de" in chon:
            la = [t for t in bien if not t.startswith("--kin-nhan-")]
            if la:
                loi.append("Luật 2: chủ đề «%s» đổi cả %s — chủ đề chỉ được đổi --kin-nhan-*." % (chon, ", ".join(la)))

    # Luật 3: màu trạng thái phải có ở cả chế độ sáng và tối.
    tt = [t for t in goc if t.startswith("--kin-tt-")]
    if len(tt) < 6:
        loi.append("Luật 3: :root chỉ có %d biến --kin-tt-*, cần đủ 6 (3 chữ + 3 chấm)." % len(tt))
    toi = [b for c, b in khoi if c == ':root[data-che-do="toi"]']
    if not toi:
        loi.append('Luật 3: thiếu khối :root[data-che-do="toi"].')
    else:
        thieu = [t for t in tt if t not in toi[0]]
        if thieu:
            loi.append("Luật 3: chế độ tối thiếu %s." % ", ".join(thieu))

    # Luật 4: phòng thi khoá cứng ở Navy, sáng lẫn tối.
    navy = [b for c, b in khoi if c == ':root[data-chu-de="navy"]']
    thi = [b for c, b in khoi if c == '[data-vung="phong-thi"]']
    if not thi:
        loi.append('Luật 4: thiếu khối [data-vung="phong-thi"].')
    elif navy:
        lech = [t for t in thi[0] if navy[0].get(t) != thi[0][t]]
        if lech:
            loi.append("Luật 4: phòng thi lệch Navy ở %s." % ", ".join(lech))

    # Luật 5: thang chữ đủ 8 bậc, theo tỉ lệ 1,2, và nội dung đề thi 16px / dòng 1,6.
    co = {}
    for b in BAC_CHU:
        v = goc.get("--kin-co-" + b)
        if v is None:
            loi.append("Luật 5: thiếu --kin-co-%s." % b)
            continue
        co[b] = float(v.replace("px", ""))
    if len(co) == len(BAC_CHU):
        for tren, duoi in zip(BAC_CHU, BAC_CHU[1:]):
            tl = co[tren] / co[duoi]
            if abs(tl - TI_LE) > 0.02:
                loi.append("Luật 5: %s/%s = %.3f, lệch tỉ lệ %.1f." % (tren, duoi, tl, TI_LE))
    if goc.get("--kin-co-body", "").strip() != "16px":
        loi.append("Luật 5: nội dung đề thi phải 16px, đang là %r." % goc.get("--kin-co-body"))
    if goc.get("--kin-dong-body", "").strip() != "1.6":
        loi.append("Luật 5: dòng nội dung đề thi phải 1.6, đang là %r." % goc.get("--kin-dong-body"))
    return loi


def sinh_lai_giong_file(css):
    """Luật 6: tokens.css phải đúng bằng thứ sinh-tokens.py sinh ra — không ai sửa tay."""
    tam = tempfile.mkdtemp()
    try:
        for f in ("sinh-tokens.py", "bien-figma.json"):
            shutil.copy(os.path.join(THU_MUC, f), tam)
        subprocess.run([sys.executable, os.path.join(tam, "sinh-tokens.py")],
                       check=True, capture_output=True)
        moi = io.open(os.path.join(tam, "tokens.css"), encoding="utf-8").read()
        return [] if moi == css else ["Luật 6: tokens.css khác bản sinh từ bien-figma.json — có người sửa tay. Chạy lại sinh-tokens.py."]
    finally:
        shutil.rmtree(tam)


def tu_kiem(css):
    """Cấy từng lỗi một, mỗi lỗi phải bị bắt. Chứng minh bộ kiểm không đạt cho có."""
    ca = [
        ("màu xong đổi theo chủ đề Mận", lambda c: c.replace(':root[data-chu-de="man"] {', ':root[data-chu-de="man"] {\n  --kin-tt-chu-xong: #7e22ce;', 1), "Luật 1"),
        ("chủ đề đổi màu nền trang", lambda c: c.replace(':root[data-chu-de="co-vit"] {', ':root[data-chu-de="co-vit"] {\n  --kin-nen-trang: #eaf6fa;', 1), "Luật 2"),
        ("phòng thi bị tô cổ vịt", lambda c: re.sub(r'(\[data-vung="phong-thi"\] \{\s*--kin-nhan-nen: )#[0-9a-f]+', r"\g<1>#0e7490", c, count=1), "Luật 4"),
        ("nội dung đề thi còn 15px", lambda c: c.replace("--kin-co-body: 16px;", "--kin-co-body: 15px;", 1), "Luật 5"),
        ("chen cỡ 14px giữa thang", lambda c: c.replace("--kin-co-small: 13.3px;", "--kin-co-small: 14px;", 1), "Luật 5"),
    ]
    hong = 0
    for mo_ta, cay, luat in ca:
        loi = kiem(cay(css))
        bat = any(l.startswith(luat) for l in loi)
        print(("  bắt được  " if bat else "  BỎ LỌT   ") + mo_ta)
        hong += not bat
    return hong


def main():
    css = io.open(TOKENS, encoding="utf-8").read()
    if "--tu-kiem" in sys.argv:
        print("Tự kiểm: cấy lỗi vào bản sao tokens.css")
        hong = tu_kiem(css)
        print("Kết quả: %s" % ("đạt" if not hong else "%d lỗi bị bỏ lọt" % hong))
        sys.exit(1 if hong else 0)
    loi = kiem(css) + sinh_lai_giong_file(css)
    if loi:
        print("tokens.css VI PHẠM %d luật:" % len(loi))
        for l in loi:
            print("  - " + l)
        sys.exit(1)
    print("tokens.css đạt cả 6 luật.")


if __name__ == "__main__":
    main()
