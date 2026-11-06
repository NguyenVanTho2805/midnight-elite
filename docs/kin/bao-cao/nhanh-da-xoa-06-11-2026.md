# Dọn nhánh — 06/11/2026

Thọ: "kiểm tra thật kĩ các nhánh mà không cần thiết, nhánh rác có thể bỏ". Kiểm từng nhánh trên GitHub (125 nhánh) bằng bốn cách: (1) có phải tổ tiên của `main` không; (2) PR của nhánh đã **gộp bằng squash** chưa — kiểm đúng commit `(#N)` có trên `main` và đầu nhánh trùng đầu PR; (3) có là tổ tiên của một nhánh mà PR đã gộp không; (4) với phần còn lại, đọc từng commit và đối chiếu mã trên `main`.

**Kết quả:** xoá **119** nhánh (bảng dưới), giữ **6**. Xoá nhánh KHÔNG mất nội dung: 54 nhánh là tổ tiên của `main`; 48 nhánh đã gộp bằng squash; 12 nhánh nằm trong nhánh đã gộp; 5 nhánh còn lại đã xem từng cái (ghi chú ở cột lý do). Hai nhánh có phần riêng được lưu thành **thẻ** `archive/…`; nhánh có PR vẫn giữ commit ở `refs/pull/<số>/head`.

## Khôi phục một nhánh đã xoá
```bash
git push origin <SHA đầy đủ ở bảng>:refs/heads/<tên nhánh>
```
(hoặc bấm "Restore branch" ở trang PR; thẻ lưu trữ: `git push origin refs/tags/archive/<tên>:refs/heads/<tên>`)

## Giữ lại 6 nhánh
| Nhánh | Vì sao giữ |
|---|---|
| `main` | nhánh mặc định |
| `claude/optimistic-clarke-cbddza` | nhánh làm việc của phiên này |
| `dev` | tổ tiên của `main` (07/2026), không còn tác dụng — giữ vì có thể là tên quen dùng; xoá được nếu bạn muốn |
| `claude/peaceful-bell-6vfrb5` | **còn việc chưa vào `main`**: (a) sửa lộ đề bài/hướng dẫn của lớp trả phí qua `GET /api/lessons/[id]/assignments` (trên `main` route này vẫn mở cho mọi tài khoản đã đăng nhập — đã ghi ở PR #129); (b) `/api/auth/me` xoá cookie khi tài khoản đã bị xoá; (c) `AuthGuard` hỏi lại phiên một lần trước khi đuổi sang đăng nhập. Phần che link/bài khoá khác đã có trên `main` (MD-03 `mediaAccess.ts`) |
| `claude/stoic-meitner-mczn3x` | (c) ở trên bản sớm (`AuthContext.refresh` + `AuthGuard`); phần "đăng xuất tải cứng" đã có trên `main` |
| `claude/online-learning-platform-tyiyyg` | 9 tài liệu định hướng gia sư–sinh viên (chiến lược, biểu đồ UML, roadmap, 09/2026) chỉ có ở nhánh này — cần Thọ quyết có giữ làm lịch sử không |

## 119 nhánh đã xoá
| Nhánh | SHA đầu nhánh | PR | Lý do |
|---|---|---|---|
| `aodtsix-cmd-patch-1` | `f1f283ac0530d4367e664b96685767331992ba3a` | #1 | đã gộp (tổ tiên của main) |
| `chuyendoiduanmoi` | `0532b556d17ce30ac5cfd9b17acab0598b0c5fb0` | — | đã gộp (tổ tiên của main) |
| `claude/adm-002-bai-viet` | `5493a050f89796b416a66de2cd2729b14b4139d0` | #113 | đã gộp (tổ tiên của main) |
| `claude/adm-cat-02` | `92fb1e4b6f1e92d1ad076649887d51439fad0c3d` | #98 | đã gộp (tổ tiên của main) |
| `claude/adm-home-02` | `d182b01b9cb8883bf34c4ecad40857c4dcc4d07c` | #99 | đã gộp (tổ tiên của main) |
| `claude/adm-s1` | `770973c2260b9d9e5e58fce103ef415974c67ac9` | #92 | đã gộp (tổ tiên của main) |
| `claude/bu-00-phan-vai` | `8c624bdb67b053ef9baa1d13f92854302efab336` | #88 | đã gộp (tổ tiên của main) |
| `claude/bu-01-lop` | `64c12f0138e3c7b84aa2a0e9f6c6421e8d0e1603` | #103 | đã gộp (tổ tiên của main) |
| `claude/bu-02-hoc-lieu` | `4001e5523a349e9889bc5f126bb4d0f4669a21c7` | #106 | đã gộp (tổ tiên của main) |
| `claude/bu-03-de-thi` | `2659253685bfdebe4191709fd724f6bc2db659a6` | #107 | đã gộp (tổ tiên của main) |
| `claude/bu-04-phong-thi` | `0ea5d2a09df9d866bc723a3a45b4e2da91d07e82` | #108 | đã gộp (tổ tiên của main) |
| `claude/bu-04-phong-thi-gop-94` | `73b21c72ac3d3675925cdec7aff924d4cd5e768a` | — | đã gộp (tổ tiên của main) |
| `claude/bu-05-cong-dong` | `966123924dd242fea70d0c5dea5b40646c5fd534` | #104 | đã gộp (tổ tiên của main) |
| `claude/bu-06-tim-gia-su` | `839f42faf73c04841d51690137835f0258c3789f` | #105 | đã gộp (tổ tiên của main) |
| `claude/bu-06b-anh-bia-video` | `f229c49b6a8b79dbc6db044e153c93546ed7635e` | #109 | đã gộp (tổ tiên của main) |
| `claude/bu-07-tin-tuc` | `f50b9e325c869a912a268bb980ba572d753722bb` | #102 | đã gộp (tổ tiên của main) |
| `claude/bu-08-quan-tri` | `d2fa17ec24ea457a70f7a3d854f2babdc4757d2f` | #110 | đã gộp (tổ tiên của main) |
| `claude/bu02-giao-trinh-phang` | `ab0686ffb9fc2ad1099bf0b4a1146cb3cdaca78d` | — | đã gộp (tổ tiên của main) |
| `claude/bu03-mathtype` | `f0bc5d5f423bb6214c0aec4921c55e87e8c7d2ea` | #126 | đã gộp (tổ tiên của main) |
| `claude/cat-01-hoi-quy` | `be7f2087c9536122f8e37fb052cf7060fa7e3b1b` | #116 | đã gộp (tổ tiên của main) |
| `claude/cho-phu-huynh-2a` | `19b8958b736079fef4810b90f6bbafc0f132e8df` | #119 | đã gộp (tổ tiên của main) |
| `claude/clever-albattani-p7tniu` | `3c3f3bd454466d7cf3397e850bf5cc36d938ff90` | #81 | đã gộp (tổ tiên của main) |
| `claude/coo-gop-bigupdate` | `f7f44e99e1b8758cce1c1776945cc940eb713c64` | #111 | đã gộp (tổ tiên của main) |
| `claude/docs-ban-giao-figma` | `75d4be357d8a9497b6a8e406b9ac27bd2766a043` | #89 | đã gộp (tổ tiên của main) |
| `claude/docs-bao-cao-dem-04-11` | `c91f5b5dd08a2b70f94e1e9a083a8686e10a4c6f` | #117 | đã gộp (tổ tiên của main) |
| `claude/docs-bao-cao-quyet-dinh` | `b10fbb20cc1e9ac040a53dc0e8e6712c48c86b66` | #122 | đã gộp (tổ tiên của main) |
| `claude/figma-bo-sung-06-11` | `a0299f233a382b47d87b1b1f9f267d98f234d5d2` | #128 | đã gộp (tổ tiên của main) |
| `claude/figma-bu01-03-06` | `5785ab9db9b8fed27a0aebf0a1e43102333277bf` | #124 | đã gộp (tổ tiên của main) |
| `claude/fix-suspended-content` | `d5e9d0db073afd0cafb1cf92ea6cfff6a391feb4` | #129 | đã gộp (tổ tiên của main) |
| `claude/fix-suspended-submit` | `1c3c84fd6bc2108498480d1c9c00eec359f7c2a7` | #127 | đã gộp (tổ tiên của main) |
| `claude/gop-het-chua-gop` | `10da8a379ca57f0f0ea11d17984409b09d433ac2` | #130 | đã gộp (tổ tiên của main) |
| `claude/hocphi-theo-buoi` | `5474be79cc23e49ffb10e837b7d96d1a6c88df43` | — | đã gộp (tổ tiên của main) |
| `claude/hs-coin-mui-gio-fig` | `e697212e777c924150803704850b6ffa90117149` | #125 | đã gộp (tổ tiên của main) |
| `claude/khach-hoi-dap-3a` | `0cff6c38ad815a468eb9de992f1e16b45870a44a` | #120 | đã gộp (tổ tiên của main) |
| `claude/no-0511-ten-hs-suspended` | `19f05d9b81dfdc48ff2d314e4760026e9bdf3804` | #123 | đã gộp (tổ tiên của main) |
| `claude/phong-ban-agent` | `11239cc29a7e394f60a2090215200ce8614f6eac` | #96 | đã gộp (tổ tiên của main) |
| `claude/phong-thi-chip-5a` | `ec438cb54e54bd0b97905949af9d3bd9a9f8a8dd` | #121 | đã gộp (tổ tiên của main) |
| `claude/practical-goldberg-lwpf1q` | `cbb61bb55b03cb713eddb585c5c7c7f1108d2b37` | #95 | đã gộp (tổ tiên của main) |
| `claude/stu-003-xep-hang` | `00eb6381f82fd6ffffc410aebf7501c91c0c115a` | #115 | đã gộp (tổ tiên của main) |
| `claude/stu-cat-01` | `5fcaf2e5ebe7904b1975cb32ada28c9e75e7a67a` | #100 | đã gộp (tổ tiên của main) |
| `claude/stu-home` | `1d5450da8da6fb3d5b092fd8704475cb64bcb987` | #97 | đã gộp (tổ tiên của main) |
| `claude/stu-s1` | `6b02f8e5e88f9a66edabb09f0a254341ccff46c0` | #94 | đã gộp (tổ tiên của main) |
| `claude/stu-tieng-anh-loi-vao` | `2d1de413d577772c911f015bbeb2e4d18a52a9cf` | #101 | đã gộp (tổ tiên của main) |
| `claude/sua-5a-390` | `1769b5d37e6a62eeb20c7b47712c4a655f83fee0` | — | đã gộp (tổ tiên của main) |
| `claude/thanh-ben-rong` | `e85e604776e7d30f38df09b113339a89bb5e6d9e` | #80 | đã gộp (tổ tiên của main) |
| `claude/tieng-anh-ielts` | `28bea419dce82cd5d58268d17441ef46c31d4e89` | #60 | đã gộp (tổ tiên của main) |
| `claude/trusting-wozniak-56sizp` | `001a6bebbca88093ac49dd21562dc165b3417853` | #86 | đã gộp (tổ tiên của main) |
| `claude/tut-003-hop-viec` | `988ffc69683605a371b3fa445e1a5c3849e132f2` | #114 | đã gộp (tổ tiên của main) |
| `claude/tut-s1` | `2f91953ef7d913eb901f737e70e1af04ae164412` | #93 | đã gộp (tổ tiên của main) |
| `claude/va-diem-tu-khai-cron` | `42b47acc9fc2a787bcdfcaf37ae46fe672de7de5` | #63 | đã gộp (tổ tiên của main) |
| `claude/xep-hang-1b` | `ecabf95f66f5272ead9255d6358322c8824400b1` | #118 | đã gộp (tổ tiên của main) |
| `claude/zealous-tesla-4p417m` | `041167cb7806635ea3d193272a27ed80217077f5` | #85 | đã gộp (tổ tiên của main) |
| `kin-tai-lieu-ban-giao` | `f04c2037a9c7ec732edd42ee14ebada4c0b830b5` | — | đã gộp (tổ tiên của main) |
| `remove-legacy-purchase-flow` | `1305c98abac5d1902f1b0f674241874498bc9e83` | #3 | đã gộp (tổ tiên của main) |
| `audit-progress-tracking` | `6bd0290fbeaa6e6da5b2021e86cd22cfe96eecf3` | — | thử nghiệm giao diện Notion-flat (09/2026) đã bị Giao diện KiN thay; dọn tệp nhạy cảm đã có trên main. Lưu thẻ archive/audit-progress-tracking (còn 9 tệp skill chỉ có ở đây) |
| `chore-gitignore-scratchpad` | `141c17f831fbd2389c72960e3fa852977fdbe3a0` | #48 | PR #48 đã gộp bằng squash (commit ab710711 trên main) |
| `claude/beautiful-hopper-2u61co` | `6e881f5053cf22f5941af54d74203babba747ef8` | — | 1 dòng ghi sổ 'PR 87 đã merge', vô giá trị |
| `claude/ecstatic-carson-u397lj` | `4f5f107f49eb6f6b0a0c2bee744bfee6c0d4a131` | — | là tổ tiên của nhánh fix-p0-teacher-ownership (PR đã gộp) |
| `claude/giao-dien-moi` | `206f6eea67624a9a4f6cb767174f0f10c0d50985` | #75 | PR #75 đã gộp bằng squash (commit 75f3343b trên main) |
| `claude/keen-allen-wiz3em` | `8bfac8b583eb2e64d199b373f8e37db7d65bcd94` | #73 | PR #73 đã gộp bằng squash (commit d55bed5e trên main) |
| `claude/nang-cap-2` | `5d583f747fb3e2a585f23d43d5c253b697b646e6` | #72 | là tổ tiên của nhánh claude/giao-dien-moi (PR đã gộp) |
| `claude/nc2-pr1-nen-dx00` | `5d779916cfa030a2cd847c8e1fa56f170b5197e0` | #64 | là tổ tiên của claude/giao-dien-moi (PR #75 đã gộp) |
| `claude/nc2-pr10-trial-topups` | `33ccf3a58451172bc133aa26011f0c43d9621bcf` | #74 | PR #74 đóng; phần riêng (PRO D2+D8) đã có bản thay thế trên main (không còn số tài khoản viết cứng, nạp Coin bị chặn khi chạy thử). Commit còn giữ ở refs/pull/74/head |
| `claude/nc2-pr11-nc2-035-kiem-lai` | `b549de92e9177ae304e33004785f913c89d6a2fb` | — | chồng lên nang-cap-2 (đã gộp qua #75) + 1 commit có bản tương đương trên main (git cherry '-') |
| `claude/nc2-pr2-dx01` | `ea52ce503d052c93cfe0c9a0341bd44898d9fb9e` | #65 | là tổ tiên của claude/giao-dien-moi (PR #75 đã gộp) |
| `claude/nc2-pr3-dx03` | `fab0d4955e62aa67f9e23f56f05cd12b0682d179` | #66 | là tổ tiên của claude/giao-dien-moi (PR #75 đã gộp) |
| `claude/nc2-pr4-dx04` | `03362064e242d17a7d36144a6f2a3d12396bce7c` | #67 | là tổ tiên của claude/giao-dien-moi (PR #75 đã gộp) |
| `claude/nc2-pr5-dx05` | `d77ad397ba8f3c47845b0cc91d0e0b22982a0645` | #68 | là tổ tiên của claude/giao-dien-moi (PR #75 đã gộp) |
| `claude/nc2-pr6-dx06` | `1fbcd10b91f1c7283168ce180d5e8190cc2d6e10` | #69 | là tổ tiên của claude/giao-dien-moi (PR #75 đã gộp) |
| `claude/nc2-pr7-dx07` | `d054f1302a4398acdb505d559cdd0d5493f1e2e7` | #70 | là tổ tiên của claude/giao-dien-moi (PR #75 đã gộp) |
| `claude/nc2-pr8-dx02` | `8dc3ee7e0fe3178e3a7a5ef030ef9336150e3712` | #71 | là tổ tiên của claude/giao-dien-moi (PR #75 đã gộp) |
| `claude/project-thread-5rh9ta` | `e1d6401466808dfbfa08c7b386073dd11082d488` | #9 | PR #9 đã gộp bằng squash (commit f131c1ea trên main) |
| `claude/web-ui-ux-redesign-prep-rrljzy` | `f0e9ba0aaf7f7e32061f5855e0d5a43b432e4ca2` | — | thử nghiệm chế độ tối + video hero (08/2026) đã bị thay. Lưu thẻ archive/web-ui-ux-redesign-prep |
| `claude/zealous-faraday-xpkmaz` | `d407f467c63a19d087b335294ee6d5a4ae5858d6` | — | là tổ tiên của nhánh feat-merge-parent-consent (PR đã gộp) |
| `docs-tho-backlog-rules` | `35ec6d04cce08839661989264a91091dbff50fff` | #29 | PR #29 đã gộp bằng squash (commit 0f636be0 trên main) |
| `feat-1-4-4-tutor-profile` | `a48f07703b9a5a529b2a21d418a15886c512c611` | #13 | PR #13 đã gộp bằng squash (commit acaf4543 trên main) |
| `feat-1-4-5-tutor-vip` | `6943bd66f19a091ab44d2147f047cecdca1312f1` | #11 | PR #11 đã gộp bằng squash (commit d54a90d4 trên main) |
| `feat-1-4-7-thread-theo-lop` | `8aa5264d93582fa539aef9e09172b6beb4060a0a` | #10 | PR #10 đã gộp bằng squash (commit 8a83f677 trên main) |
| `feat-as191-attendance` | `3c5440b37473c56a481776e275eee2fcb30d7e6f` | #34 | PR #34 đã gộp bằng squash (commit 657f7d70 trên main) |
| `feat-as192-193-tuition` | `7e7f1ca00c66833da3db1c0c768ab63d5f19bc84` | #35 | PR #35 đã gộp bằng squash (commit ccb9ce0b trên main) |
| `feat-as194-meet-reminders` | `0cf5639807d4f603e1a164e3ca66f205c3585fda` | #39 | PR #39 đóng 25/10; nhắc lịch 24h/1h/30m KHÔNG có trên main (cron */15 không chạy được trên gói Hobby). Commit còn ở refs/pull/39/head |
| `feat-as195-196-ranking-scholarship` | `8e9396ffbc3cdb8aa3930291577f6fdd1d5f0888` | #40 | PR #40 đã gộp bằng squash (commit 7b36ca7a trên main) |
| `feat-be046-pending-consent-helper` | `648b1aabb464daf5eaaf1ac7390097fab5778e0c` | #12 | PR #12 đã gộp bằng squash (commit 7a005aa0 trên main) |
| `feat-be054-remove-add-teacher` | `c21fdbdf8724125b21b055b76c893874b32c4373` | #30 | PR #30 đã gộp bằng squash (commit 1699f849 trên main) |
| `feat-be061-062-cron-expire-vip` | `34b8b7d09c101905fd144b5df1e46c31adf90bdd` | #20 | PR #20 đã gộp bằng squash (commit c604b82d trên main) |
| `feat-be063-068-class-invite` | `6584215f697257b3d15de6936d729ae2f086528d` | #19 | PR #19 đã gộp bằng squash (commit 022eaf4f trên main) |
| `feat-be078-be081-tach-hoc-vien-bo-sales-bot` | `44ec70baddf97e7c748006a0f7fdcee03ada3227` | #15 | PR #15 đã gộp bằng squash (commit d28ee25b trên main) |
| `feat-be079-theo-doi-lop` | `2d84f7a2f743d017a080e3032855911e90ba822b` | #16 | PR #16 đã gộp bằng squash (commit a0767680 trên main) |
| `feat-be080-confirm-exam-guest-access` | `2547ea22c2863366e9865089d9b3168915b7fdd4` | #28 | PR #28 đã gộp bằng squash (commit e52d08ad trên main) |
| `feat-be083-086-audit-log` | `203c400d0443666070299bfa462fb82fd48a91a0` | #18 | PR #18 đã gộp bằng squash (commit ed347574 trên main) |
| `feat-bo-sales-bot-tables-va-tach-db-preview` | `3f0f38739216516b0a9371779d634f4e4d2afa5c` | #17 | PR #17 đã gộp bằng squash (commit c684676c trên main) |
| `feat-fe088-089-design-tokens` | `7f483b1ee0a2ddb613bc943f6eff583bad8d5762` | #23 | PR #23 đã gộp bằng squash (commit 4bf08631 trên main) |
| `feat-fe091-097-ui-shared` | `a1a125e3bf4a9693dacca1cc8cf04d5257e5307b` | #22 | PR #22 đã gộp bằng squash (commit 1008d072 trên main) |
| `feat-fe100-dangky-role-picker` | `92020ac1f3ed4dbf3c7efd5756d3683dfe924bf0` | #31 | PR #31 đã gộp bằng squash (commit c313e3f5 trên main) |
| `feat-fe105-116-tutor-directory` | `222fa2f689ee422288824823b819a019ebeba3e6` | #25 | PR #25 đã gộp bằng squash (commit 09c80b64 trên main) |
| `feat-fe117-119-community-by-class` | `2028e1f40808ab1fcc36bbac94ec73cab65bd2b2` | #24 | PR #24 đã gộp bằng squash (commit fa0807cd trên main) |
| `feat-fe125-126-invite-redeem-ui` | `841465dd8e1cfb2659bcdcf0194aac2ca463bf2a` | #26 | PR #26 đã gộp bằng squash (commit 10eaf26f trên main) |
| `feat-fe128-coin-topup` | `bd9369d2842831c9764318f917bd6854c063989b` | #27 | PR #27 đã gộp bằng squash (commit 82f40f42 trên main) |
| `feat-fe129-redesign-student` | `af8a8279d4c6b4d52dbb72086d9a615a3e8b086b` | #32 | PR #32 đã gộp bằng squash (commit 72c20072 trên main) |
| `feat-merge-parent-consent` | `c8659f84029002b4c473df06227827722430eff2` | #14 | PR #14 đã gộp bằng squash (commit d81698eb trên main) |
| `feat-tk165-kin-tokens` | `b85c6d2c0f467662cdc89cf04231a5e5a9fbd791` | #33 | PR #33 đã gộp bằng squash (commit 6e01581e trên main) |
| `feat-tk167-chon-chu-de` | `ea4cad1663c8042c07584a82a246efea66038250` | #43 | PR #43 đã gộp bằng squash (commit 703a2566 trên main) |
| `feat-tk170-vao-lop` | `927c7827a7a02c8c821536766bbe8d383ad57e27` | #38 | PR #38 đã gộp bằng squash (commit 2d2bada3 trên main) |
| `feat-tk171-class-roster` | `2959ce23342e16fe704c7a383dcd664adfea6c6e` | #41 | PR #41 đã gộp bằng squash (commit 4585ae64 trên main) |
| `feat-tk172-ui-diem-danh` | `92c6b78eea4b8ec1423eaca3145a3eeec3b7825d` | #36 | PR #36 đã gộp bằng squash (commit b8c5bc67 trên main) |
| `feat-tk173-ui-hoc-phi` | `d68b09191c4370ecefd0a640e4725a28a9958ed2` | #37 | PR #37 đã gộp bằng squash (commit 9d8c247e trên main) |
| `feat-tk175-cong-dong-kin` | `faa16084dbfa860bed74967d2aec25c7bc2f6619` | #50 | PR #50 đã gộp bằng squash (commit 3ab633d5 trên main) |
| `feat-tk176-177-thu-vien-ban-do` | `9b8e6d307d4e5ea2ef8694018c044c4a03fc4dc2` | #49 | PR #49 đã gộp bằng squash (commit ba1f2d8b trên main) |
| `feat-tk178-so-cua-con` | `fcde4afd249bafb83e461fc870d0ce9e37dc14be` | #42 | PR #42 đã gộp bằng squash (commit f6e96edb trên main) |
| `feat-tk179-outlook-shell` | `8b897f808329e26e82c41750453ee2b88eeb78ff` | #46 | PR #46 đã gộp bằng squash (commit e1231477 trên main) |
| `feat-tk180-lop-cua-toi` | `c950631a7e52bb5778cdbd43273c95ef89ffef81` | #44 | PR #44 đã gộp bằng squash (commit 4c75f2fe trên main) |
| `feat-tk182-mobile-polish` | `4a4919e0371d81982b6cf4f48ac7b11e823bf12f` | #51 | PR #51 đã gộp bằng squash (commit 71e7d963 trên main) |
| `feat-tk183-kin-components` | `5cd7e3e12036dae94d3fad167226d3995b6e5c47` | #45 | PR #45 đã gộp bằng squash (commit f538db72 trên main) |
| `fix-p0-1-4-wallet-course-enrollment` | `9a03d139d1c2a6bfa548b484fce577829b2a6a7f` | #6 | PR #6 đã gộp bằng squash (commit 3de9f694 trên main) |
| `fix-p0-teacher-ownership` | `a89c532c34da3da5a18164c5044e142cdfacfd0b` | #5 | PR #5 đã gộp bằng squash (commit 5aa59482 trên main) |
| `fix-tk178-no-unique` | `883c7b2c4227928f1739d572ee0ec6c71e84a7af` | #47 | PR #47 đã gộp bằng squash (commit 1243b956 trên main) |
| `fix-toctou-wallet` | `1da61fcb42ba611bf2f680a79ef6dc2916da08f0` | #8 | PR #8 đã gộp bằng squash (commit ab5413e5 trên main) |
| `hotfix-db-push-accept-data-loss` | `6ca2b0027cf8afc5e64b5515fc2866a0a0f12fa1` | #21 | PR #21 đã gộp bằng squash (commit de40845d trên main) |
| `remove-course-favorite` | `a9a8f589f7e60e35c25ed26b82aa4f1a06b41e5e` | #4 | PR #4 đã gộp bằng squash (commit b6ef3e71 trên main) |
