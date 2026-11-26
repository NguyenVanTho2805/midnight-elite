import { connection } from "next/server";
import { devLoginBat } from "@/server/token";
import { VAI_THU } from "@/server/dang-nhap-thu";
import { NutVai } from "./nut-vai";

export default async function DangNhap() {
  await connection(); // đọc BCA_DEV_LOGIN lúc chạy, không lúc build
  const dev = devLoginBat();
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-extrabold">BCA Midnight</h1>
      {dev ? (
        <>
          <p className="mt-2 text-text-2">Đăng nhập thử theo vai (chỉ máy dev, BCA_DEV_LOGIN=1).</p>
          <div className="mt-6 grid gap-3">
            {Object.entries(VAI_THU).map(([vai, ten]) => (
              <NutVai key={vai} vai={vai} ten={ten} />
            ))}
          </div>
        </>
      ) : (
        <p className="mt-2 text-text-2">Đăng nhập bằng Google sẽ có ở Đợt 2.</p>
      )}
    </main>
  );
}
