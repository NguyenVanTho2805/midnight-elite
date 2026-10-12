import { api, mkTutor, mkCourse, wipe, check, section, done } from "./h";

(async () => {
  await wipe();
  const tutor = await mkTutor("Cô Lan"), other = await mkTutor("Thầy Khác");
  const course = await mkCourse(tutor.id, { name: "Toán 9" });
  const post = (body: object, as = tutor) => api("POST", `/api/courses/${course.id}/class-schedules`, { as, body });

  section("Thêm khung giờ: giờ chuẩn hoá + link vào lớp");
  let r = await post({ dayOfWeek: 4, startTime: "9:05", endTime: "10:00", joinUrl: "  https://meet.google.com/abc-defg-hij " });
  check("'9:05' lưu thành '09:05', link được cắt khoảng trắng", r.status === 201 && r.json.startTime === "09:05" && r.json.joinUrl === "https://meet.google.com/abc-defg-hij", r.json);
  const id = r.json.id;
  r = await post({ dayOfWeek: 1, startTime: "19:00", endTime: "21:00" });
  check("không có link → null", r.status === 201 && r.json.joinUrl === null);
  r = await post({ dayOfWeek: 1, startTime: "19:00", endTime: "21:00", joinUrl: "" });
  check("link rỗng → null", r.status === 201 && r.json.joinUrl === null);
  for (const [name, body] of [
    ["giờ 25:00", { dayOfWeek: 1, startTime: "25:00", endTime: "26:00" }],
    ["giờ chữ", { dayOfWeek: 1, startTime: "bảy giờ", endTime: "21:00" }],
    ["kết thúc trước bắt đầu", { dayOfWeek: 1, startTime: "10:00", endTime: "09:00" }],
    ["so sánh số (9:00 < 10:00 phải đúng)", null],
    ["link javascript:", { dayOfWeek: 1, startTime: "19:00", endTime: "21:00", joinUrl: "javascript:alert(1)" }],
    ["link ftp", { dayOfWeek: 1, startTime: "19:00", endTime: "21:00", joinUrl: "ftp://x.y/z" }],
    ["link không phải URL", { dayOfWeek: 1, startTime: "19:00", endTime: "21:00", joinUrl: "meet của lớp" }],
    ["link quá dài", { dayOfWeek: 1, startTime: "19:00", endTime: "21:00", joinUrl: "https://x.y/" + "a".repeat(600) }],
    ["link sai kiểu", { dayOfWeek: 1, startTime: "19:00", endTime: "21:00", joinUrl: 123 }],
  ] as [string, object | null][]) {
    if (!body) { const ok = await post({ dayOfWeek: 2, startTime: "9:00", endTime: "10:00" }); check(name, ok.status === 201, ok.json); continue; }
    check(`từ chối: ${name}`, (await post(body)).status === 400);
  }
  check("gia sư khác → 403", (await post({ dayOfWeek: 1, startTime: "19:00", endTime: "21:00" }, other)).status === 403);

  section("Sửa khung giờ");
  const put = (body: object, as = tutor) => api("PUT", `/api/class-schedules/${id}`, { as, body });
  r = await put({ joinUrl: "https://zoom.us/j/123456" });
  check("đổi link", r.status === 200 && r.json.joinUrl === "https://zoom.us/j/123456" && r.json.startTime === "09:05");
  check("link hỏng → 400, giữ nguyên", (await put({ joinUrl: "ftp://x" })).status === 400 && (await api("GET", `/api/courses/${course.id}/class-schedules`, { as: tutor })).json.find((s: any) => s.id === id).joinUrl === "https://zoom.us/j/123456");
  r = await put({ startTime: "8:00" });
  check("sửa giờ '8:00' → '08:00'", r.status === 200 && r.json.startTime === "08:00");
  check("giờ sai → 400", (await put({ startTime: "8h" })).status === 400 && (await put({ endTime: "99:99" })).status === 400);
  check("kết thúc trước bắt đầu (so với giá trị đang lưu) → 400", (await put({ endTime: "07:00" })).status === 400);
  r = await put({ joinUrl: null });
  check("null xoá link", r.status === 200 && r.json.joinUrl === null);
  check("gia sư khác → 403", (await put({ joinUrl: "https://a.b" }, other)).status === 403);

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
