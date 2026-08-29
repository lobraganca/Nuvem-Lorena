
## enviar-avisos-de-vaga

Manda as notificações push das vagas. Lê a fila em `job_notifications`
(linhas com `enviado_em` nulo) e marca a data quando o aviso sai.

Chamada pelo app logo depois de a onda abrir, e também serve para rotina —
o que não saiu continua na fila para a chamada seguinte.

### Segredos exigidos

| Segredo | Para quê |
|---|---|
| `FCM_SERVER_KEY` | chave do Firebase — é o que entrega no app da Play Store |
| `VAPID_PUBLICA` | o par da `VITE_VAPID_PUBLICA` que vai no app |
| `VAPID_PRIVADA` | assina o envio do site. **Nunca** vai para o app |
| `VAPID_SUBJECT` | `mailto:seu@email` — o Web Push exige um contato |

Sem `FCM_SERVER_KEY` o app da loja não recebe; sem o par VAPID, o site não
recebe. A função não quebra em nenhum dos dois casos: ela deixa as linhas na
fila, e o aviso aparece em "vagas para você" quando a pessoa abrir o app.

### Como gerar as chaves VAPID

```bash
npx web-push generate-vapid-keys
```

A pública vai para a Vercel como `VITE_VAPID_PUBLICA` **e** para o Supabase
como `VAPID_PUBLICA` — as duas precisam ser a mesma, senão o navegador
inscreve com uma chave que o servidor não sabe assinar, e o envio falha
sem erro visível.

### O que push NÃO faz

Push só alcança quem instalou o app e aceitou receber. No iPhone, só quem
adicionou o app à tela de início. Quem usa pelo navegador comum não recebe —
e é por isso que a vaga também fica guardada em `job_notifications` e
aparece em "vagas para você". O push é o empurrão, não o único caminho.
