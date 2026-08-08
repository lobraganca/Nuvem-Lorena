import { supabase } from "./supabase";

/**
 * Bucket público de Storage usado para foto de rosto (pessoa física) ou logo
 * (pessoa jurídica) dos anúncios. Precisa ser criado uma vez no painel do
 * Supabase (Storage → New bucket → "professional-photos", marcado como
 * público) — não é possível criar um bucket via migration SQL. Ver README.md.
 */
export const PROFESSIONAL_PHOTOS_BUCKET = "professional-photos";

/**
 * Envia a foto/logo do anúncio para o Storage e devolve a URL pública.
 * Lança erro se o banco/storage não estiver configurado ou se o upload
 * falhar (ex.: bucket ainda não criado no projeto Supabase).
 */
export async function uploadProfessionalPhoto(ownerId: string, file: File): Promise<string> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${ownerId}/${Date.now()}.${ext}`;

  const { error } = await client.storage.from(PROFESSIONAL_PHOTOS_BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;

  const { data } = client.storage.from(PROFESSIONAL_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
