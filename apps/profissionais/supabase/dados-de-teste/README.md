# Encher o app para testar

A dona: *"encha o app de vagas e candidatos para que eu possa testar as
funcionalidades e quebras de layout."*

| Arquivo | O que faz |
|---|---|
| `encher-o-app.sql` | cria 30 candidatos, 8 empresas, 20 vagas, 58 candidaturas e 32 avisos |
| `limpar-os-testes.sql` | apaga tudo isso, numa linha |

Cole no SQL Editor do projeto do Ei Emprego:
<https://supabase.com/dashboard/project/ahigenhenzmsjxlmrzhz/sql/new>

Sem nada selecionado antes de clicar em **Run** — com texto selecionado, o
botão roda só a seleção.

## Isto cria gente que não existe DENTRO do app de verdade

Enquanto estiver lá, qualquer pessoa que abrir o app vai ver os 30
cadastros e as 20 vagas na busca, no banco de talentos e no banco de
vagas. Em teste fechado isso é inofensivo; no dia da abertura, não é.

**Rode `limpar-os-testes.sql` antes de abrir o app para a cidade.**

Os telefones são todos `(31) 90000-00xx`. O prefixo `9000` não existe em
celular no Brasil, então nenhum toque em "Chamar no WhatsApp" incomoda uma
pessoa de verdade.

## Como a limpeza consegue ser uma linha só

Todo id criado aqui começa com `eeee0000`, e toda tabela do app aponta,
direta ou indiretamente, para `auth.users` com `on delete cascade`. Apagar
as contas leva junto cadastros, empresas, vagas, candidaturas e avisos —
sem sobrar linha órfã.

Nenhuma conta de verdade tem id começando com `eeee0000`.

## O que dá para testar

- **nome muito comprido** no cartão (Marcos Vinícius de Oliveira Santana
  Nascimento) e **título de vaga muito comprido** (três das vinte)
- **1, 2, 3 e 4+ funções** por pessoa — é o "+N" do cartão do talento
- com e sem foto, com e sem resumo
- **destaque pago valendo e vencido**, nos dois lados: 3 pessoas "Em alta"
  (uma delas vencida, que tem de sumir sozinha) e 2 vagas "Em destaque"
  (mais uma vencida)
- vaga **aberta, pausada e encerrada** — as duas últimas com gente dentro
- primeiro emprego, PCD, salário a combinar, diária, freelance
- **candidaturas nas quatro situações** (nova, lida, aprovada, recusada),
  para a tela de interessados ter conteúdo
- avisos recentes **e um de 40 dias**, que NÃO deve aparecer: é a prova da
  regra dos 15 dias (migration 0122)

## Três gatilhos que este arquivo precisa contornar

Não são defeitos — são as travas que protegem o app, e é por isso que
"dados de teste" aqui não é só um `insert`:

1. **`whatsapp_verified` nasce sempre `false`** (0024). Sem confirmar, os
   cadastros existem e não aparecem em lugar nenhum: a view
   `professionals_public` esconde quem não confirmou (0076/0117). O
   arquivo liga a chave de sessão `app.confirmando_whatsapp` para marcar.
2. **`destaque_ate` só a administração escreve** (0116). No editor do
   painel `auth.uid()` é vazio, então nem você é "administração" ali — o
   gatilho apagaria a data em silêncio. O arquivo desliga o gatilho por um
   instante e **religa** logo abaixo. Se algo falhar no meio, rode a linha
   do `enable`.
3. **Vaga exige plano ativo, e candidatura exige vaga ativa** (0073 e
   0080). Por isso as empresas nascem com plano, todas as vagas nascem
   ativas, e pausar/encerrar é o ÚLTIMO passo do arquivo — depois das
   candidaturas.

## Rodar de novo

Pode: tudo é `on conflict do nothing`. Rodar duas vezes não duplica nada.
