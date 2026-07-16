// Chia đều tổng điểm cho N câu hỏi — dùng chung client (preview/áp dụng lúc tạo
// đề, chưa lưu DB) và server (route áp dụng cho đề đã có câu hỏi thật).
//
// Làm tròn 2 chữ số thập phân cho từng câu; câu CUỐI CÙNG nhận phần dư để tổng
// cộng lại luôn đúng bằng totalPoints tuyệt đối (tránh lệch 0.01-0.02 do làm tròn
// dồn qua nhiều câu).
export function distributePoints(totalPoints: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.round((totalPoints / count) * 100) / 100;
  const points = new Array<number>(count).fill(base);
  const sumOthers = base * (count - 1);
  points[count - 1] = Math.round((totalPoints - sumOthers) * 100) / 100;
  return points;
}
