-- Rate limit / anti-abuso simples em denúncias (reports).

-- Fingerprint opcional do denunciante anônimo (best-effort, não é segurança
-- forte — ver README). Usado só como sinal auxiliar, nunca como chave única
-- (fácil de forjar/trocar).
alter table public.reports
  add column if not exists reporter_fingerprint text;

-- Para denunciantes logados: no máximo uma denúncia em aberto (pending) por
-- profissional. Índice único parcial em vez de constraint simples porque só
-- queremos travar enquanto a denúncia está pendente — se for revisada/
-- descartada, o mesmo usuário pode denunciar de novo depois (ex: reincidência).
create unique index if not exists reports_reporter_professional_pending_uidx
  on public.reports (professional_id, reporter_id)
  where reporter_id is not null and status = 'pending';
