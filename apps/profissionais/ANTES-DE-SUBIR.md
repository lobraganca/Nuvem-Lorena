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

---

## 2. Rodar a migration 0044 (pedidos de anúncio)

**Onde:** Supabase → SQL Editor → New query → colar o conteúdo de
`supabase/migrations/0044_pedidos_de_anuncio.sql` → Run.

É uma tabela nova (`banner_leads`), então não mexe em nada do que já existe.

**Por que:** os espaços "Apareça aqui" levam para a página `/publicidade`,
onde o comerciante deixa nome e WhatsApp. Sem a tabela, o botão "Enviar
pedido" dá erro — e o pedido de quem queria comprar se perde.

**Atenção:** os pedidos têm nome e telefone de comerciantes da cidade. A
policy deixa **só admin ler** — de propósito. Não abra leitura pública nessa
tabela.

---

## 3. Decidir os preços

A página `/publicidade` hoje diz que valor e período são combinados no
contato, sem número nenhum. Isso funciona, mas faz toda conversa começar do
zero e some com quem não ia ligar só para perguntar quanto custa.

Quando você definir os valores, dá para colocá-los na página.
