# De onde tirar as informações de passeios, e como importar

Duas perguntas diferentes: **onde conseguir os dados** e **onde colocá-los no
app**. A segunda é fácil. A primeira tem uma resposta que decepciona no começo
e ajuda no fim.

---

## Parte 1 — De onde vêm os dados

### Não existe um banco público de passeios com preços

Não há, no Brasil, uma base aberta com passeios, roteiros e valores prontos
para baixar. Preço, itinerário, duração e disponibilidade são informação
comercial de cada agência; ninguém publica isso em formato aberto.

O que existe é uma base pública de **empresas**, não de passeios.

### O que dá para usar de verdade

**Cadastur (Ministério do Turismo).** É o cadastro obrigatório de agências,
guias, meios de hospedagem e transportadoras turísticas. A consulta é pública e
traz nome, CNPJ, município, tipo de prestador e situação do registro. Isso te
dá exatamente o que você precisa para começar: **a lista de quem existe e está
regular na cidade que você escolheu**. Também é o dado que alimenta o campo
Cadastur do cadastro e o selo de verificação.

O portal de dados abertos do governo (dados.gov.br) costuma publicar recortes
desse cadastro em planilha. Vale procurar antes de copiar na mão.

**Secretarias e conventions bureaux municipais.** Quase toda cidade turística
tem uma lista de operadores locais, muitas vezes em PDF. Serve para cruzar com
o Cadastur.

**Associações do setor** (ABAV, ABETA, sindicatos de guias) têm listas de
associados, e uma apresentação vinda da associação abre porta muito mais rápido
que um contato frio.

### O que NÃO fazer

**Não copie descrição, roteiro e foto do site da agência.** Texto e imagem são
obra protegida por direito autoral; usar sem autorização é violação, ainda que
a intenção seja divulgar. Foto de passeio é o caso mais delicado, porque
costuma ser de fotógrafo contratado.

**Não raspe Viator, GetYourGuide, TripAdvisor ou concorrentes.** Além do
conteúdo ser deles, os termos de uso proíbem, e uma plataforma nova brigando na
justiça com uma grande é uma briga que você não quer.

**O caminho legítimo é pedir.** Ligue, explique, peça a lista de passeios com
preço. A agência manda a planilha, o cardápio em PDF ou o catálogo de WhatsApp
que ela já usa. É mais rápido do que parece — e a autorização vem junto.

### Peça por escrito

Antes de publicar, tenha um e-mail ou mensagem da agência dizendo que autoriza
a Avena a publicar aqueles passeios, preços e fotos. Uma linha basta. Isso te
protege se alguém reclamar depois, e é o embrião do contrato de parceria que
está no Bloco 3 das pendências.

---

## Parte 2 — Onde importar no app

Existem **dois lugares**, para duas situações diferentes.

### A agência cadastra os próprios passeios

Painel profissional › **Importar vários passeios de uma vez**.

Serve para a agência que já assumiu o perfil. Aceita CSV do Excel e do Google
Planilhas, com ponto e vírgula ou vírgula, e entende preço no formato
brasileiro (`R$ 1.234,50`).

Quem tem poucos passeios pode usar os **modelos prontos** logo abaixo: escolhe
o tipo mais parecido (barco, mergulho, trilha, cachoeira, city tour,
gastronômico, observação de fauna, diária), o formulário preenche descrição,
duração, vagas e política, e sobra só corrigir o preço.

### Você cadastra pela Avena

Painel da administradora › aba **Cadastro**.

1. **Cadastrar empresas em lote.** Baixe a planilha modelo, preencha com a lista
   que você levantou (nome, tipo, cidade, estado, e-mail, telefone, Cadastur) e
   importe. Aceita "agência", "guia", "restaurante", "hotel" e "pousada"
   escritos de qualquer jeito, e avisa linha a linha o que não conseguiu ler.
2. **Importar passeios de uma empresa.** Escolha a empresa na lista e importe a
   planilha de passeios dela.

Para abrir o painel:

```bash
npm run dev:admin
```

### O que acontece com quem você cadastrou

Perfis criados por você nascem marcados como **não reivindicados**, e isso
aparece para o viajante:

- Na busca, o card mostra o selo "Não reivindicado" no lugar do plano.
- Na página da empresa, um aviso explica que as informações foram cadastradas
  pela equipe do Avena, que a agência ainda não assumiu o perfil, e que a
  reserva é feita direto com ela.
- Os passeios aparecem com preço e detalhes, **mas sem botão de reservar** —
  não há conta de recebimento conectada, então não haveria para onde mandar o
  dinheiro.

Isso é proposital. Apresentar uma agência como parceira cadastrada antes de ela
concordar seria mentira, e a primeira reserva que chegasse sem ela saber
destruiria a relação que você está tentando construir.

### O ciclo que isso destrava

É a saída para o problema do ovo e da galinha:

1. Você monta o catálogo de **uma cidade** com autorização das agências.
2. O viajante busca aquela cidade e **encontra oferta de verdade** — em vez de
   duas agências e uma tela vazia.
3. A agência começa a receber contato vindo do app.
4. Com demanda na mão, ela assume o perfil e conecta o recebimento — aí sim a
   reserva acontece dentro da plataforma e a comissão entra.

O item 4 é o que fecha a conta, e ele depende do pagamento estar ligado
([pagamentos-mercado-pago.md](pagamentos-mercado-pago.md)).
