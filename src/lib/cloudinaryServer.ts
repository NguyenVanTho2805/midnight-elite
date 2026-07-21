// Upload ảnh từ server (Buffer) lên Cloudinary — dùng cùng cloud/preset với
// src/lib/cloudinary.ts (client-side, nhận File từ <input>), nhưng file đó
// dùng thẳng type `File` của trình duyệt nên không gọi được từ route handler.
// Tách file riêng vì Buffer/Node API không được phép lọt vào bundle client.
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export const cloudinaryServerConfigured = Boolean(
  CLOUD_NAME && CLOUD_NAME !== "your_cloud_name" && UPLOAD_PRESET && UPLOAD_PRESET !== "your_upload_preset"
);

export async function uploadBufferToCloudinary(buffer: Buffer, filename: string, folder = "de-thi"): Promise<string> {
  if (!cloudinaryServerConfigured) throw new Error("Cloudinary chưa được cấu hình");

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(buffer)], { type: "image/png" }), filename);
  formData.append("upload_preset", UPLOAD_PRESET!);
  formData.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? "Upload ảnh thất bại");
  }

  const data = await res.json();
  return data.secure_url as string;
}
