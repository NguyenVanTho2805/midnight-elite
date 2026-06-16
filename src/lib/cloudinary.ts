const CLOUD_NAME   = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export const cloudinaryConfigured =
  Boolean(CLOUD_NAME && CLOUD_NAME !== "your_cloud_name" && UPLOAD_PRESET && UPLOAD_PRESET !== "your_upload_preset");

export type UploadResult = {
  url:      string;
  publicId: string;
  format:   string;
  bytes:    number;
};

export async function uploadToCloudinary(file: File, folder = "community"): Promise<UploadResult> {
  if (!cloudinaryConfigured) throw new Error("Cloudinary chưa được cấu hình");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET!);
  formData.append("folder", folder);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`, {
    method: "POST",
    body:   formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? "Upload thất bại");
  }

  const data = await res.json();
  return {
    url:      data.secure_url as string,
    publicId: data.public_id as string,
    format:   data.format as string,
    bytes:    data.bytes as number,
  };
}

export async function uploadMany(files: File[], folder = "community"): Promise<string[]> {
  const results = await Promise.all(files.map(f => uploadToCloudinary(f, folder)));
  return results.map(r => r.url);
}
