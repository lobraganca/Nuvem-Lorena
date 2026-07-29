# Painel administrativo — como acessar e como proteger

## O problema, dito sem rodeio

Não existe segurança do lado do navegador. Qualquer verificação escrita no
código do site roda no computador do visitante: ele pode ler o código, editar o
que está guardado e chamar as funções na mão. **Uma senha guardada no navegador
é uma senha escrita na porta.**

Por isso o painel não foi "protegido por senha". Ele foi **removido**.

## Como está agora

O `/admin` só existe se o site for compilado com `VITE_ADMIN_ENABLED=true`.
Sem essa variável, o código do painel **não entra no pacote** que vai para o ar:
não há o que encontrar no JavaScript nem o que alcançar digitando o endereço, e
`avenaapp.com.br/admin` cai na página "não encontrada", igual a qualquer outro
endereço inexistente.

Verificado nos dois cenários:

| Build | Arquivos gerados | `/admin` |
|---|---|---|
| Padrão (público) | só `index-*.js` | Página não encontrada |
| `VITE_ADMIN_ENABLED=true` | `index-*.js` + `Admin-*.js` | Painel abre |

Isso resolve o acesso acidental e o acesso por curiosidade — que é o risco real
hoje. **Não** resolve o caso de alguém obter o build administrativo.

## Como você acessa o painel

### Opção A — Só no seu computador (recomendada por enquanto)

```bash
VITE_ADMIN_ENABLED=true npm run dev
```

O painel abre em `localhost`, no seu computador, e nunca vai para a internet.
Para os números do negócio, isso basta.

### Opção B — Um endereço separado, protegido pela hospedagem

Quando precisar acessar de outro lugar, publique um **segundo site** a partir do
mesmo repositório:

1. Na Vercel, crie um projeto novo apontando para o mesmo repositório.
2. Nas variáveis de ambiente dele: `VITE_ADMIN_ENABLED=true`.
3. Domínio: `admin.avenaapp.com.br` (um registro CNAME a mais no registro.br).
4. **Ative a proteção por senha da hospedagem** (na Vercel, "Deployment
   Protection"; na Netlify, "Password protection"). Isso pede autenticação
   **antes** de o site carregar — é uma tranca de verdade, do lado do servidor,
   e não depende de nada do código.

O site público em `avenaapp.com.br` continua sendo compilado sem a variável, ou
seja, sem o painel.

> A proteção por senha da hospedagem costuma exigir plano pago. Se for o caso,
> fique na Opção A até haver login de verdade.

## O que ainda falta — e por que é o que vale

Quando existir autenticação (Bloco 1 de
[pendencias-para-o-ar.md](pendencias-para-o-ar.md)), a proteção real é esta:

1. **Papel de administrador no banco**, não no navegador.
2. **Verificação no servidor a cada ação.** Não basta esconder o botão de
   suspender empresa: a função que suspende precisa conferir, no servidor, que
   quem chamou é administradora. Se a checagem estiver só na tela, qualquer
   pessoa chama a função direto.
3. **Regras de acesso por linha no banco** (Row Level Security, no Supabase).
   O viajante enxerga as reservas dele; a agência, as dela; a administradora, o
   que o papel permitir.
4. **Registro de quem fez o quê.** Suspender empresa, apagar avaliação e
   responder chamado são ações que afetam terceiros e precisam de histórico —
   inclusive para a sua própria defesa se uma agência contestar.
5. **Segundo fator** na sua conta. Uma senha só, na conta que vê o faturamento
   inteiro, é pouco.

Só depois disso o `VITE_ADMIN_ENABLED` deixa de ser necessário: o painel pode
viver no site principal, porque quem manda passa a ser o servidor.

## O que o painel expõe hoje

Para dimensionar o risco corretamente:

- Faturamento, MRR e comissões.
- Todas as reservas, com valores, empresa e datas.
- E-mails das empresas cadastradas.
- Avaliações com o nome de quem escreveu.
- Mensagens dos chamados de suporte — que podem conter o que o viajante
  escreveu sobre um problema.
- Ações: suspender e verificar empresas, apagar avaliações, encerrar anúncios,
  responder chamados.

**Não** expõe CPF nem documento de participante: esses aparecem só para a
agência que precisa deles para embarque, e para o próprio viajante que comprou.

Ainda assim, é o conjunto de dados mais sensível do sistema — daí a decisão de
tirá-lo do ar em vez de escondê-lo.
