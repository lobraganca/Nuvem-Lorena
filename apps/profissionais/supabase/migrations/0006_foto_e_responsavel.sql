-- Foto do anúncio (foto de rosto para pessoa física, logo para empresa) e
-- nome do responsável pela empresa (obrigatório só quando entity_type = 'pj').
-- `photo_url` guarda a URL pública do arquivo enviado ao bucket de Storage
-- "professional-photos" (ver README.md — bucket criado no painel do
-- Supabase, não dá para criar bucket via migration SQL).

alter table public.professionals
  add column if not exists photo_url text;

alter table public.professionals
  add column if not exists responsible_name text;
