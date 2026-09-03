# Testes herdados do outro produto

Estes cinco vieram do **procurô** (créditos por contato, avaliações com
CPF, catálogo de serviços, cobranças abandonadas) e não exercitam nada do
Ei Emprego.

Eles pararam de rodar por mudança de schema, não por defeito: a coluna
`profiles.cpf` deixou de existir, `professionals.uf` virou obrigatória, o
`check` do catálogo mudou. Consertá-los é um trabalho à parte, e o
benefício é pequeno enquanto essas telas não fazem parte do app.

Ficam aqui, fora da bateria principal, por dois motivos:

1. **Uma bateria com falha permanente é uma bateria que ninguém roda.**
   Depois da terceira vez em que "5 falharam" quer dizer "os 5 de sempre",
   a próxima falha de verdade passa despercebida.
2. Eles descrevem regras que ainda valem no banco (o gatilho da avaliação,
   o teto do catálogo). Se um dia essas telas voltarem, o teste está aqui.

Para rodar um deles à mão:

```bash
psql -h /var/tmp -p 5433 -U postgres -d SEU_BANCO -f supabase/testes/herdados/01-gatilhos-e-creditos.sql
```
