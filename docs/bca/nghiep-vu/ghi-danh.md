# Nghiệp vụ — Học sinh và ghi danh môn (Đợt 1)

Nguồn: Apps Script KiN v8.12 (`kin_accept`, `kin_monSet`, `kin_monVal`, `kin_tinhTrang`, `kin_hetThu`, `kinLenChinhThuc`, `kin_themMon`, `kinDungMon`, `kinNghiHan`, `kin_onEditAn`, `K.trialWindow`, `K.conflicts`, `K.match`, `K.lua`) và bản xuất sheet ngày 26/11/2026. Luật gốc ở `docs/bca/QUYET-DINH.md`: các quyết định 3, 8, 13, 16 và 23.
Tài liệu này không chứa dữ liệu cá nhân thật. Mọi tên, mã và số điện thoại trong ví dụ đều là giả.

## Quy ước chung (dùng cho mọi tệp trong `nghiep-vu/`)

- **Ngày** là ngày theo lịch ở múi giờ `Asia/Ho_Chi_Minh` (UTC+7, không đổi giờ theo mùa). Máy chủ Vercel và Neon chạy giờ UTC, nên bắt buộc đổi thời điểm sang giờ Việt Nam rồi mới lấy ngày. Ví dụ: `2026-12-02T17:10:00Z` là 00:10 ngày **03/12** ở Việt Nam, không phải ngày 02/12.
- Thời điểm lưu kiểu `timestamptz`. Ngày lưu kiểu `date`, không kèm giờ.
- "Học **đến hết** ngày X" nghĩa là tính cả ngày X, kể cả buổi 22:15 tối ngày X.
- Lịch 2026 dùng trong ví dụ: 01/11 là Chủ nhật, 01/12 là Thứ Ba. Lịch lớp: Toán T3, T7 · Sử T4, CN · Địa T6 · Anh T2, T5, tất cả học lúc 22:15, mỗi buổi 90 phút. Tuần nào cũng có lớp đủ 7 tối.
- "Chủ" là chủ lớp (quản trị). "GV" là giáo viên cộng tác.

---

## Điều 1. Hồ sơ học sinh

1.1. Mỗi em có đúng một hồ sơ, mang mã `HSxxxx` (4 chữ số) tăng dần. **Mã đã cấp thì không cấp lại**, kể cả khi hồ sơ đã bị xoá.
- Ví dụ: sheet đang có 70 hồ sơ, mã lớn nhất là HS0083, vì 12 em đã bị xoá ngày 16/11. Em mới sẽ nhận mã **HS0084**, không phải HS0071.

1.2. Thông tin trên hồ sơ: họ tên, lứa, SĐT HS, Gmail, trường, khối, họ tên PH, SĐT PH, mục tiêu, username Azota, đồng ý vinh danh, ghi chú, ngày tạo, nguồn, cờ "Nghỉ/ẩn".
Các ô trên sheet sau đây là **cột tính**, không lưu trên hồ sơ: Toán/Sử/Địa/Anh, Tình trạng, Chuyên cần, ĐTB, Còn nợ, Email, Zalo HS, Zalo PH.

1.3. Chuẩn hoá khi nhập:
- **SĐT:** bỏ mọi ký tự không phải số. Đầu `84` kèm 9 số thì đổi thành `0`. Đủ 9 số mà không có số 0 đầu thì thêm `0`. Số hợp lệ phải khớp `^0[35789]\d{8}$`.
  - Ví dụ: `+84 912 345 678` → `0912345678`, hợp lệ. `912345678` → `0912345678`. `0212345678` không hợp lệ: vẫn lưu nhưng báo "Sửa dữ liệu".
- **Gmail:** bỏ khoảng trắng, đổi hết sang chữ thường. Đuôi gõ nhầm (`gamil.com`, `gmai.com`, `gmail.con`, …) thì gợi ý địa chỉ đúng nhưng **không tự sửa**.
- **Họ tên:** chỉ cắt khoảng trắng thừa, không tự viết hoa. Sheet có 2 hồ sơ mà tên bắt đầu bằng chữ thường: để chủ sửa tay.

1.4. Gộp hồ sơ khi có đơn mới. Đơn được coi là của em đã có khi cả hai điều kiện sau đều đúng:
- Gmail trùng, hoặc SĐT HS/PH của đơn trùng SĐT HS/PH của hồ sơ;
- tên giống. Tên giống nghĩa là sau khi bỏ dấu và đổi chữ thường thì trùng hẳn, hoặc cùng tên gọi (từ cuối) và chung ít nhất 2 từ.

Kết quả khớp:
- Khớp đúng 1 hồ sơ: gộp vào hồ sơ đó. Chỉ điền những ô hồ sơ đang trống, không ghi đè ô đã có.
- Trùng SĐT/Gmail nhưng **khác tên** (ví dụ anh chị em dùng chung SĐT phụ huynh): **không tự gộp**. Đơn vào hàng "chờ chủ" để chủ chọn gộp vào mã nào hoặc tạo hồ sơ mới.
- Ví dụ: đơn của "Lê Văn Bình" (giả) có SĐT PH trùng SĐT PH của hồ sơ "Lê Thị An" (giả). Tên gọi khác nhau, nên đơn vào hàng chờ chủ.

## Điều 2. Lứa

2.1. Lứa gắn vào hồ sơ theo **ngày tạo hồ sơ**: lấy lứa có khoảng [Nhận từ ngày, Đến ngày] chứa ngày đó. "Đến ngày" để trống nghĩa là lứa còn mở.
Hiện có 2 lứa:
- L1 "Lứa 1 – BCA Midnight 2K9": 01/06–31/10/2026;
- L2 "Tổng Ôn Lý Thuyết Nền Tảng": từ 01/11/2026, còn mở.

- Ví dụ: hồ sơ tạo ngày 15/11/2026 thuộc L2. Hồ sơ tạo ngày 30/09/2026 thuộc L1.
- Ca biên: ngày tạo không nằm trong lứa nào (ví dụ chủ lỡ đặt L2 bắt đầu từ 05/11 mà em tạo hồ sơ ngày 03/11). Khi đó để trống lứa và báo "Sửa dữ liệu" ở màn Hôm nay.
- Ca biên: em L1 đăng ký lại trong thời gian của L2 vẫn **giữ L1** (giống sheet). Chủ đổi tay nếu muốn.

## Điều 3. Ghi danh

3.1. Mỗi ghi danh là một dòng gồm: em, môn, loại, ngày bắt đầu (`tu_ngay`), ngày học đến hết (`den_ngay`), cờ miễn phí, đơn giá riêng, ghi chú. Loại có hai giá trị là **Thử** và **Chính thức**.
- Ghi danh Thử luôn có `den_ngay`.
- Ghi danh Chính thức có thể để trống `den_ngay`, nghĩa là học tới khi có lệnh dừng.

3.2. Ghi danh **có hiệu lực vào ngày D** khi `tu_ngay ≤ D` và (`den_ngay` trống hoặc `D ≤ den_ngay`).

3.3. **Không chồng ngày:** cùng một em, cùng một môn, không được có hai ghi danh cùng hiệu lực vào bất kỳ ngày nào, dù khác loại. Máy chủ phải chặn ngay khi ghi, trong CSDL là ràng buộc `EXCLUDE` trên `daterange`.
- Ví dụ: em có Thử Toán 02/12–15/12. Chủ thêm Chính thức Toán từ 10/12. Hệ thống không được để hai dòng cùng tồn tại mà phải tự cắt dòng Thử về hết 09/12 (xem Điều 7).
- Sheet ngày 26/11: 192 ghi danh, 0 cặp chồng ngày.

3.4. **Huỷ trước khi bắt đầu:** ghi danh bị dừng trước `tu_ngay` thì coi là chưa từng có hiệu lực. Dòng vẫn giữ để truy vết và có `huy_luc`. Sheet thể hiện việc này bằng cách đặt `den_ngay = tu_ngay − 1`.

3.5. Mọi thay đổi ghi danh đều ghi nhật ký: ai làm, lúc nào, giá trị cũ và mới, lý do.

## Điều 4. Ô môn Học / Thử / Nghỉ và tình trạng em

4.1. Ô môn của mỗi em là giá trị tính ra, xét theo hôm nay (ngày H):
- **Học:** em có ghi danh Chính thức môn đó với `den_ngay` trống hoặc `den_ngay ≥ max(H, tu_ngay)`. Gồm cả trường hợp đã hẹn ngày bắt đầu trong tương lai.
- **Thử:** không thuộc trường hợp Học, và em có ghi danh Thử với `den_ngay ≥ H`.
- **Nghỉ:** em từng ghi danh môn đó nhưng không còn ghi danh nào đang mở.
- **Trống:** em chưa từng ghi danh môn đó.
- Ví dụ (H = 26/11): em có Thử Sử 17/11–30/11 và Chính thức Sử hẹn từ 01/12. Ô Sử hiện **Học**. Tình trạng hiện "Thử → CT 01/12".

4.2. Tình trạng của em (một dòng, xét lần lượt từ trên xuống):
1. có Chính thức đang hiệu lực → "Đang học";
2. có Thử đang hiệu lực → "Thử đến dd/mm", hoặc "Thử → CT dd/mm" nếu đã hẹn ngày lên chính thức;
3. có ghi danh bắt đầu sau hôm nay → "Bắt đầu dd/mm";
4. lần ghi danh gần nhất toàn là Thử, đã hết hạn, và chủ chưa bấm nghỉ → "**Hết thử dd/mm – hỏi em**";
5. từng ghi danh → "Đã nghỉ";
6. chưa có ghi danh nào → "Chưa ghi danh".
- Số thật ngày 26/11: 20 em "Đang học", 50 em đang thử. Hạn thử của 50 em: 28/11 có 16 em, 29/11 có 17, 30/11 có 13, 01/12 có 1, 05/12 có 2, 08/12 có 1.

## Điều 5. Học thử — 14 ngày tính từ ngày đăng ký

5.1. Khi đơn học thử được nhận:
- ngày 1 = **ngày đăng ký**, tức ngày (giờ Việt Nam) của thời điểm em gửi đơn;
- `den_ngay` = ngày đăng ký + 13;
- từ 00:00 ngày đăng ký + 14, em không vào được lớp nữa.

Số ngày lấy từ cài đặt `SO_NGAY_HOC_THU` (hiện là 14). Mọi môn em chọn trong cùng một đơn dùng chung một khoảng thử.
- Ví dụ: em gửi đơn lúc 20:00 Thứ Tư 02/12/2026, chọn Toán và Sử. Thử từ 02/12 đến **15/12**.
  - Buổi Sử em được học: 02/12 (ngay tối hôm đó lúc 22:15), 06/12, 09/12, 13/12, tổng 4 buổi.
  - Buổi Toán: 05/12, 08/12, 12/12, 15/12, tổng 4 buổi. Có buổi 15/12 vì em được học đến hết ngày 15/12, gồm cả buổi 22:15 tối hôm đó.
  - Từ 00:00 ngày 16/12, em bị khoá.
- Ca biên múi giờ:
  - Đơn gửi lúc 00:10 ngày 03/12 (giờ Việt Nam), tức `2026-12-02T17:10Z`: thử từ 03/12 đến 16/12, **không phải** 02/12–15/12.
  - Đơn gửi lúc 23:50 ngày 02/12 vẫn thử từ 02/12 đến 15/12, dù buổi Sử tối hôm đó đã qua. Xem Câu hỏi 1.
- Ca biên đổi tháng: đơn ngày 25/11 thì thử 25/11–08/12. Khoảng thử vắt qua hai tháng không ảnh hưởng gì, vì học thử không tính tiền.

5.2. **Cửa sổ thử dùng chung:** em đang trong hạn thử mà được thêm môn thử thì môn mới hết hạn **cùng ngày** với các môn đang thử, không được thêm 14 ngày mới.
- Ví dụ: em thử Toán và Sử từ 02/12 đến 15/12. Ngày 07/12, chủ thêm Địa thử. Địa chỉ thử từ 07/12 đến **15/12**, không phải đến 20/12.
- Sheet ngày 26/11: không em nào có hơn một khoảng thử.

5.3. **Hết thử:**
- em không còn tên trong danh sách điểm danh của các buổi sau `den_ngay`;
- sang Đợt 2, em bị khoá khỏi lớp, điểm và record;
- hồ sơ, điểm danh và điểm cũ vẫn giữ nguyên.

Màn Hôm nay có việc "Hết thử – hỏi em" (xem `hom-nay.md`).

5.4. **Gia hạn thử (chỉ chủ, theo quyết định 16):** chủ nhập số ngày thêm hoặc ngày hết mới, kèm lý do.
- **Còn trong hạn:** dời `den_ngay` của mọi môn đang thử. Xem Câu hỏi 4.
  - Ví dụ: em thử Toán và Sử, hạn 15/12. Ngày 14/12, chủ gia hạn thêm 3 ngày, hạn mới là 18/12.
  - Em được thêm đúng 1 buổi: Sử 16/12 (T4). Buổi Toán kế tiếp là 19/12, đã nằm ngoài hạn mới.
- **Đã hết hạn:** tạo một **đoạn thử mới** bắt đầu từ ngày gia hạn, không phủ ngược về trước. Lý do: các buổi trong khoảng đã bị khoá mà phủ ngược thì sẽ thành buổi "chưa điểm danh" giả.
  - Ví dụ: thử hết 15/12, ngày 17/12 chủ gia hạn 3 ngày. Thêm đoạn Thử 17/12–19/12. Ngày 16/12 vẫn không có hiệu lực, nên buổi Sử 16/12 không có tên em.

## Điều 6. Thêm môn

6.1. Chỉ chủ thêm môn (trong Đợt 1 học sinh chưa tự thêm được). Chủ chọn môn, loại và ngày.
- **Thêm môn Thử:** nếu em đang trong hạn thử thì môn mới hết cùng ngày với hạn đó (Điều 5.2). Nếu không, môn mới được 14 ngày kể từ ngày thêm. Em đang học Chính thức môn đó thì không được thêm Thử môn đó.
- **Thêm môn Chính thức:** chủ chọn ngày bắt đầu tính phí, mặc định theo Điều 7.2.

6.2. Thêm môn mà khoảng ngày chồng lên một ghi danh **cùng loại** của cùng môn thì bỏ qua và báo "đã có GDxxxxx".

## Điều 7. Chuyển học thử sang chính thức (chỉ chủ, theo quyết định 16)

7.1. Chủ chọn em, các môn và **ngày bắt đầu chính thức** (từ ngày này bắt đầu tính phí, theo quyết định 13). Hệ thống làm như sau:
- tạo ghi danh Chính thức từ ngày đó, `den_ngay` để trống;
- nếu ghi danh Thử cùng môn còn hiệu lực vào ngày đó hoặc sau đó, cắt `den_ngay` của dòng Thử thành (ngày chính thức − 1);
- ghi chú "Lên chính thức sớm từ dd/mm".

7.2. Ngày bắt đầu mặc định:
- em còn trong hạn thử: **ngày sau ngày hết thử**;
- em đã hết thử: **hôm nay**.
Chủ sửa được ngày này.

- Ví dụ giữa tháng (lên sớm): em thử Toán từ 02/12 đến 15/12. Ngày 08/12 (T3), chủ cho em lên Chính thức Toán từ 08/12.
  - Kết quả: Thử Toán còn 02/12–07/12, Chính thức Toán từ 08/12.
  - Điểm nối Đợt 3: tháng 12 tính các buổi Toán 08, 12, 15, 19, 22, 26, 29, tổng **7 buổi**.
- Ví dụ mặc định: cũng em đó, chủ bấm "Lên chính thức" ngày 08/12 nhưng giữ ngày mặc định 16/12.
  - Thử giữ nguyên đến 15/12, Chính thức từ 16/12.
  - Tháng 12 tính 19, 22, 26, 29, tổng **4 buổi**.
- Ca biên lên một phần: em thử Toán và Sử nhưng chỉ lên Chính thức Toán. Sử vẫn thử đến 15/12, rồi rơi vào "Hết thử – hỏi em" nếu chủ không làm gì thêm.
- Ca biên đổi tháng: em thử 25/11–08/12, lên Chính thức với ngày mặc định 09/12. Tháng 11 em không có buổi nào được tính phí.
- Ca biên đã hết thử: thử hết 28/11, ngày 02/12 chủ mới cho lên Chính thức. Mặc định Chính thức từ 02/12. Các buổi 29/11–01/12 không tính phí, vì em đã bị khoá trong những ngày đó.

7.3. Đơn đăng ký loại "Chính thức" của em chưa từng thử: xem Câu hỏi 3. Sheet đang tự tạo 14 ngày thử rồi **tự** tạo Chính thức từ ngày thứ 15 (cài đặt `TANG_HOC_THU_CHO_CT_MOI = Có`). Cách này không qua tay chủ, nên trái với quyết định 16.

## Điều 8. Nghỉ một môn

8.1. Chỉ chủ cho em nghỉ một môn. Chủ chọn ngày "học đến hết", và mặc định được tính như sau:
- thao tác **trước 22:00** (giờ Việt Nam): mặc định đến hết **hôm qua**, nghĩa là em không học buổi tối nay;
- thao tác **từ 22:00**: mặc định đến hết **hôm nay**, nghĩa là em đã học buổi tối nay.

Sau đó, với mọi ghi danh còn mở của môn đó:
- ghi danh chưa bắt đầu (`tu_ngay` sau ngày cắt): huỷ (Điều 3.4);
- ghi danh khác: đặt `den_ngay` bằng ngày cắt.

- Ví dụ: 21:00 Thứ Năm 10/12, chủ cho em nghỉ Anh. Mặc định đến hết 09/12, nên em không có tên trong buổi Anh 22:15 tối 10/12.
- Cùng việc đó nhưng làm lúc 22:30: mặc định đến hết 10/12. Em có tên trong buổi tối nay, và buổi này tính phí (Đợt 3).
- Ca biên: em đang thử Toán đến 15/12, đã hẹn Chính thức Toán từ 16/12. Ngày 12/12 lúc 20:00, chủ cho nghỉ Toán. Ngày cắt là 11/12: dòng Thử cắt còn đến 11/12, dòng Chính thức từ 16/12 bị **huỷ**.

## Điều 9. Đổi môn giữa chừng

9.1. Đổi môn là hai thao tác: **nghỉ môn cũ** (Điều 8) rồi **thêm môn mới** (Điều 6). Không sửa ô "Môn" của dòng ghi danh cũ, vì điểm danh và học phí cũ phải còn gắn đúng môn.

- Ví dụ (Chính thức): em học Chính thức Toán từ 01/12, muốn chuyển sang Sử từ 09/12 (T4). Chủ thao tác lúc 23:00 ngày 08/12:
  - Toán đến hết 08/12. Em vẫn học buổi T3 08/12, vì chủ bấm sau 22:00.
  - Thêm Sử Chính thức từ 09/12.
  - Điểm danh Toán các buổi 01, 05, 08 giữ nguyên. Từ buổi Sử 09/12, em có tên trong danh sách Sử.
  - Điểm nối Đợt 3 (Câu hỏi 5): tháng 12 em có Toán 3 buổi (01, 05, 08) và Sử 7 buổi (09, 13, 16, 20, 23, 27, 30). Theo quyết định 13 ("kỳ đó học từ 2 môn"), cả 10 buổi tính 55.000đ, tổng 550.000đ. Nếu đếm số môn theo từng ngày như hàm cũ `K.bill`, cả 10 buổi tính 65.000đ, tổng 650.000đ.
- Ví dụ (đang thử): em thử Toán từ 02/12 đến 15/12, ngày 05/12 muốn đổi sang Địa. Chủ cho nghỉ Toán, rồi thêm Địa thử. Địa hết hạn **15/12** (cửa sổ dùng chung), không được 14 ngày mới.

## Điều 10. Nghỉ hẳn và ẩn hồ sơ

10.1. Chủ bấm "Nghỉ hẳn" hoặc tick "Nghỉ/ẩn":
- tất cả ghi danh còn mở của em bị dừng theo **cùng luật giờ 22:00** như Điều 8;
- hồ sơ bị ẩn khỏi danh sách, khỏi điểm danh các buổi sau đó và khỏi màn Hôm nay;
- điểm danh, điểm và tiền đã có vẫn giữ.

10.2. Bỏ ẩn chỉ làm hồ sơ hiện lại. Muốn em học lại thì chủ thêm môn (Học hoặc Thử). Nếu em vừa bị ẩn **do tick nhầm** và chưa ghi danh lại môn nào thì khôi phục `den_ngay` cũ, giống sheet. Hệ thống làm được việc này nhờ nhật ký lưu giá trị cũ.

10.3. Xoá hồ sơ: xem Câu hỏi 7. Sheet chỉ cho xoá em đã nghỉ hết môn **và** chưa có tiền thu hoặc phiếu đã gửi. Bản sao lưu nằm ở `__DaXoa`. Cài đặt tự xoá (`TU_XOA_HS_NGHI`) đang tắt.

## Điều 11. Sĩ số

11.1. `SI_SO_TOI_DA`, và "Sĩ số tối đa" của từng môn, bằng 0 nghĩa là không giới hạn. Ngày 26/11 cả hai đều là 0.
- Có giới hạn thì: đơn **tự động** vượt sĩ số vào hàng chờ chủ; chủ thêm tay thì vẫn được, chỉ hiện cảnh báo.
- Sĩ số của một môn vào ngày D = số em khác nhau có ghi danh (Thử hoặc Chính thức) môn đó hiệu lực vào ngày D.
- Ví dụ thật: buổi Toán 28/11 có 63 em (14 Chính thức, 49 Thử).

## Điều 12. Điểm nối với đợt sau

- **Đợt 3 (học phí):** dùng `tu_ngay` của Chính thức, `den_ngay`, `mien_phi`, `don_gia_rieng`. Ngày bắt đầu tính phí của lớp là `NGAY_BAT_DAU_TINH_PHI` = 16/11/2026: các ghi danh Chính thức bắt đầu từ 30/06 vẫn chỉ tính phí từ 16/11.
- **Đợt 4 (form, email, Meet):** nhận đơn tự động theo Điều 1.4 và Điều 5.1. Đơn bị giữ lại khi điền quá nhanh (dưới 3 giây), SĐT sai hoặc không chọn môn. Gửi email chào kèm link Zalo học thử. Đồng bộ danh sách Meet theo ghi danh đang hiệu lực.

## Khác sheet

| # | Sheet / script v8.12 | Web mới | Căn cứ |
|---|---|---|---|
| K1 | Học thử tính từ **ngày máy xử lý đơn** (`today` trong `kin_accept`). 5 đơn web gửi chiều tối 15/11 được xử lý sang 16/11, nên được thử đến 29/11. | Tính từ **ngày đăng ký**: các đơn đó chỉ thử đến 28/11. | Quyết định 8 |
| K2 | Gia hạn bằng cách sửa tay ô "Học đến hết ngày". | Có nút gia hạn, chỉ chủ dùng được, có nhật ký và lý do. Gia hạn sau khi đã hết hạn thì tạo đoạn thử mới. | Quyết định 8, 16 |
| K3 | Tick "Nghỉ/ẩn" luôn cắt đến hết **hôm nay**, còn đổi ô môn thì dùng luật 22:00. | Cả hai dùng chung luật 22:00. | Cho thống nhất |
| K4 | Đơn "Chính thức" tự sinh Chính thức sau 14 ngày thử. | Chờ chủ trả lời Câu hỏi 3. | Quyết định 16 |
| K5 | Em hết thử đăng ký thử lại thì tự được 14 ngày mới. | Chờ chủ trả lời Câu hỏi 2. | Quyết định 8 |
| K6 | Kiểm tra chồng ngày chỉ hiện việc "Sửa dữ liệu". | CSDL chặn ngay khi ghi. | Toàn vẹn dữ liệu |

## Câu hỏi cho chủ

1. **Đăng ký sau giờ học tối (sau 22:15) có tính hôm đó là ngày 1?**
   - A. Có, tính đúng theo ngày đăng ký như quyết định 8; nếu cần thì chủ gia hạn. **(khuyên dùng: luật đơn giản, đúng chữ quyết định 8)**
   - B. Không: đăng ký sau 22:15 thì ngày 1 là ngày hôm sau.
   - C. Không: đăng ký sau 20:00 thì ngày 1 là ngày hôm sau.
2. **Em đã hết hạn thử rồi đăng ký thử lại thì sao?**
   - A. Không tự cấp; đơn vào hàng chờ chủ, chủ gia hạn nếu muốn. **(khuyên dùng)**
   - B. Tự cấp 14 ngày mới như sheet.
   - C. Tự cấp nếu lần thử trước đã cách từ 60 ngày trở lên, hoặc thuộc lứa trước.
3. **Đơn "Chính thức" của em chưa từng học thử thì sao?**
   - A. Tạo 14 ngày thử kèm cờ "muốn học chính thức"; chủ bấm chuyển chính thức. **(khuyên dùng: đúng quyết định 16)**
   - B. Như sheet: tặng 14 ngày thử rồi tự lên chính thức từ ngày 15.
   - C. Lên chính thức ngay từ ngày đăng ký, không học thử.
4. **Gia hạn thử áp cho môn nào?**
   - A. Mọi môn đang thử của em, giữ một cửa sổ chung. **(khuyên dùng)**
   - B. Chủ chọn từng môn.
5. **Đơn giá khi em đổi môn giữa kỳ** (Toán 3 buổi rồi Sử 7 buổi trong cùng tháng):
   - A. Đếm theo kỳ: có 2 môn có buổi > 0 nên tính 55.000đ/buổi, tổng 550.000đ. Đây là đúng chữ quyết định 13 và giống bảng 💰 hiện tại. **(khuyên dùng)**
   - B. Đếm theo ngày: ngày nào em chỉ học 1 môn thì ngày đó tính 65.000đ, tổng 650.000đ.
6. **5 em đăng ký web ngày 15/11 nhưng sheet tính thử từ 16/11:**
   - A. Giữ nguyên hạn hiện có (29/11), luật mới chỉ áp cho đơn mới. **(khuyên dùng: không rút quyền đã cho em)**
   - B. Tính lại theo ngày đăng ký: hạn còn 28/11.
7. **Xoá học sinh đã nghỉ:**
   - A. Không xoá cứng, chỉ ẩn; chủ xuất dữ liệu khi cần. **(khuyên dùng)**
   - B. Như sheet: được xoá em đã nghỉ hết môn và chưa có tiền thu hay phiếu đã gửi, bản sao lưu cất trong bảng ẩn.
   - C. Ẩn ngay, rồi tự xoá hẳn sau 12 tháng.
