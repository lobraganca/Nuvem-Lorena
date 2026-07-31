# O banco de dados do Avena

Hoje o Avena não tem banco: cada pessoa que abre o app guarda tudo no próprio
navegador, e nada trafega entre um aparelho e outro. Este documento é o caminho
para mudar isso.

**Escolha: Supabase.** Ele resolve num serviço só o que precisaríamos montar em
quatro — banco de dados, contas e senhas, envio do SMS de confirmação,
armazenamento das fotos e funções de servidor. É Postgres de verdade por baixo,
o que importa por dois motivos: as regras de segurança ficam dentro do banco (e
não no site, que roda no computador do visitante), e se um dia o Supabase não
servir mais, o que sai de lá é um Postgres comum que roda em qualquer lugar.

**Custo: zero para começar.** O plano gratuito dá 500 MB de banco, 1 GB de
arquivos e 50 mil contas ativas por mês. Para o tamanho do Avena hoje, sobra.
Ele pausa projetos parados por uma semana — basta abrir o painel para religar.
O plano seguinte é US$ 25/mês, e só faz sentido quando houver movimento real.

---

## O que já está pronto neste repositório

| Arquivo | O que faz |
|---|---|
| `supabase/migrations/0001_esquema.sql` | Cria as tabelas |
| `supabase/migrations/0002_seguranca.sql` | Define quem pode ler e escrever o quê |
| `supabase/testes/` | Prova que as regras barram quem deve barrar |

Os dois arquivos SQL foram rodados num Postgres 16 antes de entrarem aqui, e as
regras foram testadas com quatro pessoas diferentes (uma viajante, um dono de
agência, um estranho e a administradora). Dezesseis casos, todos conferidos.

---

## Passo 1 — Criar o projeto

1. Entre em **supabase.com** e crie a conta (dá para usar a do GitHub).
2. **New project**. Nome: `avena`.
3. **Region: São Paulo (sa-east-1)**. Isso não é detalhe: o banco na Virgínia
   acrescenta uns 120 ms a cada consulta feita do Brasil, e o app faz várias
   por tela.
4. Guarde a **senha do banco** que ele gera. Ela aparece uma vez só. Guarde num
   gerenciador de senhas, não num papel nem no WhatsApp.

## Passo 2 — Criar as tabelas

No painel, **SQL Editor › New query**. Cole o conteúdo de
`supabase/migrations/0001_esquema.sql`, rode, e faça o mesmo com
`0002_seguranca.sql`. **Nessa ordem** — o segundo depende do primeiro.

Se aparecer erro no meio, pare e me mande a mensagem. Rodar de novo por cima
de um banco meio criado costuma dar um segundo erro que esconde o primeiro.

## Passo 3 — Tornar-se a administradora

Crie sua conta pelo app normalmente. Depois, no SQL Editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'seu-email@avenaapp.com.br');
```

Este é o único jeito de existir uma administradora, e é de propósito: ninguém
consegue se promover pelo app nem pela API. A regra que impede isso está
testada — foi o primeiro caso do teste.

## Passo 4 — As duas chaves

Em **Settings › API** aparecem duas chaves. A diferença entre elas é a coisa
mais importante deste documento.

**`anon` (pública).** Vai no site, com o prefixo `VITE_`, e qualquer visitante
consegue lê-la. Isso é esperado e não é falha: sozinha ela não abre nada,
porque tudo o que ela pode fazer passa pelas regras do `0002_seguranca.sql`.

**`service_role` (secreta).** Ela **ignora todas as regras de segurança**. É a
chave que grava pagamentos e confirma reservas — coisas que o navegador não
pode fazer. Ela vive **apenas** nas variáveis de ambiente do servidor.

> Se essa chave for para o site, para o Git, para um print de tela ou para uma
> conversa, qualquer pessoa passa a poder ler e apagar tudo: reservas,
> documentos das empresas, mensagens. Se acontecer, gere outra imediatamente em
> **Settings › API › Reset** — a antiga está comprometida a partir do segundo
> em que saiu do lugar dela. **Nunca me mande essa chave**, nem por engano: eu
> não preciso dela para nada, e o que aparece nesta conversa não é secreto.

No site (Vercel), só isto:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=a chave anon
```

## Passo 5 — A confirmação por SMS

O Supabase já faz o envio e a conferência do código, e é isso que transforma a
tela que hoje mostra o código na própria tela numa confirmação de verdade:
o código passa a nascer no servidor e o navegador nunca o vê.

Em **Authentication › Providers › Phone**, ligue o provedor e informe a conta
de um serviço de SMS (Twilio, Zenvia ou Infobip). Esse é o **único custo
inevitável** do lançamento: alguns centavos por mensagem enviada.

As credenciais do serviço de SMS ficam no painel do Supabase, nunca no site.

---

## O que fica protegido, em português

O que o `0002_seguranca.sql` garante, e que **não depende do app** — vale para
quem chamar a API direto:

- **Ninguém se promove a administradora.** Nem pelo app, nem pela API.
- **Nenhuma empresa se dá o selo de verificado**, nem sai de uma suspensão.
  Só você.
- **Os documentos de uma empresa** (CNPJ, endereço, CPF do representante) são
  vistos pelo dono e por você. Nem o viajante que reservou enxerga.
- **Uma reserva** é vista por quem comprou, por quem vende, e por você.
- **Só avalia quem foi**: a avaliação exige uma reserva sua, confirmada, com
  data já passada. Sem isso o banco recusa.
- **Ninguém declara um pagamento como recebido pelo navegador.** Quem grava
  pagamento é o servidor, com a chave secreta.
- **As memórias de viagem seguem a privacidade do perfil** — e você, como
  administradora, não as vê. Você administra o negócio, não o diário de
  ninguém.

---

## O que ainda falta depois disto

Criar o banco é a fundação, não a casa. Com ele de pé, ainda falta:

1. **Ligar o app ao banco.** Hoje o app lê e escreve no navegador
   (`AvenaContext`). Cada tela passa a falar com o Supabase. É o maior pedaço
   do trabalho, e dá para fazer aos poucos, uma tela por vez.
2. **Trocar as contas locais pelas do Supabase**, e com isso ganhar
   recuperação de senha por e-mail — que hoje não existe.
3. **As funções de servidor do Mercado Pago** (criar cobrança e receber a
   confirmação), descritas em `pagamentos-mercado-pago.md`.
4. **Proteger o painel administrativo no servidor**, como está em
   `painel-administrativo.md`. O `role = 'admin'` deste documento é a base
   disso.
