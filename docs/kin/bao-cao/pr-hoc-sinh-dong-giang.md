TUT-dong-giang D7+H4: cộng đồng lớp có đồng giảng (giấu tên với học viên) + route học sinh chặn gia sư

## Vì sao
Sau PR #143 một lớp có nhiều giáo viên. Cộng đồng lớp và các route học sinh vẫn coi người có Enrollment cũ là học sinh, nên đồng giảng bị tính là học viên (nhận Coin, lộ danh tính theo sai hướng) và gia sư gọi được route học sinh.

## Thay đổi
- D7: `classThreadAccess.ts` (đồng giảng active là thành viên lớp; Enrollment cũ của người không còn role student không tính). `communityServer.ts` `helperAuthorsToHide`: học viên/khách/gia sư lạ thấy "Giáo viên của lớp", id null; chủ lớp, đồng giảng cùng lớp, quản trị thấy tên; không lọc status nên bị gỡ rồi mời lại vẫn giấu. `api/community/{threads,scope-options}`. Coin cộng đồng chỉ cho role student.
- H4: `src/lib/studentOnly.ts` (mới). GET `enrollments`, `followed-courses`, `progress`, `student/viec-cua-toi`, `student/de-thi` trả rỗng 200 cho non-student; POST/DELETE `followed-courses`, POST/PATCH/DELETE `progress`, `lesson-notes`, `exams/[id]/start` trả 403.

## Xong khi
Học viên/khách không thấy tên đồng giảng ở cộng đồng lớp; đồng giảng không nhận Coin; gia sư không ghi/đọc dữ liệu học sinh qua route học sinh.

## Test đã chạy (worktree hsdg, cổng 3185, tuần tự)
t-hs-dong-giang (mới) 102/0 · t-course-teachers 216/0 · t-community-api 512/0 · t-attempt-suspended-api 102/0 · t-student-todo 36/0 · t-enrollments-pending-api 20/0 · t-exam-attack 53/0 · t-lesson-visibility 82/0 · t-suspended-content-api 61/0 · t-tut-003 28/0 · t-exam-practice 28/0 · t-exam-variants-hs 35/0 · t-stu-001 48/0 · t-quiz-hs 63/0 · t-assign-contract 29/0. Bài mới trên nền #143: đỏ ≥16 ca rồi sập.
Lỗi có sẵn (nền không có commit này): t-exam-roles-attack 50/2; `tsc` chỉ lỗi `ts-fsrs`. eslint sạch. Chưa chạy thử trên trình duyệt thật.

## Không đụng tiền / trẻ em / schema
Không đổi schema, không bật cờ. Tiền: chỉ chặn Coin cho non-student. Trẻ em: không thu thêm dữ liệu; thông báo vẫn không tên/số tiền.

## Nợ P3
`exams/[id]/gate` còn báo ghi danh cho gia sư có Enrollment cũ (start đã 403) · `api/student/lich-rieng` dùng `requireSession` · thông báo bài mới chỉ gửi chủ lớp · `exams/attempts/*` chưa cổng vai · H3 `admin/enrollments` thuộc Quản trị.

## Việc của Thọ sau merge
Kiểm tay trên điện thoại cộng đồng lớp có đồng giảng. Q3–Q5 của TUT-dong-giang vẫn chờ xác nhận (mặc định giấu tên).

## Thứ tự gộp / quyết định đã áp
Gộp #143 (`claude/gia-su-dong-giang`) trước; PR này base `claude/gia-su-dong-giang`, tự chuyển main khi #143 gộp. Quyết định mặc định đã áp: học sinh không thấy tên đồng giảng (Q3–Q5).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
