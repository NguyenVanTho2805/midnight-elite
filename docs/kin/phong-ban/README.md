# Phòng ban phát triển KiN — 3 phòng × 4 nhân sự, một người điều hành

Lập 01/11/2026 theo yêu cầu của Thanh, dựa trên tài liệu nghiên cứu
*"Báo cáo kiểm toán kỹ thuật nền tảng Midnight Elite và thiết kế kiến trúc
công ty đa tác tử tự hành"* (Gemini Deep Research, 31/10/2026 — bản Word trong
Downloads của Thanh). Tài liệu đó đề xuất kiến trúc **giám sát phân cấp lai**:
một COO, ba trưởng phòng, mười hai nhân sự chuyên môn (R&D · Code · Dev · Test
cho mỗi phòng). Bản này giữ đúng cấu trúc ấy nhưng đặt lên **sản phẩm thật
(KiN)** và **luật kho thật**; mục 6 ghi rõ chỗ khác với tài liệu và vì sao.

## 1. Sơ đồ

```
Thanh / Thọ (nhà sáng lập)
        │
   kin-coo  ── Tổng điều hành: nhận yêu cầu, chia phòng, giữ sổ việc, chốt gộp
        │
   ┌────┴─────────────┬──────────────────┐
pb-admin          pb-gia-su          pb-hoc-sinh        ← 3 trưởng phòng
   │                  │                   │
adm-rnd            tut-rnd             stu-rnd           R&D  — nghiên cứu, đặc tả, Figma
adm-code           tut-code            stu-code          Code — máy chủ: API, lib, Prisma
adm-dev            tut-dev             stu-dev           Dev  — giao diện: trang, component
adm-test           tut-test            stu-test          Test — viết + chạy test, soi bảo mật
        │
   Khối chung (có sẵn, dùng chung cho cả ba phòng):
   kin-doc-so (đọc sổ) · kin-ra-soat (rà độc lập) · kin-ghi-so (ghi sổ) · kin-kiem-thu (dựng môi trường test)
```

Mỗi tác tử là một tệp trong `.claude/agents/`. Gọi bằng công cụ Agent với
`subagent_type` = tên tệp (ví dụ `pb-gia-su`, `stu-test`).

## 2. Ai làm gì

| Vai | Làm | Không làm |
|---|---|---|
| **kin-coo** | Nhận yêu cầu bằng lời, phân loại: **một phòng** → giao thẳng trưởng phòng (đường nhanh); **liên phòng** → viết đồ thị việc + phiếu giao cho từng phòng, chạy song song, nhận "gói phát hành", kiểm chéo rồi báo chủ. Giữ `docs/kin/phong-ban/SO-VIEC.md`. | Không viết mã. Không cho hai phòng sửa cùng tệp (xem PHAM-VI.md). |
| **pb-\*** (trưởng phòng) | Nhận phiếu, chạy đường ống trong phòng: `*-rnd` → (`*-code` ∥ `*-dev`) → `*-test` → `kin-ra-soat` → sửa P1/P2 → `kin-ghi-so` → trả gói phát hành. Giữ ngữ cảnh miền của phòng mình. | Không nhận việc ngoài miền; thấy TIỀN / TRẺ EM / ĐỔI NỀN → dừng, báo COO. |
| **\*-rnd** | Đọc mã + tài liệu + nguồn ngoài, viết **đặc tả** (vấn đề, schema chỉ thêm, hợp đồng API, luồng màn, test cần có), vẽ/cập nhật khung Figma. Đầu ra là tệp `docs/kin/phong-ban/dac-ta/<mã>.md`. | Không sửa `src/`. |
| **\*-code** | Máy chủ theo đặc tả: route handler, `src/lib`, Prisma (chỉ thêm), cron, notify. Viết test thuần `t-*-lib.ts` và test API `t-*.ts`. | Không sửa component/trang; không đổi tệp ngoài PHAM-VI của phòng. |
| **\*-dev** | Giao diện theo đặc tả + khung Figma: trang app router, component, token `--kin-*`, 390px. Viết bài `ui-*.ts`. | Không sửa API/schema; không tự chọn màu. |
| **\*-test** | Viết thêm test còn thiếu (ca phá cố ý, cô lập quyền, bảo mật theo miền), chạy **tuần tự** toàn bộ bài liên quan, phân biệt lỗi mới / có sẵn, trả bảng số thật. Soi bảo mật riêng của miền (admin: leo quyền; gia sư: lớp người khác 403; học sinh: lộ đáp án, trục lợi Coin). | Không sửa `src/`. Không bao giờ ghi "xanh" khi chưa chạy. |

## 3. Luồng một việc

1. **Phiếu giao** (COO → trưởng phòng) theo mẫu `BAN-GIAO.md` mục A: mã việc, mục tiêu, "xong khi", phạm vi tệp, cờ.
2. **Đặc tả** (`*-rnd`): đọc `kin-doc-so` + mã + Figma, viết `dac-ta/<mã>.md`. Trưởng phòng duyệt: có đụng tệp chung hay phòng khác không? → xin COO trước.
3. **Lập trình song song**: `*-code` và `*-dev` cùng một nhánh, khác tệp (đặc tả chia sẵn). Mỗi bên trả phiếu bàn giao mục B (tệp đổi, test viết, điều chưa làm).
4. **Kiểm thử** (`*-test`): chỉ bắt đầu khi không ai đang sửa `src/`. Đỏ mới → trả về bên viết, tối đa **3 vòng**; vẫn đỏ → ghi "LÀM MỘT PHẦN".
5. **Rà soát** (`kin-ra-soat`): P1 → sửa + rà lại; P2 → sửa; P3 → ghi nợ.
6. **Ghi sổ** (`kin-ghi-so`): `tien-do-dang-do.md`, backlog CSV, mô tả PR.
7. **Gói phát hành** (trưởng phòng → COO) theo mẫu mục C. COO gộp các gói, chạy bài liên vai (`ui-role-everything`, `ui-links-everywhere`), mở PR.

Giới hạn vòng lặp: một việc không quá **8 lượt** trưởng phòng ↔ nhân sự; quá
thì dừng, ghi sổ, hỏi chủ. Nhân sự **không** tự giao việc cho nhau (chỉ qua
trưởng phòng) — tránh đùn đẩy vòng quanh.

## 4. Nhánh và gộp khi chủ kho chưa có máy

- Mỗi việc một nhánh `claude/<phòng>-<mã>` từ `main`; nếu phụ thuộc PR chưa gộp
  (ví dụ #88 BU-00), rẽ từ nhánh đó và **ghi rõ trong PR**.
- Việc phụ thuộc API chưa có trên `main`: `*-rnd` ghi hợp đồng API vào đặc tả,
  `*-code`/`*-dev` làm theo hợp đồng; `*-test` viết bài kiểm hợp đồng để khi
  nhánh kia gộp thì chạy lại là biết khớp hay không. Không tạo "mock adapter"
  trong `src/` — chỉ trong `tools/local-e2e/mock/`.
- Một PR một phòng. COO không gộp; Thanh hoặc Thọ bấm gộp.

## 5. Chi phí và khi nào KHÔNG dùng phòng ban

Tài liệu nguồn dẫn số liệu: đa tác tử tốn ~15× token so với một tác tử. Vì vậy:
- Việc nhỏ (một tệp, sửa chữ, một bài test) → phiên chính làm thẳng, không gọi phòng.
- Việc một phòng, một tầng (chỉ UI hoặc chỉ API) → gọi thẳng `*-dev` hoặc `*-code`, bỏ qua trưởng phòng.
- Chỉ dùng trọn đường ống (R&D → Code ∥ Dev → Test) cho việc cỡ M trở lên hoặc có schema/quyền/tiền.

## 6. Khác với tài liệu Gemini, và vì sao

| Tài liệu đề xuất | Ở đây | Vì sao |
|---|---|---|
| Node/Express + Socket.IO + Redis + Electron kiosk | Next 16 app router + Prisma + Neon, không thêm hạ tầng | Kho thật là Next 16; thêm WebSocket/Redis là ĐỔI NỀN — phải hỏi chủ. |
| Lớp học LIVE mỗi tối, trợ giảng 1-1, SLA "trả lời trong ngày", Zalo hotline | Không có trong KiN hiện tại (gia sư tự dạy lớp của mình, không có trợ giảng) | Tài liệu đọc trang marketing cũ midnightelite-edu.com; sản phẩm thật là sổ gia sư. Nếu chủ muốn, mở phòng riêng sau. |
| "Hỏi AI 24/7" RAG, xu thưởng, GPA, streak | Chưa làm; Coin có sẵn chỉ là điểm thưởng, không nạp bằng tiền | Chạm TIỀN và chính sách — quyết định của chủ. |
| Saga / circuit breaker, Send API LangGraph | Phiếu bàn giao có cấu trúc (BAN-GIAO.md) + giới hạn vòng lặp | Chạy bằng Claude Code Agent tool, không có runtime LangGraph; mẫu phiếu là cách rẻ nhất đạt cùng mục đích (không mất ngữ cảnh, không lặp). |
| Khối đặc nhiệm INT (PM/ARCH/BUS/FLOW) | Gộp vào kin-coo + kin-ra-soat + bài `ui-role-everything` | Chưa đủ việc liên phòng để nuôi thêm 4 tác tử; mở khi có ≥3 việc liên phòng cùng lúc. |
| Xoá bài rác, chuỗi FTYZ, SSR trang chủ | Đã kiểm trên production 01/11: không còn bài rác, không có FTYZ, /dang-ky đã có chọn vai | Site đã đổi thành KiN sau khi Gemini quét. |

## 7. Tệp liên quan

- `PHAM-VI.md` — phòng nào sở hữu thư mục nào; tệp chung xin COO.
- `BAN-GIAO.md` — mẫu phiếu giao / phiếu bàn giao / gói phát hành.
- `SO-VIEC.md` — sổ việc của COO (mã việc, phòng, nhánh, trạng thái).
- `dac-ta/` — đặc tả do `*-rnd` viết, một tệp một mã việc.
- `docs/kin/bao-cao/diem-yeu-01-11-2026.md` — báo cáo điểm yếu đầu vào cho đợt đầu.
- Luật kho: `docs/kin/CLAUDE-cho-kho-trien-khai.md`, `.claude/agents/kin-backend.md` (8 quy tắc cứng máy chủ), `kin-frontend.md`, `kin-ra-soat.md` (10 mục rà).
