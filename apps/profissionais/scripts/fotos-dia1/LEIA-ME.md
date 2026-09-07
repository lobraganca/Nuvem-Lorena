# As cinco fotos do carrossel do Dia 1

Coloque os arquivos **aqui**, com estes nomes exatos, e rode:

```bash
cd /home/user/Nuvem-Lorena/apps/profissionais/scripts
python3 gerar-arte-dia1.py
```

Enquanto um arquivo não existir, aquela tela sai com um retângulo riscado
dizendo "SUA FOTO AQUI" — serve para ver o enquadramento, e nunca deve ir
para o ar.

| Arquivo | O que fotografar |
|---|---|
| `1-cidade.jpg` | Itabirito de longe, ou uma rua do centro com movimento. É a capa. |
| `2-padaria.jpg` | A fachada de uma padaria de bairro |
| `3-loja.jpg` | Uma loja da rua principal, vista da calçada |
| `4-posto.jpg` | Um posto de combustível na entrada da cidade |
| `5-mercado.jpg` | A frente de um mercado grande |

## Por que as fotos têm de ser de Itabirito, e suas

Porque a peça inteira depende disso. A frase é "na padaria da esquina" — a
graça é a pessoa reconhecer a padaria e pensar "eu deixei currículo ali".
Uma padaria genérica de banco de imagem diz o contrário do que a frase
promete, e quem mora na cidade percebe na hora.

Não dá para gerar essas fotos aqui: este container não alcança nenhum banco
de imagem (a rede recusa), e inventar fotografia de um lugar que existe
seria pior do que não ter nenhuma.

## Como tirar, para a arte sair boa

1. **Em pé** (vertical). A arte é 1080×1350; foto deitada perde as bordas
   no corte.
2. **De longe o suficiente** para caber a fachada inteira. O texto entra no
   terço de baixo e cobre o que estiver ali — enquadre o assunto no meio e
   no alto.
3. **Luz do dia**, sem contraluz. Foto muito clara faz o gerador escurecer
   demais para o texto branco aparecer, e a foto some atrás do véu; se ela
   for clara demais até para isso, o gerador **para** e avisa qual é.
4. **Sem rosto identificável em primeiro plano.** Pessoa de costas ou de
   longe tudo bem; rosto reconhecível precisa de autorização de quem
   aparece, e isso vale para post de empresa.
5. **Sem placa de preço e sem nome de concorrente em destaque.** A fachada
   pode aparecer; um cartaz de promoção no meio da arte rouba a leitura.

Não precisa ser foto profissional. Celular na mão, de dia, em pé — é o que
o carrossel pede. Foto "boa demais" até atrapalha: a peça fala da vida
real, e a vida real não tem estúdio.

## O que o gerador faz com elas

- **Recorta** para 1080×1350 sem esticar (corta o excesso, tirando um pouco
  mais de chão que de céu).
- **Unifica**: dessatura de leve e passa um véu azul de 12%, para cinco
  fotos de horas e celulares diferentes parecerem a mesma campanha.
- **Escurece só o quanto precisa** para o texto branco passar no contraste
  mínimo, e imprime quanto foi (`véu 35% em Na padaria da esquina.`).
