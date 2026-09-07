# A Inter, guardada aqui de propósito

Estes arquivos são a fonte **Inter**, a mesma que o app usa
(`src/estilo-ei.css`). As artes do Instagram são geradas com ela para que
o post e a tela do celular pareçam a mesma empresa.

## Por que guardados no repositório, e não baixados na hora

Porque a arte tem de sair igual daqui a um ano. Baixando do Google Fonts a
cada geração, a peça muda no dia em que a rede sair, o endereço mudar ou a
Google publicar uma versão nova com o desenho ajustado — e ninguém ia
descobrir isso olhando o código, só olhando duas artes lado a lado.

São 6 arquivos, ~2 MB no total. É barato pelo que compra.

## De onde vieram

Google Fonts, família Inter, pesos 400, 500, 600, 700, 800 e 900:

    https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900

## Licença

**SIL Open Font License 1.1** — permite usar, redistribuir e guardar cópia
junto do projeto, inclusive comercialmente. A única exigência que nos toca
é não vender a fonte sozinha, o que não é o caso.

Texto completo: https://openfontlicense.org

## Qual peso serve para quê

| Arquivo | Onde é usado (`artes_ei.py`) |
|---|---|
| `Inter-400.ttf` | `INTER` — corpo de texto, o apoio embaixo da manchete |
| `Inter-500.ttf` | `INTER_MEDIA` — o endereço no rodapé, a primeira frase da tela 8 |
| `Inter-600.ttf` | `INTER_SEMI` — o contador "03 / 09", as linhas da lista |
| `Inter-700.ttf` | `INTER_NEGRITO` — reserva |
| `Inter-800.ttf` | `INTER_PESADA` — as manchetes |
| `Inter-900.ttf` | `INTER_PRETA` — os números grandes, a frase que fecha |
