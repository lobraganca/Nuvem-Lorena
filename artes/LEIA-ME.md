# As artes de divulgação

As três peças chamando o empresário a publicar vaga, feitas em 10/09.

| Arquivo | Tamanho | Para quê |
|---|---|---|
| `ei-empresas-1-publique-sua-vaga.png` | 1080×1350 | a principal — o app vai atrás das pessoas |
| `ei-empresas-2-em-tres-passos.png` | 1080×1080 | como funciona, para quem ainda não entendeu |
| `ei-empresas-3-30-dias-gratis.png` | 1080×1350 | a promoção — **só postar com a oferta ligada** |

## Para refazer ou mudar uma frase

```bash
cd /home/user/Nuvem-Lorena
# editar artes/artes.html e então:
node artes/gerar.mjs
```

O `artes.html` tem as três peças uma embaixo da outra; o `gerar.mjs`
fotografa cada uma no tamanho exato e grava o PNG.

## Por que fica na raiz, e não em `apps/profissionais/`

O workflow de publicação dispara em qualquer push que toque
`apps/profissionais/**`. Arte de divulgação não muda o site, e cada
ajuste de frase publicaria o app de novo à toa.

## As cores e a fonte não foram escolhidas a olho

O azul (`#0494e9`), o laranja (`#fdaa46`) e o creme (`#f5f2ec`) saíram
por amostragem de pixel das artes que a dona já usava — as peças novas
precisavam ser da MESMA família, não parecidas.

A fonte é a Inter de `apps/profissionais/scripts/fontes/`, a mesma do
app, e a marca é a `public/marca-ei.png`, a mesma que aparece dentro
dele. Nenhum arquivo de marca é editado à mão (ver o CLAUDE.md).

## O que a peça 3 promete, e de quem depende

Os 30 dias grátis existem no app (migration 0133), mas ficam num
interruptor na tabela `ofertas`. **Se ele estiver desligado, a arte
promete o que o site não entrega.** Conferir na tela de planos antes de
postar.

As peças 1 e 2 não dependem de nada disso.

## Uma frase que foi evitada de propósito

"Cadastre-se grátis" não entrou. Cadastrar a empresa é grátis, mas
PUBLICAR a vaga exige plano — prometer grátis na chamada e cobrar na
hora de publicar queima o app com o comerciante da cidade. O grátis só
aparece na peça da promoção, onde é verdade.
