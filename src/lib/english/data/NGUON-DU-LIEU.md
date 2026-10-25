# Nguồn dữ liệu từ vựng

- `wordlists.json` — `[lemma, list, listRank, freqRank]` cho 3.807 từ:
  - `ngsl` (2.801 từ) — New General Service List 1.01
  - `sup` (47 từ) — danh sách bổ sung của NGSL (số đếm, tháng, ngày…)
  - `nawl` (959 từ) — New Academic Word List
- `freq-25k.json` — 25.000 lemma phổ biến nhất xếp theo tần suất (chỉ số mảng + 1 = thứ hạng),
  dùng để đoán độ khó của từ ngoài danh sách và để kiểm tra lemma khi tách từ.

Cả hai lấy từ bảng "NGSL 1.01 with SFI" (Browne, C., Culligan, B. & Phillips, J.),
cấp phép **Creative Commons Attribution-ShareAlike 4.0** — http://www.newgeneralservicelist.org.
Bản xlsx gốc lấy qua kho github.com/antdurrant/word.lists (data-raw/list_ngsl).
Khi hiển thị danh sách cho người học phải ghi nguồn như trên (đã ghi ở trang Từ vựng).
