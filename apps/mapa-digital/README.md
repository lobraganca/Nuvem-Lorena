# Mapa Digital

Plataforma para mapear, em cinco pilares, o que se quer criar no digital — da
pesquisa passiva ao primeiro passo com data marcada.

Endereço das telas: `/pilar/1/pesquisa-passiva`, `/pilar/2/quem-e`, e assim por
diante — a mesma forma da plataforma que serviu de referência.

## O que existe hoje

- 5 pilares, 14 etapas, 39 perguntas, com ajuda e exemplo em cada uma.
- Salva sozinho conforme se escreve. Não tem botão de salvar, não tem conta.
- Progresso por etapa, por pilar e no total.
- Relatório com tudo, para copiar, baixar em texto, ou guardar como cópia de
  segurança (e restaurar depois).
- Funciona em celular (o menu vira gaveta) e em computador (o menu fica fixo).
- Tema claro e escuro, conforme o aparelho.

## O que NÃO existe ainda

- **Conta e nuvem.** As respostas ficam no navegador do aparelho
  (`localStorage`). Trocou de celular, limpou o navegador, janela anônima: não
  está lá. É por isso que o relatório tem "baixar cópia de segurança".
  Quando houver conta, o único arquivo que muda é `src/lib/guardar.ts` — as
  telas só conhecem `ler()`, `salvar()` e `assinar()`.
- **Publicação.** Ninguém publica isto ainda; roda local.

## As perguntas são dado, não código

Todo o método vive em `src/dados/metodo.ts`. Trocar um pilar, uma etapa ou uma
pergunta é editar esse arquivo — nenhuma tela precisa ser tocada.

Cuidado com um detalhe: o `id` de cada campo entra na chave do que fica salvo
(`1.pesquisa-passiva.o-que-procuram`). Renomear um `id` é o mesmo que apagar a
resposta de quem já respondeu. Na dúvida, crie um `id` novo.

## Comandos

```bash
cd /home/user/Nuvem-Lorena/apps/mapa-digital
npm install
npm run dev        # abrir para trabalhar
npx tsc --noEmit   # tipos
npm run build      # montagem
```

O teste de navegador (`testes/navegador.mjs`) precisa do playwright instalado
na raiz do repositório; as instruções estão no cabeçalho do arquivo.

## Este app é separado dos outros

O repositório tem outros dois apps (o Avena na raiz e o Ei Itabirito em
`apps/profissionais`), com outros bancos e outras publicações. Este aqui não
compartilha nada com eles — nem código, nem banco, nem workflow. A ideia é que
ele mude de casa para um repositório próprio; como é uma pasta fechada, a
mudança é copiar a pasta.
