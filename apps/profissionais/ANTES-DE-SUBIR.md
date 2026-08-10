# Antes de subir a versão

Lista do que precisa ser feito **na mão**, no Supabase ou em outro painel,
para o que já está no código funcionar em produção.

Código sozinho não basta quando a mudança mexe no banco: a migration existe
no repositório, mas só vale depois de rodada. Enquanto um item aqui estiver
aberto, o recurso correspondente está no ar sem funcionar.

Quando terminar um item, apague-o daqui.

---

## 1. Rodar a migration 0043 (banners na tela de boas-vindas)

**Onde:** Supabase → SQL Editor → New query → colar → Run.

```sql
alter table public.banners
  add column if not exists local text not null default 'busca'
    check (local in ('busca', 'boas_vindas'));

create index if not exists banners_local_idx on public.banners (local, ativo, inicio, fim);
```

**Por que:** o admin de banners agora tem o campo "Onde aparece" (faixa da
busca ou cartão na tela de boas-vindas). Sem essa coluna, salvar qualquer
banner dá erro.

**Sem risco para o que já existe:** a coluna nasce com `'busca'`, então todo
banner cadastrado antes continua exatamente onde estava.
