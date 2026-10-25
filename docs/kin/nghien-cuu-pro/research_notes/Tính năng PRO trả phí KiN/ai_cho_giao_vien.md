# Tính năng AI cho người dạy ở Việt Nam: đáng trả tiền không, chi phí vận hành thật, rủi ro

Ngày truy cập: 22/10/2026. Người ghi: researcher (subagent), phục vụ báo cáo gói Pro của KiN.

**Cách đọc nhãn độ tin cậy**
- **[Đã kiểm nguồn]**: tôi đã mở trực tiếp trang gốc (nhà cung cấp) trong phiên này.
- **[Nguồn thứ cấp]**: số liệu lấy từ tóm tắt kết quả tìm kiếm hoặc trang tổng hợp (aggregator, blog, báo), chưa mở được trang gốc. Cần kiểm lại trước khi dùng để ra quyết định.
- **[Suy luận]**: do tôi tính hoặc kết luận từ các số liệu bên trên, không phải sự thật đã kiểm.

**Giới hạn của phiên nghiên cứu (quan trọng cho người đọc sau)**
- Hạn mức WebSearch của lượt này (200 lần, dùng chung các agent) đã hết sau khoảng 12 lần tìm thành công (2 lần sau bị từ chối). Tôi không tìm thêm sau đó và không dùng đường vòng.
- WebFetch chỉ mở được `platform.claude.com`, `anthropic.com`, `claude.com`, `support.claude.com`. Các domain khác (azota.vn, magicschool.ai, ai.google.dev, openai.com, rand.org, gallup.com, thuvienphapluat.vn, vmlu.ai, huggingface.co, arxiv.org...) đều trả lỗi `getaddrinfo ENOTFOUND`. Trang giá Google Cloud mở được nhưng không có nội dung giá.
- Hệ quả: **giá Claude, chính sách sử dụng, chính sách lưu dữ liệu = [Đã kiểm nguồn]. Giá Gemini/OpenAI, giá đối thủ, số liệu khảo sát = [Nguồn thứ cấp].** Phần luật Việt Nam và benchmark tiếng Việt chưa kiểm được (xem Gaps).
- **Tỉ giá giả định: 1 USD = 26.500 VND** (không có nguồn; tôi không tra được tỉ giá trong phiên). Mọi con số VND tuyến tính theo tỉ giá, tính lại bằng cách nhân với (tỉ giá thật / 26.500).

---

## 1. Đối thủ/tham chiếu AI giáo dục: tính năng, giá, gói khoá, credits hay thuê bao, và số liệu giáo viên dùng/trả tiền

### Takeaway
Công cụ AI chuyên cho giáo viên ở phương Tây thường có gói miễn phí khá rộng và gói trả phí khoảng 50–150 USD/năm (MagicSchool Plus 99,96 USD/năm, Brisk Pro 99,99 USD/năm, Diffit 149,99 USD/năm, Eduaide 49,99 USD/năm); các ông lớn (Google, Khanmigo qua Microsoft) cho giáo viên dùng miễn phí. Tôi **không tìm được** bảng giá AI của Azota/VioEdu/Olm/Hocmai/Vuihoc và **không có số liệu nào về tỉ lệ giáo viên trả tiền riêng cho AI**; chỉ có số liệu tỉ lệ dùng (Mỹ: khoảng 60% đã dùng, 32% dùng hàng tuần).

### Cited Findings
- MagicSchool: Plus giá 99,96 USD/năm (tương đương 8,33 USD/tháng khi trả năm, 12,99 USD/tháng khi trả tháng). Gói miễn phí có "80+ công cụ" + chatbot Raina + 50+ công cụ cho học sinh. Các nguồn **mâu thuẫn** về việc gói miễn phí có giới hạn dùng hay không (một bài đánh giá nói có giới hạn và thiếu lịch sử đầu ra/chỉnh sửa nâng cao; một bản so sánh nói trang giá của hãng không nêu giới hạn). Không nguồn nào nhắc cơ chế "credits"; gói Plus bán theo kiểu "không giới hạn" — [Nguồn thứ cấp] [MagicSchool partner/pricing (qua tìm kiếm)](https://www.magicschool.ai/partner), [Fast.io review](https://fast.io/resources/magic-ai-review-2026/), [Dupple so sánh](https://dupple.com/learn/free-ai-tools-for-teachers)
- Khanmigo: giáo viên K-12 Mỹ dùng miễn phí từ 21/05/2024 nhờ Microsoft tài trợ hạ tầng Azure; trước đó giáo viên trả 4 USD/tháng. Gói learner/phụ huynh vẫn liệt kê 4 USD/tháng (một nguồn ghi 44 USD/năm, chỉ một nguồn) — [Nguồn thứ cấp] [THE Journal 05/2024](https://thejournal.com/articles/2024/05/21/microsoft-khan-academy-partner-to-make-khanmigo-teaching-tool-free.aspx), [Neowin](https://www.neowin.net/news/khan-academys-khanmigo-ai-tool-to-be-free-for-us-educators-thanks-to-microsoft/), [GeekWire](https://www.geekwire.com/2024/microsoft-and-khan-academy-partner-on-khanmigo-ai-tool-for-teachers-in-cloud-shift/). Một trang tổng hợp nói "miễn phí ở 180+ quốc gia" — vượt quá thông báo gốc chỉ nói Mỹ, nên không dùng — [vantaige](https://vantaige.io/ai-tool/khanmigo)
- Brisk Teaching: gói Educator Pro 99,99 USD/năm; có gói miễn phí (xác nhận); một trang khác ghi "Custom pricing, freemium". Diffit: 14,99 USD/tháng hoặc 149,99 USD/năm. Eduaide: 5,99 USD/tháng hoặc 49,99 USD/năm. **Twee: không tìm thấy giá.** Tôi không xác định được con số nào nằm ở trang nào trong số này — [Nguồn thứ cấp] [AI Tools Bakery (Brisk 05/2026)](https://aitoolsbakery.com/blog/brisk-teaching-updates-2026/), [mguhlin so sánh Eduaide/MagicSchool](https://mguhlin.org/portfolio/articles/eduaide-and-magicschool-compare-two-top-ai-tools-for-teachers/), [SlideSpeak Brisk alternatives](https://slidespeak.co/blog/brisk-teaching-alternatives)
- Google Classroom + Gemini: miễn phí cho người dùng Google Workspace for Education, hơn 30 công cụ cho giáo viên (soạn giáo án, quiz xuất sang Google Forms, rubric); tính năng dành cho học sinh do giáo viên bật. Một số tích hợp sâu (Gemini trong Docs/Slides) thuộc gói "Google AI Pro for Education"/Education Plus — **giá chưa tìm thấy**. Bài đăng Workspace Updates 14/04/2026: Gemini in Classroom có ở mọi ngôn ngữ Classroom hỗ trợ (chưa xác nhận tiếng Việt cụ thể) — [Nguồn thứ cấp] [Google Workspace Updates 04/2026](https://workspaceupdates.googleblog.com/2026/04/gemini-in-google-classroom-is-now-available-in-all-Classroom-supported-languages.html), [YourStory (Bett 2026)](https://yourstory.com/ai-story/google-products-and-platforms-education), [Sarah Findlater](https://sarahfindlater.substack.com/p/the-future-just-landed-googles-free)
- Azota: trang liệt kê ứng dụng "Azota Teacher" ghi có "công cụ hỗ trợ chấm bài tự luận" và "chấm bài từ ảnh scan"; Caplight mô tả mô hình B2B freemium + thuê bao SaaS. **Không có bảng giá, không xác nhận "AI chấm bài" là tính năng trả phí hay hạn mức bao nhiêu** — [Nguồn thứ cấp] [mwm.ai Azota Teacher](https://mwm.ai/apps/azota-teacher/1658231068), [Caplight](https://www.caplight.com/company/azota)
- Đối chứng giá chatbot đại trà (mà gia sư có thể tự dùng thay KiN): Claude Free 0 USD, Pro 20 USD/tháng (17 USD/tháng nếu trả năm), Max từ 100 USD/tháng; Team Standard 20–25 USD/ghế/tháng gồm tối đa 500 USD/tháng credits API dùng chung. Gói tiêu dùng giới hạn theo "phiên 5 giờ", gói Max kèm credits API — một ví dụ mô hình lai thuê bao + credits — [Đã kiểm nguồn] [claude.com/pricing](https://claude.com/pricing)
- Gallup–Walton Family Foundation (công bố 25/06/2025, học kỳ 2024–25, giáo viên công lập Mỹ): 60% đã dùng AI cho công việc; 32% dùng ít nhất hàng tuần, 28% thỉnh thoảng, 40% không dùng. Người dùng hàng tuần tiết kiệm trung bình 5,9 giờ/tuần (khoảng 6 tuần/năm học). 68% không được đào tạo; chỉ 19% trường có chính sách AI; trường có chính sách tiết kiệm 2,3 giờ/tuần so với 1,7 giờ. 57% cho rằng AI sẽ làm giảm tư duy độc lập của học sinh, 52% giảm tư duy phản biện; 28% còn phản đối AI trong lớp — [Nguồn thứ cấp] [The 74](https://the74million.org/article/survey-60-of-teachers-used-ai-this-year-and-saved-up-to-6-hours-of-work-a-week/), [Walton Family Foundation](https://www.waltonfamilyfoundation.org/the-ai-dividend-new-survey-shows-ai-is-helping-teachers-reclaim-valuable-time), [Idaho EdNews](https://www.idahoednews.org/news/survey-most-teachers-used-ai-and-saved-six-hours-of-work-a-week/)
- RAND (báo cáo 2024, dữ liệu mùa thu 2023, n=1.020): chỉ 18% giáo viên dùng AI trong công việc, 15% đã thử nhưng không định dùng thường xuyên — [Nguồn thứ cấp] [WJLA đưa tin RAND](https://wjla.com/news/nation-world/teachers-trying-out-ai-but-use-of-the-tools-are-on-the-bleeding-edge-in-schools-artificial-intelligence-classrooms-students-ai-virtual-platforms-adaptive-learning-systems-chatbots-rand-corp-research)
- **Chưa xác minh** (chỉ qua một blog, không mở được RAND/NPR gốc): RAND mùa xuân 2025 cho 53% giáo viên Anh/Toán/Khoa học Mỹ dùng AI để lên kế hoạch/dạy (n=8.601; năm trước 25%); NPR/Ipsos mùa xuân 2026 cho 62% giáo viên K-12 đã dùng AI — [Nguồn thứ cấp, độ tin cậy thấp] [CSBA blog](https://blog.csba.org/ai-classroom-use/)
- Việt Nam: bài "Thực trạng sử dụng trí tuệ nhân tạo (AI) của giáo viên phổ thông Việt Nam" (Viện Khoa học Giáo dục VN + UNICEF VN, Tạp chí Giáo dục số 25(21), 05/11/2025) kết luận giáo viên có nhận thức tích cực, đã bắt đầu đưa AI vào dạy nhưng mức áp dụng còn hạn chế, một phần vì thiếu kỹ năng phản biện để đánh giá đầu ra AI. **Tôi chưa đọc được tỉ lệ cụ thể** — [Nguồn thứ cấp] [Tạp chí Giáo dục](https://tcgd.tapchigiaoduc.edu.vn/index.php/tapchi/article/view/4379)
- Bằng chứng ngược chiều về chất lượng chấm: Anthropic Education Report (27/08/2025; 74.000 hội thoại của giảng viên/cán bộ đại học trên Claude.ai gói Free/Pro, 22/05–02/06/2025; 22 giảng viên Northeastern): 57% hội thoại là phát triển chương trình, chỉ 7% là đánh giá sinh viên; trong nhóm đánh giá, 48,9% là kiểu AI tự làm hẳn (automation-heavy); giảng viên xếp chấm bài là mảng AI kém hiệu quả nhất, một giảng viên nói bài do LLM chấm "chưa đủ tốt", đa số đồng ý chấm bài không nên gần như tự động hoàn toàn. Lưu ý: mẫu là giảng viên đại học, không phải gia sư — [Đã kiểm nguồn] [Anthropic Education Report](https://www.anthropic.com/news/anthropic-education-report-how-educators-use-claude)

### Inferences
- [Suy luận] Quy đổi giá tham chiếu theo tỉ giá giả định 26.500: Eduaide 49,99 USD/năm ≈ 1,32 triệu đ/năm ≈ 110 nghìn đ/tháng; MagicSchool Plus ≈ 2,65 triệu đ/năm ≈ 220 nghìn đ/tháng; Diffit 149,99 USD/năm ≈ 3,97 triệu đ/năm ≈ 331 nghìn đ/tháng. Mức 42–99 nghìn đ/tháng của KiN (≈1,6–3,7 USD) thấp hơn khoảng 2–8 lần. KiN không thể định giá ngang đối thủ Mỹ; lý lẽ để người dùng trả là AI gắn với dữ liệu lớp học của chính họ.
- [Suy luận] Phần "AI sinh nội dung chung" (soạn giáo án, bài đọc, quiz chung) đang bị miễn phí hoá bởi Google, Khanmigo, gói free của MagicSchool/Brisk và chatbot đại trà. Phần không có miễn phí tương đương là AI dùng dữ liệu điểm danh/điểm/bài tập/học phí đã nằm trong KiN (báo cáo tháng, lộ trình ôn theo điểm yếu, nhận xét từ bài làm của học viên đó).
- [Suy luận] Từ các số liệu Mỹ, người dùng AI đều đặn là thiểu số (khoảng 1/3 dùng hàng tuần) và đa số chưa được đào tạo; nên tính năng Pro phải "thấy kết quả ngay, một nút", không đòi viết prompt.
- [Suy luận] Chưa có bằng chứng cho thấy giáo viên/gia sư trả tiền riêng cho AI ở quy mô lớn; các hãng lớn chọn tặng miễn phí cho giáo viên và kiếm tiền ở tổ chức/học sinh. Gói Pro của KiN nên coi AI là lý do giữ chân/nâng cấp phụ chứ chưa nên là lý do duy nhất để thu phí.

### Gaps
- Giá, hạn mức và gói khoá của AI chấm bài Azota; VioEdu; Olm; Hocmai; Vuihoc — không tìm được (azota.vn không mở được; hết hạn mức tìm kiếm trước khi tìm các hãng VN còn lại).
- Chưa tra: Duolingo Max, Quizlet Plus, Photomath Plus, Gauth, Twee, Kahoot AI, Canva Magic Studio, Microsoft Copilot cho giáo viên (giá, cách khoá, giới hạn). Cần một lượt tìm kiếm mới.
- Không có số liệu về tỉ lệ giáo viên **trả tiền** cho AI ở bất kỳ nước nào; chưa tra Common Sense Media, EdWeek Research Center, báo cáo Gallup riêng; chưa có số liệu khảo sát Việt Nam có tỉ lệ cụ thể (chưa đọc được toàn văn bài Tạp chí Giáo dục).
- Không xác nhận được giới hạn dùng thực tế của gói free MagicSchool/Brisk/Diffit (nguồn mâu thuẫn).
- Giá Google AI Pro for Education và Microsoft Copilot cho giáo dục chưa tìm thấy.

---

## 2. Công việc nào của gia sư 1–20 học viên được AI giải quyết có giá trị nhất

### Takeaway
Bằng chứng trực tiếp về gia sư rất ít. Dựa trên số liệu khảo sát chung (tiết kiệm giờ ở người dùng đều đặn; giảng viên ngại AI chấm bài) và lợi thế dữ liệu của KiN, thứ tự đáng làm của tôi là: (1) nhận xét/báo cáo cuối tháng cho phụ huynh, (2) nhập đề/soạn đề từ ảnh/PDF và sinh câu hỏi có duyệt, (3) gợi ý điểm + nhận xét cho bài làm (gia sư duyệt), (4) lộ trình ôn theo điểm yếu; các việc nhắn tin/nhắc phí/giới thiệu nên miễn phí hoặc dùng mẫu có sẵn. Toàn bộ xếp hạng dưới đây là [Suy luận].

### Cited Findings
- Người dùng AI hàng tuần tiết kiệm trung bình 5,9 giờ/tuần (Mỹ, giáo viên công lập) — chứng cứ rằng "tiết kiệm thời gian" là giá trị chính được cảm nhận; khảo sát không cho tôi tách theo từng loại việc — [Nguồn thứ cấp] [The 74](https://the74million.org/article/survey-60-of-teachers-used-ai-this-year-and-saved-up-to-6-hours-of-work-a-week/)
- Giảng viên đại học dùng Claude chủ yếu để phát triển chương trình (57%), ít để đánh giá sinh viên (7%), và đánh giá chấm bài là mảng kém hiệu quả nhất — [Đã kiểm nguồn] [Anthropic Education Report](https://www.anthropic.com/news/anthropic-education-report-how-educators-use-claude)
- Khả năng thị giác của Claude có giới hạn tự thừa nhận: có thể bịa/sai với ảnh chất lượng thấp, bị xoay, hoặc nhỏ dưới 200 px; "không dùng cho tác vụ cần độ chính xác tuyệt đối mà không có giám sát của con người" — liên quan trực tiếp đến OCR chữ viết tay của học sinh — [Đã kiểm nguồn] [Claude Vision docs](https://platform.claude.com/docs/en/build-with-claude/vision)
- Anthropic định vị Claude Haiku 5.5 cho "tác vụ khối lượng lớn, nhạy độ trễ như phân loại, trích xuất, định tuyến" và Sonnet 5.5 là "sự kết hợp tốt nhất giữa tốc độ và trí tuệ" — gợi ý phân tầng model theo loại việc — [Đã kiểm nguồn] [Models overview](https://platform.claude.com/docs/en/models/overview)
- Hiện trạng KiN (nền để đánh giá): đã có AI trích câu hỏi từ file bằng `gemini-2.5-flash` và tra trùng bằng `gemini-embedding-001` 768 chiều — [Repo: src/lib/aiExamImport.ts](../../../../../src/lib/aiExamImport.ts), [Repo: src/lib/embeddings.ts](../../../../../src/lib/embeddings.ts)

### Inferences
Thang 1–5 (5 là tốt nhất; với "rủi ro sai" thì 5 là rủi ro cao nhất). Chi phí lấy từ mục 3 (Haiku 5.5 / Sonnet 5.5, VND mỗi lần). Tất cả là [Suy luận], chưa kiểm với gia sư thật.

| Việc | Giá trị cảm nhận | Tần suất | "Thấy kết quả ngay" | Rủi ro sai | Chi phí/lần (Haiku / Sonnet) | Nhận định |
|---|---|---|---|---|---|---|
| Nhận xét/báo cáo tháng cho phụ huynh, giọng gia sư | 5 | 1 lần/học viên/tháng (10 học viên = 10 bản) | 5 | 3 (bịa chi tiết, sai giọng; giảm bằng chỉ dùng dữ liệu có sẵn) | 17 / 344 | Ứng viên số 1. KiN đã có điểm danh, điểm, ghi chú, báo cáo tháng nên không đối thủ chung nào có dữ liệu này. Gia sư duyệt rồi mới gửi |
| Soạn đề/bài tập từ ảnh/PDF (đã có) và sinh thêm câu có đáp án | 4–5 | vài lần/tuần | 4 | 4 (sai đáp án, trùng đề, bản quyền) | sinh 10 câu: 42 / 837; import đề 4 trang: 111 / 2.226 | Đáng làm nhưng bắt buộc bước duyệt; đã có hạ tầng |
| Ảnh bài làm → điểm + nhận xét (trắc nghiệm/đáp án ngắn) | 4 | cao nếu giao bài giấy | 4 | 4 (đọc sai chữ viết tay) | 18 / 355 | Chỉ nên là "gợi ý điểm", gia sư xác nhận từng dòng |
| Chấm tự luận Anh (Writing) | 4 | trung bình | 4 | 3 | 21 / 424 | Mạnh nhất trong nhóm tự luận |
| Chấm tự luận Văn | 3–4 | trung bình | 3 | 5 (chủ quan, thiên lệch phong cách) | 21 / 424 | Vạch đỏ mềm: chỉ nhận xét theo rubric, không cho điểm tự động |
| Chấm tự luận Toán (kiểm từng bước) | 4 | trung bình | 3 | 4–5 (suy luận sai, lệ thuộc model mạnh) | 44 / 874 | Cần model mạnh, tốn gấp ~2 lần chấm Văn/Anh |
| Lộ trình ôn theo điểm yếu | 3–4 | 1 lần/học viên/tháng | 3 | 2 | 24 / 477 | Cần điểm theo chủ đề; KiN có từ bài tập/thi thử |
| Tóm tắt buổi học | 3 | cao | 3 | 2 | 8 / 159 | Phụ thuộc gia sư gõ ghi chú đầu vào; giá trị nằm ở nuôi dữ liệu cho báo cáo tháng |
| Trả lời tin nhắn phụ huynh thường gặp | 3 | cao | 3 | 3 (hứa hẹn/cam kết sai) | 5 / 98 | KiN không giữ hộp thư phụ huynh (Zalo bên ngoài); chỉ là ô dán-và-soạn |
| Soạn tin nhắc học phí lịch sự | 2 | cao | 3 | 1 | 3 / 56 | Mẫu có sẵn là đủ; coi AI ở đây là gimmick, để miễn phí |
| Viết hồ sơ/giới thiệu gia sư | 3 | 1 lần | 5 | 2 | 9 / 186 | Nên miễn phí để tăng độ hoàn thiện hồ sơ công khai (tăng trưởng) |

- [Suy luận] "Chọn đề từ ngân hàng câu hỏi" không cần LLM (tìm/lọc và tra trùng bằng embedding đã có); chỉ phần *sinh mới* và *nhập từ ảnh/PDF* mới tốn tiền model.
- [Suy luận] Gói Pro nên bán "thứ ráp từ dữ liệu của tôi" (báo cáo, lộ trình, nhận xét bài làm), không bán "ô chat AI".

### Gaps
- Không có khảo sát nào tách "việc nào của gia sư/giáo viên dạy kèm thấy đáng tiền nhất"; mọi điểm số ở bảng là phán đoán. Cần phỏng vấn 8–10 gia sư (đặt giá thử 49.000/99.000đ) hoặc đo bằng thử nghiệm bản "cửa giả" (fake door) trong app.
- Không có đo lường độ chính xác thực của từng model khi chấm bài viết tay tiếng Việt / tự luận Văn / Toán lớp 6–12 (xem mục 3, Gaps).
- Chưa biết bao nhiêu gia sư KiN thực sự giao bài giấy chụp ảnh so với bài làm trực tiếp trên web (có sẵn trong KiN nhưng không có số trong tài liệu tôi đọc).

---

## 3. Chi phí vận hành thật: bảng giá API, token mỗi tác vụ, chi phí mỗi lần và mỗi gia sư/tháng, biên lợi nhuận, chất lượng tiếng Việt

### Takeaway
Theo bảng giá chính thức Anthropic hôm nay, Claude Haiku 5.5 chỉ 0,10/0,50 USD mỗi triệu token (vào/ra), rẻ gấp 20 lần Sonnet 5.5 (2/10 USD): một báo cáo tháng tốn khoảng 17 đ bằng Haiku và khoảng 344 đ bằng Sonnet. Một gia sư "nặng" (20 học viên, 200 bài chấm ảnh, 200 bài tự luận) tốn khoảng 13 nghìn đ/tháng nếu dùng toàn Haiku nhưng khoảng 263 nghìn đ/tháng nếu toàn Sonnet, tức vượt xa giá bán 49–199 nghìn đ. **Quyết định tầng model và hạn mức quan trọng hơn mọi tối ưu khác.** Chất lượng tiếng Việt của từng model chưa có nguồn độc lập kiểm được.

### Cited Findings

**Bảng giá API Claude (USD/triệu token), truy cập 22/10/2026 — [Đã kiểm nguồn] [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)**

| Model | Vào | Ra | Ghi cache 5p | Ghi cache 1h | Đọc cache | Batch vào/ra |
|---|---|---|---|---|---|---|
| Claude Haiku 5.5 (prompt ≤100k) | 0,10 | 0,50 | 0,125 | 0,20 | 0,01 | 0,05 / 0,25 |
| Claude Haiku 5.5 (prompt >100k) | 0,50 | 2,50 | 0,625 | 1,00 | 0,05 | 0,25 / 1,25 |
| Claude Sonnet 5.5 | 2 | 10 | 2,50 | 4 | 0,10 | 1 / 5 |
| Claude Sonnet 5 | 2 | 10 | 2,50 | 4 | 0,20 | 1 / 5 |
| Claude Opus 5.5 | 4 | 20 | 5 | 8 | 0,20 | 2 / 10 |
| Claude Fable 5.1 | 10 | 50 | 12,50 | 20 | 0,25 | 5 / 25 |
| Claude Haiku 4.5 (đời cũ) | 1 | 5 | 1,25 | 2 | 0,10 | 0,50 / 2,50 |
| Claude Sonnet 4.6 (đời cũ) | 3 | 15 | 3,75 | 6 | 0,30 | 1,50 / 7,50 |

- Ghi chú trên trang giá: giá giới thiệu 2/10 USD của Sonnet 5 nay là giá chuẩn, đợt tăng lên 3/15 USD dự kiến 01/09/2026 **sẽ không xảy ra**. Từ Claude 4.7 trở đi dùng tokenizer mới tạo ra **nhiều hơn khoảng 30% token** cho cùng một văn bản so với Sonnet 4.6 trở về trước. Chọn xử lý chỉ ở Mỹ (`inference_geo: "us"`) tính thêm ×1,1. Batch giảm 50% cả vào lẫn ra — [Đã kiểm nguồn] [Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Cache: đọc cache bằng 0,1× giá vào (0,05× cho Opus 5.5/Sonnet 5.5, 0,025× cho Fable 5.1). Ngưỡng tối thiểu để cache chỉ **512 token** cho các model 5.x (4.096 token cho Haiku 4.5), nên system prompt ngắn của KiN cache được. TTL 5 phút (ghi 1,25×) hoặc 1 giờ (ghi 2×) — [Đã kiểm nguồn] [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- Batch API: hầu hết xong trong 1 giờ, tối đa 24 giờ (quá hạn bị huỷ), mỗi batch tối đa 100.000 request hoặc 256 MB, kết quả giữ 29 ngày — [Đã kiểm nguồn] [Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
- Chi phí ảnh: mỗi ảnh = ⌈rộng/28⌉ × ⌈cao/28⌉ token. Model 4.7 trở lên (gồm 5.x) tối đa 2.576 px cạnh dài / 4.784 token mỗi ảnh; ví dụ ảnh 2000×1500 px = 3.888 token, ảnh 1000×1000 = 1.296 token. Có thể thu nhỏ trước để giảm token — [Đã kiểm nguồn] [Vision](https://platform.claude.com/docs/en/build-with-claude/vision)
- Độ dài văn bản: tài liệu Anthropic ghi 1 triệu token ≈ 555 nghìn từ tiếng Anh ≈ 2,5 triệu ký tự Unicode trên tokenizer hiện tại — [Đã kiểm nguồn] [Models overview](https://platform.claude.com/docs/en/models/overview)
- Điều khiển "suy nghĩ" (tính vào token ra): Haiku 5.5 mặc định effort `medium`, bật thinking sẵn, có thể tắt thinking (`disabled`) ở effort từ `high` trở xuống; Sonnet 5.5 mặc định `high`, **không** cho `disabled` mà có chế độ `between_tools` (tắt suy nghĩ trước) ở low/medium/high; Opus 5.5 không tắt được thinking. Effort là tín hiệu hành vi, không phải ngân sách token cứng; thinking tính vào `max_tokens` — [Đã kiểm nguồn] [Effort](https://platform.claude.com/docs/en/build-with-claude/effort), [Models overview](https://platform.claude.com/docs/en/models/overview)
- Hạn mức chi tiêu theo tổ chức: Start 500 USD/tháng, Build 1.000 USD/tháng, Scale 200.000 USD/tháng. Chạm trần thì **toàn bộ** request trả HTTP 429 (không có `retry-after`) đến 00:00 UTC ngày 1 tháng sau; tự đặt trần thấp hơn thì trả HTTP 400. Có thể đặt trần chi tiêu và rate limit theo workspace (không đặt được cho workspace mặc định). Token đọc từ cache không tính vào ITPM — [Đã kiểm nguồn] [Rate limits](https://platform.claude.com/docs/en/api/rate-limits)

**Bảng giá Gemini/OpenAI (để so) — [Nguồn thứ cấp], KHÔNG xác nhận ở trang Google/OpenAI (cả hai domain không mở được)**
- Gemini 2.5 Flash 0,30 vào / 2,50 ra; Gemini 2.5 Flash-Lite 0,10 / 0,40 (nhất quán giữa các nguồn) — [Morph: Gemini API Pricing](https://www.morphllm.com/gemini-api-pricing), [AnotherWrapper](https://anotherwrapper.com/tools/llm-pricing/gemini-3.5-flash/gemini-2.0-flash-lite)
- Các đời mới **mâu thuẫn giữa các nguồn**: Gemini 3.1 Flash-Lite 0,25/1,50; Gemini 3.5 Flash 1,50/9,00 (một bảng); Gemini 3.5 Flash-Lite 0,30/2,50 (một trang tính "xác minh 24/07/2026") — [Morph](https://www.morphllm.com/gemini-api-pricing), [TrevorFox calculator](https://trevorfox.com/tools/calculators/llm-cost/google-gemini/gemini-3.5-flash-lite/)
- GPT-5 mini 0,25 vào / 2,00 ra theo hai trang tổng hợp (02/09 và 15/09/2026); nhưng một bài Morph tháng 06/2026 cho biết GPT-5, GPT-5-mini, GPT-4o không còn được liệt kê, nên chưa chắc còn bán; các con số khác (0,15 / 0,80 / 3,00) là ngoại lai — [AnotherWrapper GPT-5 mini](https://anotherwrapper.com/llm-pricing/gpt-5-mini-2025-08-07), [Morph OpenAI pricing](https://morphllm.com/openai-api-pricing)

**Chất lượng tiếng Việt**
- Trang đa ngôn ngữ của Anthropic: điểm MMLU dịch sang 14 ngôn ngữ (không có tiếng Việt), đo bằng % so với tiếng Anh. Haiku 4.5 so với Sonnet 4.5: Indonesia 94,2% vs 97,3%; Hindi 92,4% vs 96,7%; Bengali 90,4% vs 95,4%; Swahili 78,3% vs 91,1%; Yoruba 52,7% vs 79,7%. Khoảng cách giữa model nhỏ và lớn **nới rộng khi ngôn ngữ ít tài nguyên hơn**. Chỉ có số của đời 4.5, chưa có số cho Haiku/Sonnet 5.5 — [Đã kiểm nguồn] [Multilingual support](https://platform.claude.com/docs/en/build-with-claude/multilingual-support)
- Anthropic nêu mọi model hiện hành đều hỗ trợ đa ngôn ngữ và khuyên tự kiểm thử trên ngôn ngữ của mình; nên chỉ định ngôn ngữ đích trong system prompt — [Đã kiểm nguồn] [Models overview](https://platform.claude.com/docs/en/models/overview), [Multilingual support](https://platform.claude.com/docs/en/build-with-claude/multilingual-support)

### Inferences

#### Giả định tính toán (để người đọc tính lại)
- Tỉ giá 26.500 đ/USD [giả định, không nguồn]. Giá token: bảng trên (Claude, [Đã kiểm nguồn]; Gemini 2.5 Flash 0,30/2,50 [Nguồn thứ cấp]). Không tính thuế GTGT, phí cổng thanh toán, hạ tầng Vercel/Neon, chi phí hỗ trợ.
- Token tiếng Việt: giả định **2 token cho 1 "tiếng" (âm tiết)** trên tokenizer Claude mới, cộng thêm hệ số an toàn; **chưa đo thực tế**. Cần đo lại bằng 20 mẫu thật. Mô phỏng độ nhạy: nhân mọi token ×1,5 và riêng token ra ×3 (khi model nghĩ nhiều).
- Số token mỗi lần [Suy luận] (vào / ra gồm cả thinking; phần đầu vào tĩnh có thể cache):
  - A. Báo cáo tháng 1 học sinh: vào 2.500 (system 1.000 + dữ liệu 1.500), ra 800.
  - B. Tóm tắt buổi học (từ ghi chú gõ): vào 1.000, ra 400.
  - C. Sinh 10 câu trắc nghiệm có đáp án + giải thích: vào 800, ra 3.000.
  - D. Chấm 1 trang bài làm từ ảnh: ảnh ≈ 1200×1700 px = 2.623 token + prompt/đáp án 600 → vào 3.200, ra 700 (chép lại + điểm + nhận xét).
  - E. Chấm 1 bài tự luận Văn/Anh: vào 2.000, ra 1.200. E2. Toán tự luận kiểm từng bước: vào 1.500, ra 3.000.
  - F. Lộ trình ôn theo điểm yếu: vào 3.000, ra 1.200.
  - G. Trả lời tin nhắn phụ huynh: vào 600, ra 250. H. Nhắc học phí: vào 300, ra 150. I. Hồ sơ giới thiệu: vào 500, ra 600.
  - J. Nhập đề PDF 4 trang → ~40 câu JSON: vào 12.000, ra 6.000.
- Ba mức dùng/tháng/gia sư (lượt A/B/C/D/E/E2/F/G/H/J): Nhẹ (5 học viên) 5/10/2/10/10/0/5/10/5/0; Vừa (10 học viên) 10/30/6/40/40/10/10/30/10/1; Nặng (20 học viên) 20/80/20/200/200/50/20/80/20/4.

#### Chi phí mỗi lần (VND, không cache, không batch)

| Việc | Haiku 5.5 | Haiku 4.5 | Sonnet 5.5 | Opus 5.5 | Gemini 2.5 Flash* |
|---|---|---|---|---|---|
| A. Báo cáo tháng 1 HS | 17 | 73 | 344 | 689 | 15 |
| B. Tóm tắt buổi học | 8 | 34 | 159 | 318 | 7 |
| C. Sinh 10 câu hỏi | 42 | 205 | 837 | 1.675 | 34 |
| D. Chấm 1 trang từ ảnh | 18 | 72 | 355 | 710 | 16 |
| E. Tự luận Văn/Anh | 21 | 95 | 424 | 848 | 18 |
| E2. Tự luận Toán | 44 | 211 | 874 | 1.749 | 36 |
| F. Lộ trình ôn | 24 | 103 | 477 | 954 | 21 |
| G. Tin nhắn phụ huynh | 5 | 21 | 98 | 196 | 4 |
| H. Nhắc học phí | 3 | 12 | 56 | 111 | 2 |
| I. Hồ sơ giới thiệu | 9 | 44 | 186 | 371 | 8 |
| J. Nhập đề PDF 4 trang | 111 | 493 | 2.226 | 4.452 | 95 |

*Giá Gemini là [Nguồn thứ cấp]. Gần như mọi tác vụ chữ dưới 1 US cent với Haiku 5.5 (ví dụ báo cáo tháng ≈ 0,065 US cent); với Sonnet 5.5 từ khoảng 0,2 đến 3,3 US cent, riêng nhập đề PDF 8,4 US cent.

#### Chi phí mỗi gia sư mỗi tháng (VND, không cache)

| Chiến lược model | Nhẹ (5 HS) | Vừa (10 HS) | Nặng (20 HS) |
|---|---|---|---|
| Toàn Haiku 5.5 | 821 | 3.182 | 13.165 |
| Hỗn hợp: Haiku cho chữ; Sonnet 5.5 cho chấm (D, E, E2), lộ trình (F), nhập đề (J) | 10.488 | 47.742 | 220.255 |
| Toàn Sonnet 5.5 | 16.422 | 63.642 | 263.304 |
| Toàn Gemini 2.5 Flash* (hạ tầng KiN hiện tại) | 3.583 | 14.078 | 58.284 |
| Toàn Haiku 4.5 (tham khảo) | 8.211 | 31.821 | 131.652 |
| Toàn Opus 5.5 (tham khảo) | 32.844 | 127.285 | 526.608 |

- Với cache system prompt + batch cho A và F: Haiku 5.5 còn 648 / 2.727 / 11.748; Sonnet 5.5 còn 12.883 / 54.258 / 233.831; hỗn hợp 8.415 / 41.769 / 198.659. **Cache và batch chỉ giảm khoảng 10–20%** vì đầu vào ngắn; đáng làm nhưng không phải đòn bẩy chính.
- Độ nhạy: token ×1,5 → Haiku 5.5 1.232 / 4.773 / 19.748; Sonnet 5.5 24.633 / 95.464 / 394.956. Token ra ×3 (thinking nhiều) → Haiku 5.5 1.941 / 7.714 / 31.954; Sonnet 5.5 38.815 / 154.272 / 639.074.
- Dùng thử miễn phí 5 lượt (A, D, E, C, G): khoảng 103 đ với Haiku 5.5, khoảng 2.059 đ với Sonnet 5.5, khoảng 467 đ với Gemini 2.5 Flash*.
- Quy mô 1.000 gia sư trả phí ở mức "Vừa": khoảng 3,2 triệu đ/tháng (toàn Haiku 5.5) đến khoảng 47,7 triệu đ/tháng (hỗn hợp) đến khoảng 63,6 triệu đ/tháng (toàn Sonnet 5.5).

#### Biên lợi nhuận gộp theo giá bán (chỉ trừ chi phí AI, trước GTGT/phí thanh toán)

| Chiến lược / mức dùng | Giá vốn AI | 49.000đ | 99.000đ | 199.000đ |
|---|---|---|---|---|
| Toàn Haiku 5.5, Nhẹ | 821 | 98% | 99% | 100% |
| Toàn Haiku 5.5, Vừa | 3.182 | 94% | 97% | 98% |
| Toàn Haiku 5.5, Nặng | 13.165 | 73% | 87% | 93% |
| Hỗn hợp, Nhẹ | 10.488 | 79% | 89% | 95% |
| Hỗn hợp, Vừa | 47.742 | 3% | 52% | 76% |
| Hỗn hợp, Nặng | 220.255 | −349% | −122% | −11% |
| Toàn Sonnet 5.5, Nhẹ | 16.422 | 66% | 83% | 92% |
| Toàn Sonnet 5.5, Vừa | 63.642 | −30% | 36% | 68% |
| Toàn Sonnet 5.5, Nặng | 263.304 | −437% | −166% | −32% |
| Toàn Gemini 2.5 Flash*, Vừa | 14.078 | 71% | 86% | 93% |
| Toàn Gemini 2.5 Flash*, Nặng | 58.284 | −19% | 41% | 71% |

- **Số lượt chấm tối đa mỗi tháng nếu muốn giá vốn AI ≤30% giá bán** (chỉ tính riêng việc chấm): Sonnet 5.5 ở 49.000đ ≈ 41 lượt chấm ảnh, 35 lượt tự luận Văn/Anh, 17 lượt Toán tự luận; ở 99.000đ ≈ 84 / 70 / 34; ở 199.000đ ≈ 168 / 141 / 68. Haiku 5.5 ở 49.000đ ≈ 828 / 693 / 336.
- [Suy luận] Điều này nghĩa là: nếu chấm bằng model cỡ Sonnet, gói 49.000đ **bắt buộc có hạn mức theo lượt**; nếu chấm đủ tốt bằng Haiku 5.5 thì hầu như không cần hạn mức cứng cho các tác vụ chữ. **Việc lớn nhất cần đo là Haiku 5.5 chấm bài viết tay/tự luận tiếng Việt có đủ tin cậy không** (xem Gaps).
- [Suy luận] Haiku 5.5 theo giá chính thức rẻ hơn Gemini 2.5 Flash (giá thứ cấp) khoảng 3 lần đầu vào và 5 lần đầu ra. Nếu chất lượng tiếng Việt tương đương, có thể chuyển các tác vụ chữ của KiN từ Gemini sang Haiku 5.5 để giảm giá vốn; nhưng đang dùng Gemini nên chuyển phải đo lại chất lượng nhập đề từ PDF/ảnh (hiện là tính năng đã chạy).
- [Suy luận] Phân tầng gợi ý: Haiku 5.5 (effort low/medium, tắt thinking) cho A, B, G, H, I, tin nhắn; Sonnet 5.5 chỉ cho chấm Toán/Văn và nhập đề phức tạp, gắn hạn mức; Opus/Fable không đáng cho bài toán này (Opus 5.5 đắt gấp 2 lần Sonnet, Fable 5.1 còn bị bắt lưu 30 ngày, xem mục 4).
- [Suy luận] Tính đến hạn mức chi tiêu tổ chức (Start 500 USD ≈ 13,25 triệu đ/tháng): với "Vừa + hỗn hợp", chỉ khoảng 277 gia sư trả phí đã chạm trần 500 USD nếu dùng Sonnet nhiều; chạm trần thì **mọi gia sư** bị 429 cùng lúc. Phải tự đặt trần và cảnh báo thấp hơn trần dịch vụ.

### Gaps
- **Giá chính thức Gemini và OpenAI chưa kiểm được** (ai.google.dev, openai.com không mở được; trang giá Google Cloud không có nội dung). Các đời Gemini 3.x mâu thuẫn giữa nguồn. Cần mở trang gốc trước khi chọn nhà cung cấp.
- **Không có benchmark tiếng Việt độc lập** cho model hiện hành: không mở được VMLU, ViLLM-Eval, Open VN LLM Leaderboard, và không có điểm cho Claude 5.x/Gemini 3.x/GPT-5.x. Trang của Anthropic không đo tiếng Việt. Cần tự dựng bộ đánh giá nội bộ (gợi ý 30 báo cáo mẫu + 30 bài tự luận đã được gia sư chấm tay, so Haiku 5.5 / Sonnet 5.5 / Gemini).
- Số token tiếng Việt chưa đo; hệ số 2 token/tiếng là giả định. Cần đo trên mẫu thật vì tokenizer Claude đời mới tạo nhiều token hơn.
- Chưa có: giá `gemini-embedding-001` (KiN đang dùng cho tra trùng; mỗi câu hỏi chỉ vài trăm token nên khả năng cao không đáng kể nhưng chưa kiểm), lịch ngừng hỗ trợ Gemini 2.5 Flash (KiN đang chạy `gemini-2.5-flash`), điều khoản dữ liệu của gói API trả phí vs miễn phí của Google, phí Vercel/Neon cho hàng đợi.
- Tỉ giá, GTGT dịch vụ phần mềm, phí cổng thanh toán cho thuê bao: chưa tra, nên "biên gộp" ở trên chưa phải biên ròng.
- Chưa có bảng giá/ chất lượng của model Việt (Viettel, FPT, VinAI...) làm phương án nội địa hoá dữ liệu.

---

## 4. Rủi ro và vạch đỏ: sai khi chấm, thiên lệch, dữ liệu trẻ em, chính sách nhà cung cấp, bản quyền, lạm dụng, chi phí bùng nổ

### Takeaway
Về phía nhà cung cấp, Anthropic định nghĩa "trẻ vị thành niên" là dưới 18 tuổi bất kể quốc gia, và đòi thêm biện pháp bảo vệ (xác minh tuổi, kiểm duyệt, giám sát/báo cáo) khi sản phẩm cho trẻ *tương tác trực tiếp* với model; chấm bài ảnh hưởng tuyển sinh/tốt nghiệp là "rủi ro cao" cần người có trình độ duyệt thật. Anthropic không có vùng xử lý ở Việt Nam hay châu Á (chỉ "global" hoặc "us"), nên chuyển dữ liệu ra nước ngoài là không tránh được. Thiết kế an toàn nhất cho KiN: AI chỉ dành cho gia sư (người lớn), không chatbot cho học viên, ẩn danh khi gửi, gia sư duyệt mọi thứ trước khi tới phụ huynh. Phần pháp lý Việt Nam chưa kiểm được văn bản gốc.

### Cited Findings
- Anthropic: "Chúng tôi định nghĩa trẻ vị thành niên hay trẻ em là bất kỳ cá nhân nào dưới 18 tuổi, bất kể quốc gia". Điều kiện tuổi dùng sản phẩm của Anthropic nằm ở Điều khoản dịch vụ. Tổ chức cho trẻ "trực tiếp tương tác với sản phẩm tích hợp API" phải tuân thủ hướng dẫn bổ sung. Trang hiển thị "Effective date: Nov 12, 2026" (muộn hơn hôm nay 22/10/2026 — có thể là bản sắp có hiệu lực, nên đọc thêm bản hiện hành) — [Đã kiểm nguồn, qua tóm tắt của công cụ] [Anthropic Usage Policy](https://www.anthropic.com/legal/aup)
- Hướng dẫn trẻ em cho nhà phát triển: biện pháp bổ sung áp dụng nếu sản phẩm "cho phép trẻ tương tác trực tiếp với model"; dịch vụ tiêu dùng của chính Anthropic chỉ dành cho người từ 18 tuổi; liệt kê xác minh tuổi, kiểm duyệt/lọc nội dung, cơ chế giám sát và báo cáo; trách nhiệm triển khai biện pháp thuộc về nhà phát triển. Trang này không nêu chi tiết đồng ý của cha mẹ hay xử lý dữ liệu; chi tiết nằm ở "Guidelines for Organizations Serving Minors" (không mở được) — [Đã kiểm nguồn] [Child safety guidance for developers](https://support.claude.com/en/articles/15591275-child-safety-guidance-for-developers)
- Chính sách rủi ro cao: lĩnh vực "Giáo dục và chứng chỉ" gồm "chấm bài thi hoặc bài đánh giá quyết định việc nhập học, tốt nghiệp, cấp phép hay chứng nhận"; yêu cầu một người đủ trình độ "xem xét thực chất" khuyến nghị AI trước khi dùng, và người bị ảnh hưởng phải được báo rõ là có dùng AI — [Đã kiểm nguồn, qua tóm tắt của công cụ] [Anthropic Usage Policy](https://www.anthropic.com/legal/aup)
- Lưu dữ liệu API: nội dung prompt/đầu ra **không được lưu mặc định**, ngoại trừ "Covered Models" (Fable 5.1, Mythos 5.1, Fable 5, Mythos 5) buộc lưu 30 ngày và không có ZDR. Dữ liệu được lưu không dùng để huấn luyện nếu chưa có phép rõ ràng. Nếu bị hệ thống an toàn gắn cờ có thể lưu đến 2 năm. Batch API lưu yêu cầu/kết quả đến 29 ngày (có thể xoá batch sau khi xử lý) và không thuộc ZDR — [Đã kiểm nguồn] [API and data retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention), [Batch processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
- Điều khoản thương mại: "Anthropic không được huấn luyện model trên Customer Content"; khách hàng bảo đảm có đủ quyền để gửi Inputs và bồi hoàn nếu Inputs/dữ liệu gây khiếu nại bên thứ ba; khách hàng phải thông báo cho người dùng cuối về độ tin cậy của khẳng định thực tế trong Outputs (D.3). Trang này không có điều khoản riêng về trẻ em; ngày hiệu lực hiển thị 17/06/2025 — [Đã kiểm nguồn] [Commercial Terms](https://www.anthropic.com/legal/commercial-terms)
- Vùng xử lý: chỉ có `inference_geo` = `global` hoặc `us`; `workspace geo` hiện chỉ `us`; `us`-only tính ×1,1. Không có vùng Việt Nam/châu Á — [Đã kiểm nguồn] [Data residency](https://platform.claude.com/docs/en/manage-claude/data-residency)
- Ảnh gửi tới API "không lưu lâu hơn thời gian xử lý yêu cầu" và Anthropic không dùng ảnh tải lên để huấn luyện — [Đã kiểm nguồn] [Claude Vision FAQ](https://platform.claude.com/docs/en/build-with-claude/vision)
- Giáo viên/giảng viên nghi ngại chất lượng chấm bài AI (xem mục 1) và 57%/52% giáo viên Mỹ lo AI làm giảm tư duy độc lập/phản biện của học sinh — [Đã kiểm nguồn] [Anthropic Education Report](https://www.anthropic.com/news/anthropic-education-report-how-educators-use-claude); [Nguồn thứ cấp] [The 74](https://the74million.org/article/survey-60-of-teachers-used-ai-this-year-and-saved-up-to-6-hours-of-work-a-week/)
- Công cụ chống chi phí bùng nổ có sẵn từ API: trần chi tiêu tổ chức và theo workspace, rate limit theo workspace, cache (hit không tính ITPM), batch giảm 50%, effort và `max_tokens`, tắt thinking ở Haiku 5.5 — xem mục 3 — [Đã kiểm nguồn] [Rate limits](https://platform.claude.com/docs/en/api/rate-limits), [Effort](https://platform.claude.com/docs/en/build-with-claude/effort)

### Inferences
- [Suy luận] **Vạch đỏ 1: không có chatbot AI cho học viên.** Nếu chỉ gia sư (người lớn) thao tác với model và học viên chỉ nhận kết quả đã duyệt, KiN khó rơi vào điều khoản "trẻ tương tác trực tiếp với model". Tính năng AI hỏi-đáp/giải bài cho học viên, hay phản hồi tức thời cho bài nộp web, sẽ kéo theo yêu cầu xác minh tuổi, kiểm duyệt, giám sát. Đề nghị luật sư xác nhận cách hiểu này.
- [Suy luận] **Vạch đỏ 2: AI không bao giờ tự gửi gì tới phụ huynh/học viên, không tự ghi điểm.** Mọi đầu ra là "bản nháp của AI", lưu kèm bản gốc và bản gia sư sửa, cần bấm xác nhận. Không dùng AI để xếp hạng trong phòng thi thử HSA; trắc nghiệm vẫn chấm bằng đáp án (không cần AI). Tự luận chỉ là gợi ý. Điều này khớp yêu cầu "người có trình độ xem xét thực chất" và tránh bị coi là chấm thi quyết định tuyển sinh.
- [Suy luận] **Ẩn danh**: thay tên học viên bằng mã (HS1, HS2) trước khi gọi API, ghép lại ở máy chủ KiN; không gửi ngày sinh, trường, lớp cụ thể, số điện thoại, tên phụ huynh; cắt phần đầu ảnh bài làm có họ tên (hoặc yêu cầu gia sư che); không gửi lịch sử học phí. Lưu ý văn bản tự do (nhận xét, bài văn) vẫn có thể chứa thông tin định danh nên cần bước quét/cảnh báo.
- [Suy luận] **Chọn model/chế độ theo rủi ro dữ liệu**: tránh Fable/Mythos (buộc lưu 30 ngày). Với dữ liệu học viên, cân nhắc không dùng Batch API (lưu 29 ngày) hoặc xoá batch ngay sau khi lấy kết quả. Cân nhắc `inference_geo: "us"` nếu muốn biết chắc nơi xử lý (+10%), nhưng nó không tránh được việc là chuyển dữ liệu ra nước ngoài.
- [Suy luận] **Thiên lệch/sai khi chấm**: kiểm thử có bộ mẫu do gia sư chấm tay; hiển thị rubric rõ; không cho điểm số Văn tự động; cho phép "báo AI sai" và ghi log để cải thiện; ghi rõ "gợi ý của AI" trong sản phẩm (tương tự yêu cầu thông báo của nhà cung cấp).
- [Suy luận] **Lạm dụng/spam**: gia sư dùng sinh hàng loạt đề để bán lại hoặc spam. Giới hạn theo (a) hạn mức tháng theo "đơn vị" quy đổi từ giá vốn (ví dụ 1 báo cáo = 1 đơn vị, 1 lượt chấm Sonnet ≈ 20 đơn vị), (b) trần theo ngày + khoảng chờ, (c) chỉ mở công cụ nặng cho tài khoản có học viên thật/đã xác minh, (d) băm nội dung để chống gọi trùng, (e) hàng đợi tuần tự cho tác vụ tốn kém.
- [Suy luận] **Chi phí bùng nổ**: tự đặt trần chi tiêu thấp hơn trần dịch vụ (tránh 429 hàng loạt đến đầu tháng sau), cảnh báo 50%/80%, tách workspace theo tính năng, `max_tokens` cứng, effort low/medium, tắt thinking ở Haiku 5.5, thu nhỏ ảnh về ≤1.800–2.600 token, cache system prompt (≥512 token), batch cho báo cáo cuối tháng (nhưng nhớ lưu 29 ngày), có công tắc tắt khẩn từng tính năng.
- [Suy luận] **Bản quyền đề thi/sách**: gia sư tải đề/sách của nhà xuất bản lên để AI trích câu hỏi/sinh câu tương tự là rủi ro bản quyền ở phía người dùng; KiN nên có điều khoản nêu rõ người dùng cam đoan có quyền với tài liệu (tương tự cam đoan trong Điều khoản thương mại của Anthropic), tránh lưu công khai câu hỏi trích từ sách có bản quyền, và để câu hỏi AI sinh mới ở chế độ riêng tư mặc định.

### Gaps
- **Luật Việt Nam chưa kiểm được văn bản gốc** (thuvienphapluat.vn, vanban.chinhphu.vn không mở được; hết hạn mức tìm kiếm). Danh sách sau đây chỉ là **việc cần xác minh, nhớ từ kiến thức nền, chưa kiểm nguồn trong phiên này, không dùng làm căn cứ**: Nghị định 13/2023/NĐ-CP Điều 20 (dữ liệu trẻ em: đồng ý của cha mẹ/người giám hộ, và của chính trẻ từ đủ 7 tuổi), Điều 24 (hồ sơ đánh giá tác động xử lý dữ liệu cá nhân) và Điều 25 (hồ sơ đánh giá tác động chuyển dữ liệu ra nước ngoài và thông báo cho cơ quan quản lý); Luật Bảo vệ dữ liệu cá nhân 2025 (theo bối cảnh dự án, hiệu lực từ 2026) có thể thay đổi hoặc bổ sung yêu cầu. Cần luật sư/đọc văn bản gốc, đặc biệt: gửi dữ liệu đã ẩn danh có còn là "dữ liệu cá nhân" không; ai là bên kiểm soát/xử lý giữa KiN, gia sư và nhà cung cấp AI; cần đồng ý riêng cho việc dùng AI không.
- Không đọc được "Guidelines for Organizations Serving Minors" của Anthropic (support.anthropic.com không mở được) nên chưa biết chi tiết yêu cầu xác minh tuổi/đồng ý cha mẹ.
- Chính sách người dưới 18 của Google (Gemini API) và OpenAI chưa tra; điều khoản dữ liệu của Gemini API (gói miễn phí vs trả phí, có dùng để cải thiện sản phẩm không) chưa kiểm — **quan trọng vì KiN hiện đang gọi Gemini với dữ liệu đề thi**.
- Chưa tìm nguồn pháp lý/thực tiễn cho bản quyền đề thi và sách giáo khoa ở Việt Nam khi dùng AI; chưa có nguồn về thiên lệch của model khi chấm Văn tiếng Việt.
- Chưa có bằng chứng về tần suất gian lận/spam AI trên nền tảng tương tự.

---

## 5. Đóng gói: tính năng Pro, credits nạp thêm (ví Coin), hay dùng thử rồi trả phí; bằng chứng chuyển đổi

### Takeaway
Bằng chứng về "mô hình đóng gói nào chuyển đổi tốt" gần như không có trong tài liệu tôi đọc được. Các tham chiếu cho thấy: công cụ giáo viên lớn thường cho free tier rộng + Plus "không giới hạn"; sản phẩm AI chung thường lai thuê bao + credits. Với chi phí thực của KiN (vài đồng đến vài trăm đồng mỗi lần), khuyến nghị của tôi là AI nằm trong gói Pro kèm hạn mức tháng ẩn (đơn vị quy đổi từ giá vốn) và dùng thử vài lượt, chưa làm credits nạp thêm và **chưa gắn vào Coin**.

### Cited Findings
- MagicSchool: free tier rộng + Plus "không giới hạn" 99,96 USD/năm; không có cơ chế credits được nhắc tới — [Nguồn thứ cấp] [MagicSchool](https://www.magicschool.ai/partner), [Fast.io](https://fast.io/resources/magic-ai-review-2026/)
- Claude cho người dùng cuối: gói Free/Pro/Max dùng hạn mức theo phiên 5 giờ (Pro ≥5× Free mỗi phiên), gói Max và Team kèm credits API gộp chung (100/200 USD/tháng cho Max, tới 500 USD/tháng dùng chung cho Team Standard) — ví dụ về mô hình lai thuê bao + credits — [Đã kiểm nguồn] [claude.com/pricing](https://claude.com/pricing)
- Khanmigo và Google Gemini trong Classroom được cung cấp miễn phí cho giáo viên (Mỹ / Workspace for Education); Khanmigo từng thu 4 USD/tháng từ giáo viên trước khi Microsoft tài trợ — [Nguồn thứ cấp] [THE Journal](https://thejournal.com/articles/2024/05/21/microsoft-khan-academy-partner-to-make-khanmigo-teaching-tool-free.aspx), [YourStory](https://yourstory.com/ai-story/google-products-and-platforms-education)
- Hiện trạng ví Coin của KiN: Coin đang chạy là "Knowledge Bounty" cho module Hỏi Đáp (`Wallet.balance`, `CoinTransaction.reason` = `signup_bonus`, `question_cost`, `answer_reward`, `report_penalty`), không dùng để mua khoá/gói; quyết định hiện hành là "đừng động vào" và hoãn việc mở rộng Coin sang mua gói lớp (15 việc); định hướng hiện tại KiN chưa thu lợi nhuận, đứng vai cầu nối — [Repo: docs/kin/quyet-dinh-va-doi-chieu.md](../../../quyet-dinh-va-doi-chieu.md)

### Inferences
- [Suy luận] Chi phí/lượt rất nhỏ với model cỡ Haiku (3–111 đ) nên *rào cản thật không phải giá vốn mà là lo ngại chất lượng và an toàn dữ liệu*; vì vậy dùng thử có hướng dẫn (3–5 lượt trên chính dữ liệu của họ, giá vốn ≈100 đ với Haiku, ≈2.000 đ với Sonnet) có lẽ chuyển đổi tốt hơn là quảng cáo khả năng — **đây là giả thuyết, chưa có bằng chứng chuyển đổi nào kiểm chứng**.
- [Suy luận] Phương án "tính năng Pro kèm hạn mức tháng" phù hợp nhất vì: dễ hiểu với gia sư sinh viên; giá vốn trung bình thấp; hạn mức theo "đơn vị" quy đổi theo giá vốn (báo cáo/tóm tắt/tin nhắn = 1; chấm Sonnet ≈ 20) giữ được biên khi có người dùng nặng. Gói 49.000đ nên có phần AI chữ gần như không giới hạn thực tế (Haiku) nhưng chấm tự luận/nhập đề có hạn mức.
- [Suy luận] Credits nạp thêm chỉ nên xuất hiện khi có tác vụ tốn kém thật (chấm hàng loạt bằng model mạnh); khi đó mua theo gói "lượt chấm" (ví dụ 100 lượt) với giá bán ≥ 3 lần giá vốn (Sonnet ≈ 355–874 đ/lượt) tốt hơn thu theo token.
- [Suy luận] **Không nối credits AI với Coin trong giai đoạn này**: Coin hiện là kinh tế Hỏi Đáp (thưởng/phạt cho câu trả lời), và KiN đã quyết định hoãn mở rộng Coin; trộn "xu kiếm từ trả lời" với "xu mua AI" tạo mâu thuẫn mới (xu miễn phí tặng khi đăng ký bị đổi thành AI tốn tiền thật) và có thể bị lạm dụng.
- [Suy luận] Thứ tự đề xuất để thử nghiệm: (1) báo cáo tháng bằng AI từ dữ liệu có sẵn (Haiku, gia sư duyệt) làm "lý do nâng cấp" chính; (2) nhập đề/sinh câu hỏi hạn mức; (3) gợi ý chấm ảnh/tự luận hạn mức, chỉ sau khi có bộ kiểm thử chất lượng tiếng Việt; (4) lộ trình ôn; (5) các tính năng nhắn tin/hồ sơ để miễn phí nhằm giữ chân và tăng hoàn thiện hồ sơ.
- [Suy luận] Giá 42–49 nghìn đ/tháng (≈1,6–1,9 USD) thấp hơn nhiều so với đối thủ Mỹ nên khó đòi AI "đẳng cấp MagicSchool"; nhưng giá vốn AI trung bình theo ước tính chỉ vài nghìn đồng/người với Haiku nên chưa phải nút thắt, nút thắt là giá trị cảm nhận và tin cậy.

### Gaps
- Không có bằng chứng tỉ lệ chuyển đổi (free → paid) cho tính năng AI trong sản phẩm giáo dục, kể cả dùng thử vs freemium vs credits; chưa tra Duolingo Max, Quizlet Plus, Photomath Plus, Gauth, Canva, Kahoot AI (các nguồn thường có số liệu này).
- Không có dữ liệu mức sẵn lòng trả (WTP) của gia sư Việt Nam cho AI; cần khảo sát/thử giá trong sản phẩm (fake door, A/B 42.000 vs 49.000 vs 99.000).
- Thông tin về Coin lấy từ tài liệu nội bộ; chưa kiểm số dư/lượng người dùng Coin thực tế trong mã nguồn hoặc dữ liệu.
