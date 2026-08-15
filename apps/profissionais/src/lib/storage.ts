import { supabase } from "./supabase";
import { comprimirImagem } from "./imagem";

/**
 * Bucket público de Storage usado para foto de rosto (pessoa física) ou logo
 * (pessoa jurídica) dos cadastros. Precisa ser criado uma vez no painel do
 * Supabase (Storage → New bucket → "professional-photos", marcado como
 * público) — não é possível criar um bucket via migration SQL. Ver README.md.
 */
export const PROFESSIONAL_PHOTOS_BUCKET = "professional-photos";

/**
 * Envia a foto/logo do cadastro para o Storage e devolve a URL pública.
 * Lança erro se o banco/storage não estiver configurado ou se o upload
 * falhar (ex.: bucket ainda não criado no projeto Supabase).
 */
/** Teto do arquivo enviado. Foto de perfil não precisa de mais que isto. */
const TAMANHO_MAXIMO_MB = 8;

export async function uploadProfessionalPhoto(ownerId: string, file: File): Promise<string> {
  const client = supabase();
  if (!client) throw new Error("Banco de dados não configurado.");

  // Barrado aqui, e não só no servidor, porque o custo de descobrir tarde é
  // da pessoa: sem esta checagem ela espera o envio inteiro de um arquivo
  // grande em 4G para só então receber a recusa.
  if (!file.type.startsWith("image/")) {
    throw new Error("Envie uma imagem (JPG ou PNG).");
  }
  if (file.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
    throw new Error(
      `Esta imagem tem ${(file.size / 1024 / 1024).toFixed(1)} MB e o limite é ${TAMANHO_MAXIMO_MB} MB. Tire a foto com menos zoom ou escolha outra.`
    );
  }

  // Reduzida antes de sair do aparelho: o que vai para a rede é o arquivo
  // pequeno, não o original de 8 MB.
  const arquivo = await comprimirImagem(file);
  const ext = arquivo.name.split(".").pop() || "jpg";
  const path = `${ownerId}/${Date.now()}.${ext}`;

  const { error } = await client.storage.from(PROFESSIONAL_PHOTOS_BUCKET).upload(path, arquivo, {
    upsert: true,
    contentType: arquivo.type || undefined,
  });
  if (error) throw error;

  const { data } = client.storage.from(PROFESSIONAL_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
