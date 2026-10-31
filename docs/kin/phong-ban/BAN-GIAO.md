# Mẫu phiếu — mọi bàn giao giữa tác tử phải theo đúng mẫu

Lý do: tác tử con không giữ lịch sử của nhau. Phiếu là thứ duy nhất đi qua
ranh giới, nên nó phải đủ để người nhận làm việc mà không hỏi lại.
Điền đủ mọi dòng; dòng không áp dụng ghi "không".

## A. Phiếu giao (COO → trưởng phòng, hoặc trưởng phòng → nhân sự)

```
MÃ:            <ADM|TUT|STU|COO>-<số>  (ví dụ TUT-012)
PHÒNG / VAI:   pb-gia-su → tut-rnd
MỤC TIÊU:      một câu, bằng lời người dùng
XONG KHI:      3–5 điều kiểm được (route, màn, test tên gì xanh)
PHẠM VI TỆP:   thư mục được sửa (theo PHAM-VI.md); tệp chung cần xin: <danh sách hoặc "không">
NGUỒN:         phiếu kin-doc-so / đặc tả dac-ta/<mã>.md / khung Figma node <id> / mục trong BIGUPDATE-KE-HOACH.md
CỜ:            TIỀN = không | trình bày | có · TRẺ EM = không | trình bày | có · ĐỔI NỀN = không | có
NHÁNH:         claude/tut-012 (rẽ từ origin/main | từ claude/bu-00-phan-vai vì ...)
GIỚI HẠN:      vòng test tối đa 3; không chạm <...>
```

## B. Phiếu bàn giao (nhân sự → trưởng phòng)

```
MÃ:            TUT-012 · VAI: tut-code
KẾT QUẢ:       XONG | LÀM MỘT PHẦN | DỪNG (lý do)
TỆP ĐÃ ĐỔI:    đường dẫn, mỗi dòng một tệp, kèm 3–8 chữ việc gì
TEST ĐÃ VIẾT:  tools/local-e2e/t-xxx-lib.ts (n ca, có ca phá), t-xxx.ts (n ca)
TEST ĐÃ CHẠY:  (chỉ *-test) bảng bài · đạt/đỏ · lỗi tệp:dòng · mới/có sẵn/môi trường
CHƯA LÀM:      điều gì, vì sao, ai nên làm
CỜ PHÁT HIỆN:  TIỀN / TRẺ EM / ĐỔI NỀN gặp giữa chừng (nếu có) — và đã dừng ở đâu
CÂU HỎI:       cho trưởng phòng hoặc chủ, mỗi câu một dòng, có đề xuất mặc định
COMMIT:        <mã>: <việc> (<phạm vi>)
```

## C. Gói phát hành (trưởng phòng → COO)

```
MÃ:            TUT-012
NHÁNH / PR:    claude/tut-012 · #<số> hoặc "chưa mở"
ĐẶC TẢ:        docs/kin/phong-ban/dac-ta/TUT-012.md
TỆP ĐỔI:       n tệp (liệt kê thư mục), tệp chung đã xin: <...>
TEST:          bài mới n · đã chạy m · đỏ còn lại k (tên + lý do có sẵn/môi trường)
RÀ SOÁT:       kin-ra-soat: P1 0 · P2 0 · P3 n (ghi ở tien-do)
GHI SỔ:        tien-do-dang-do.md mục <...>, backlog dòng <...>
VIỆC CỦA CHỦ:  biến môi trường, chi phí, quyết định còn treo
PHỤ THUỘC:     PR khác phải gộp trước / sau
```

## D. Yêu cầu đổi tệp chung (phòng → COO)

```
MÃ VIỆC:       TUT-012
TỆP CHUNG:     prisma/schema.prisma (thêm bảng class_join_requests), src/lib/notify.ts (3 type mới)
ĐỔI GÌ:        mô tả chỉ-thêm, không đổi kiểu / không xoá
AI SỬA:        đề xuất tut-code · hoặc COO chỉ định
PHÒNG KHÁC BỊ ẢNH HƯỞNG: pb-hoc-sinh (màn nhập mã lớp đọc trạng thái mới)
```

## E. Báo cáo COO → chủ (cuối mỗi đợt)

Một trang: việc xong (mã, PR, một dòng), việc dở (vì sao), việc của chủ
(biến môi trường, chi phí, quyết định), số test (mới/chạy/đỏ có sẵn), nợ P3
mới. Không số liệu ước; không "sắp xong".
