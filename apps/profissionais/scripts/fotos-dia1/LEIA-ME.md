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

1. **Deitada** (horizontal). A moldura da foto é um retângulo deitado —
   824×556 na arte. Foto em pé entra, mas perde o alto e o pé no corte, e é
   justamente onde costuma estar a fachada.
2. **De longe o suficiente** para caber a fachada inteira, com o assunto no
   meio. O corte tira um pouco mais de chão do que de céu.
3. **Luz do dia**, sem contraluz. A foto aparece inteira, do jeito que
   você tirou — não tem nada escurecendo por cima dela, porque o texto fica
   FORA da moldura. Então foto ruim aparece ruim: é o único lugar da arte
   que depende de você.
4. **Sem rosto identificável em primeiro plano.** Pessoa de costas ou de
   longe tudo bem; rosto reconhecível precisa de autorização de quem
   aparece, e isso vale para post de empresa.
5. **Sem placa de preço e sem nome de concorrente em destaque.** A fachada
   pode aparecer; um cartaz de promoção no meio da arte rouba a leitura.

Não precisa ser foto profissional. Celular na mão, de dia, em pé — é o que
o carrossel pede. Foto "boa demais" até atrapalha: a peça fala da vida
real, e a vida real não tem estúdio.

## O que o gerador faz com elas

- **Recorta** na medida da moldura sem esticar (corta o excesso, tirando um
  pouco mais de chão que de céu). A moldura é a mesma nas quatro telas dos
  lugares, e é isso que faz as quatro serem a MESMA tela com outra foto.
- **Unifica**: puxa 26% para o cinza e 10% para o azul escuro da marca, para
  cinco fotos de horas e celulares diferentes parecerem a mesma campanha —
  sem virar filtro de rede social.

A foto NÃO leva texto por cima nem escurecimento. Ela mora num retângulo
próprio e o texto fica fora, na cor chapada, do jeito que revista impressa
monta uma página. Foi assim que sumiu o último degradê da peça.
