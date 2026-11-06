import { z } from "zod";
import { api } from "./api";

const uploadResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({ url: z.string().url() }),
});

export async function uploadProfileMedia(file: File, kind: "avatar" | "company-photo") {
  const body = new FormData();
  body.append("file", file);
  body.append("kind", kind);
  const response = await api.post("/users/me/media", body, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 30_000,
  });
  return uploadResponseSchema.parse(response.data).data.url;
}
