import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { lerVitrine, type Vitrine as Dados, type VagaDaVitrine } from "../../lib/vitrine";
import { salarioEmTexto } from "../../types/domain";
import { SeletorDeCidade } from "./SeletorDeCidade";
import { cidadeParaMostrar } from "../../lib/cidadeEscolhida";

/**
 * A vitrine da cidade, para quem chegou agora e não tem conta.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "ao entrar no site a pessoa tem que ter uma tela bonita pra ver
 * as vagas e os candidatos. Sem ter que fazer login."
 *
 * ── POR QUE ISTO É A COISA MAIS IMPORTANTE DA TELA INICIAL ────────────
 *
 * Até aqui, quem abria o endereço via uma tela de entrar. Uma tela de
 * entrar não responde à única pergunta que quem chega tem — "tem alguma
 * coisa aqui pra mim?" — e pedir cadastro antes de responder é pedir fé.
 * Numa cidade pequena, onde o app se espalha por link de WhatsApp, quem
 * abre e vê um formulário fecha.
 *
 * Aqui a resposta vem primeiro: seis vagas de verdade, seis pessoas de
 * verdade, com o total ao lado. A conta é pedida depois, e só quando a
 * pessoa quiser FAZER alguma coisa — se candidatar ou publicar.
 *
 * ── O QUE NÃO APARECE AQUI ────────────────────────────────────────────
 *
 * Contato de ninguém. Ver o cabeçalho de `lib/vitrine.ts`: a lista de
 * telefones de quem está desempregado é o dado mais sensível deste app, e
 * ela continua exigindo conta. Aqui saem nome, ofício, foto e cidade — o
 * suficiente para a cidade parecer viva, e nada com que se possa montar
 * uma lista de ligações.
 *
 * ── E ERRO NUNCA VIRA LISTA VAZIA ─────────────────────────────────────
 *
 * "Nenhuma vaga aberta" e "a consulta falhou" são a mesma tela e coisas
 * opostas. A primeira faz a dona achar que a cidade parou; a segunda diz
 * o que aconteceu. É a regra do CLAUDE.md, e esta tela é onde ela mais
 * importa: é a primeira coisa que qualquer pessoa vê.
 */
export function Vitrine({ minhaCasa }: { minhaCasa?: { para: string; rotulo: string } | null } = {}) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  /* ── A CIDADE MORA NA URL ──────────────────────────────────────────
     A dona: "na primeira tela ter um botão para escolha da cidade. O app
     funcionará em mais cidades."

     Na URL (`?c=`) e não só no estado da tela, que é a convenção do resto
     do app: filtro que não mora na URL some quando a pessoa abre uma vaga
     e volta — defeito que este projeto já pagou caro, e que o CLAUDE.md
     registra.

     Sem `?c=`, `cidadeParaMostrar` cai na última cidade escolhida neste
     aparelho e, se nunca houve nenhuma, em Itabirito. O segundo argumento
     é a cidade do cadastro da pessoa: aqui é sempre `null`, porque esta
     tela é a de quem NÃO tem conta. */
  const [params, setParams] = useSearchParams();
  const cidade = cidadeParaMostrar(params.get("c"), null);

  function escolherCidade(nova: string) {
    /* `guardarCidade` já foi chamado pelo seletor; aqui só o endereço.
       `replace` para a escolha não encher o botão de voltar: trocar de
       cidade três vezes exigiria três toques em voltar para sair da
       tela. */
    const p = new URLSearchParams(params);
    p.set("c", nova);
    setParams(p, { replace: true });
  }

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro("");
    lerVitrine(cidade)
      .then((d) => vivo && setDados(d))
      .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [cidade]);

  /* A CAPA APARECE ANTES DOS DADOS, sempre.

     Ela é a primeira coisa que a pessoa vê, e não pode piscar: se o
     título só nascesse junto com a consulta, a abertura do site seria
     meio segundo de tela cinza vazia — que é exatamente a impressão que
     esta tela existe para desfazer. Só os NÚMEROS esperam, e eles entram
     no lugar já reservado, sem empurrar nada. */
  const capa = (
    <header className="ei-capa">
      {/* ── A REDE DE CONEXÕES — 07/09 ─────────────────────────────────
          A dona mandou uma imagem de referência (pontos ligados por
          linhas, brilhando no escuro) e pediu: "a parte onde tem escrito
          pode ter tipo essas conexões bem clarinhas. E a logo no canto."

          É DESENHADA, e não a imagem que ela mandou. Três motivos, em
          ordem de importância: a imagem é de banco de imagem e a licença
          é desconhecida; ela é de outro azul e brigaria com a marca; e um
          bitmap de fundo fica borrado no celular de tela boa e pesa no 4G
          de quem abre o site pela primeira vez. Este SVG tem 4 KB, é
          nítido em qualquer tela e usa a cor do app.

          As posições são FIXAS, geradas uma vez com semente fixa. Rede
          sorteada a cada abertura mudaria de desenho entre uma visita e
          outra — e "por que a tela ficou diferente?" é uma pergunta que
          ninguém deveria ter de fazer.

          E o desenho não é enfeite qualquer: o app existe para ligar duas
          pessoas da mesma cidade. É o assunto da tela, em imagem.

          `slice` para a rede cobrir a faixa inteira sem deformar os
          ângulos — esticada, ela vira uma malha achatada e denuncia que é
          decoração. */}
      <svg
        className="ei-capa-rede"
        viewBox="0 0 390 300"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
      >
        <g className="ei-capa-fios"><line x1="-7.0" y1="-10" x2="61.8" y2="-10"/><line x1="61.8" y1="-10" x2="112.9" y2="-4.8"/><line x1="112.9" y1="-4.8" x2="149.5" y2="0.3"/><line x1="112.9" y1="-4.8" x2="130.5" y2="58.7"/><line x1="149.5" y1="0.3" x2="204.4" y2="-2.4"/><line x1="149.5" y1="0.3" x2="130.5" y2="58.7"/><line x1="149.5" y1="0.3" x2="181.5" y2="67.4"/><line x1="204.4" y1="-2.4" x2="261.4" y2="-10"/><line x1="204.4" y1="-2.4" x2="181.5" y2="67.4"/><line x1="204.4" y1="-2.4" x2="208.6" y2="61.2"/><line x1="261.4" y1="-10" x2="331.3" y2="11.8"/><line x1="331.3" y1="11.8" x2="375.0" y2="-10.0"/><line x1="331.3" y1="11.8" x2="321.5" y2="77.9"/><line x1="5.1" y1="91.1" x2="58.8" y2="71.3"/><line x1="5.1" y1="91.1" x2="1.9" y2="134.3"/><line x1="5.1" y1="91.1" x2="38.1" y2="139.4"/><line x1="58.8" y1="71.3" x2="130.5" y2="58.7"/><line x1="58.8" y1="71.3" x2="38.1" y2="139.4"/><line x1="130.5" y1="58.7" x2="181.5" y2="67.4"/><line x1="181.5" y1="67.4" x2="208.6" y2="61.2"/><line x1="208.6" y1="61.2" x2="270.9" y2="86.4"/><line x1="270.9" y1="86.4" x2="321.5" y2="77.9"/><line x1="270.9" y1="86.4" x2="221.0" y2="142.8"/><line x1="270.9" y1="86.4" x2="290.3" y2="157.2"/><line x1="321.5" y1="77.9" x2="395.6" y2="70.4"/><line x1="321.5" y1="77.9" x2="324.0" y2="152.7"/><line x1="1.9" y1="134.3" x2="38.1" y2="139.4"/><line x1="118.6" y1="147.4" x2="159.7" y2="153.1"/><line x1="118.6" y1="147.4" x2="74.9" y2="211.3"/><line x1="159.7" y1="153.1" x2="221.0" y2="142.8"/><line x1="159.7" y1="153.1" x2="153.2" y2="224.6"/><line x1="221.0" y1="142.8" x2="290.3" y2="157.2"/><line x1="290.3" y1="157.2" x2="324.0" y2="152.7"/><line x1="290.3" y1="157.2" x2="289.2" y2="227.6"/><line x1="324.0" y1="152.7" x2="391.0" y2="163.5"/><line x1="324.0" y1="152.7" x2="349.3" y2="218.3"/><line x1="391.0" y1="163.5" x2="349.3" y2="218.3"/><line x1="391.0" y1="163.5" x2="397.8" y2="228.4"/><line x1="9.2" y1="217.4" x2="74.9" y2="211.3"/><line x1="74.9" y1="211.3" x2="108.2" y2="234.3"/><line x1="108.2" y1="234.3" x2="153.2" y2="224.6"/><line x1="108.2" y1="234.3" x2="110.4" y2="305.9"/><line x1="153.2" y1="224.6" x2="204.4" y2="231.1"/><line x1="289.2" y1="227.6" x2="349.3" y2="218.3"/><line x1="289.2" y1="227.6" x2="291.4" y2="292.2"/><line x1="349.3" y1="218.3" x2="397.8" y2="228.4"/><line x1="397.8" y1="228.4" x2="370.9" y2="298.6"/><line x1="3.2" y1="298.4" x2="69.3" y2="310"/><line x1="69.3" y1="310" x2="110.4" y2="305.9"/><line x1="110.4" y1="305.9" x2="149.6" y2="307.3"/><line x1="228.7" y1="310" x2="291.4" y2="292.2"/><line x1="291.4" y1="292.2" x2="329.7" y2="306.1"/><line x1="329.7" y1="306.1" x2="370.9" y2="298.6"/><circle cx="-7.0" cy="-10" r="1.3" className="n1"/><circle cx="61.8" cy="-10" r="1.3" className="n1"/><circle cx="112.9" cy="-4.8" r="1.3" className="n1"/><circle cx="149.5" cy="0.3" r="1.3" className="n1"/><circle cx="204.4" cy="-2.4" r="1.3" className="n1"/><circle cx="261.4" cy="-10" r="1.3" className="n1"/><circle cx="331.3" cy="11.8" r="1.3" className="n1"/><circle cx="375.0" cy="-10.0" r="1.3" className="n1"/><circle cx="5.1" cy="91.1" r="1.3" className="n1"/><circle cx="58.8" cy="71.3" r="1.3" className="n1"/><circle cx="130.5" cy="58.7" r="1.3" className="n1"/><circle cx="181.5" cy="67.4" r="1.3" className="n1"/><circle cx="208.6" cy="61.2" r="1.3" className="n1"/><circle cx="270.9" cy="86.4" r="1.3" className="n1"/><circle cx="321.5" cy="77.9" r="1.3" className="n1"/><circle cx="395.6" cy="70.4" r="1.3" className="n1"/><circle cx="1.9" cy="134.3" r="1.3" className="n1"/><circle cx="38.1" cy="139.4" r="1.3" className="n1"/><circle cx="118.6" cy="147.4" r="1.3" className="n1"/><circle cx="159.7" cy="153.1" r="1.3" className="n1"/><circle cx="221.0" cy="142.8" r="2.2" className="n2"/><circle cx="290.3" cy="157.2" r="2.2" className="n2"/><circle cx="324.0" cy="152.7" r="2.2" className="n2"/><circle cx="391.0" cy="163.5" r="2.2" className="n2"/><circle cx="9.2" cy="217.4" r="1.3" className="n1"/><circle cx="74.9" cy="211.3" r="1.3" className="n1"/><circle cx="108.2" cy="234.3" r="1.3" className="n1"/><circle cx="153.2" cy="224.6" r="1.3" className="n1"/><circle cx="204.4" cy="231.1" r="1.3" className="n1"/><circle cx="289.2" cy="227.6" r="1.3" className="n1"/><circle cx="349.3" cy="218.3" r="1.3" className="n1"/><circle cx="397.8" cy="228.4" r="1.3" className="n1"/><circle cx="3.2" cy="298.4" r="1.3" className="n1"/><circle cx="69.3" cy="310" r="1.3" className="n1"/><circle cx="110.4" cy="305.9" r="1.3" className="n1"/><circle cx="149.6" cy="307.3" r="1.3" className="n1"/><circle cx="228.7" cy="310" r="1.3" className="n1"/><circle cx="291.4" cy="292.2" r="1.3" className="n1"/><circle cx="329.7" cy="306.1" r="1.3" className="n1"/><circle cx="370.9" cy="298.6" r="1.3" className="n1"/></g>
      </svg>

      {/* A marca no canto, grande e quase transparente: é assinatura, não
          logo. O logo de verdade está no cabeçalho, um dedo acima — dois
          logos do mesmo tamanho na mesma dobra seriam um a mais. */}
      <img className="ei-capa-marca" src="/marca-ei.png" alt="" aria-hidden="true" />
      {/* O botão da cidade vem ANTES do título: ele diz de onde é tudo o
          que vem abaixo, e lido depois viraria uma correção ("ah, era de
          outra cidade"). Ele some sozinho enquanto houver uma cidade só —
          ver o `SeletorDeCidade`: botão que não muda nada é ruído. */}
      {dados && dados.cidades.length > 0 && (
        <div className="ei-capa-cidade">
          <SeletorDeCidade
            cidade={cidade}
            cidades={dados.cidades}
            aoEscolher={escolherCidade}
          />
        </div>
      )}

      {/* ── A FRASE VOLTOU — 07/09 ────────────────────────────────
          A dona: "pode deixar a frase que estava antes. Quem contrata e
          quem procura…"

          Ela tinha saído na rodada do "muito texto", trocada por três
          palavras. A dona preferiu esta, e é dela a escolha — o que dá
          para fazer é caber melhor: 1,72rem em vez de 2rem, para o bloco
          ficar em duas linhas e os botões continuarem na primeira dobra,
          que era o outro pedido da mesma mensagem ("não sei onde
          clicar"). */}
      <h1 className="ei-capa-titulo">
        Quem contrata e quem procura, aqui se encontram
      </h1>
      <Numeros dados={dados} />
      {/* AS DUAS PORTAS DENTRO DA CAPA, e não lá embaixo.

          A dona: "não sei onde clicar". E não sabia mesmo: a única ação da
          tela era um "Criar conta" depois de duas prateleiras, fora da
          primeira dobra. Quem chega numa tela que não diz o que fazer não
          procura — sai.

          São duas e não uma porque quem chega é uma de duas pessoas, e o
          app inteiro é construído sobre essa escolha. Elas levam ao login
          já com o lado escolhido (`?lado=`), então ninguém responde a
          mesma pergunta duas vezes. */}
      {/* ── QUEM JÁ ENTROU TEM UMA PORTA SÓ — 07/09 ─────────────────
          A dona: "faça com que a tela inicial com as vagas e candidatos
          expostos sempre apareça. Inclusive quando está logado."

          As duas portas levam ao login com o lado já escolhido, e para
          quem chega de fora está certo. Para quem JÁ ENTROU seria uma
          armadilha: tocar em qualquer uma delas mandaria a pessoa logada
          para uma tela de entrar — que é exatamente a queixa da mesma
          mensagem ("assim que coloca a senha vai pra outra tela de
          login").

          Trocar de lado continua sendo sair e entrar de novo (04/09), e
          por isso a segunda porta não vira "ir para o outro lado": ela
          simplesmente não existe para quem está dentro. */}
      {minhaCasa ? (
        <div className="ei-capa-portas">
          <Link to={minhaCasa.para} className="ei-capa-porta ei-capa-porta-forte">
            {minhaCasa.rotulo}
          </Link>
        </div>
      ) : (
        <div className="ei-capa-portas">
          <Link to="/login?lado=trabalhar" className="ei-capa-porta ei-capa-porta-forte">
            Procuro emprego
          </Link>
          <Link to="/login?lado=contratar" className="ei-capa-porta">
            Quero contratar
          </Link>
        </div>
      )}
    </header>
  );

  if (carregando) {
    return (
      <div className="ei-vitrine">
        {capa}
        <p className="ei-vitrine-espera" aria-live="polite">
          Carregando o que tem na cidade…
        </p>
      </div>
    );
  }

  /* Este erro é o da chamada inteira falhar (sem conexão com o banco, por
     exemplo). Falha de UMA das faixas não chega aqui — ela vive dentro da
     faixa, para a outra continuar aparecendo. */
  if (erro) {
    return (
      <div className="ei-vitrine">
        {capa}
        <p className="ei-vitrine-erro" role="alert">
          {erro}
        </p>
      </div>
    );
  }

  if (!dados) return capa;

  return (
    <div className="ei-vitrine">
      {capa}
      {/* ── AS VAGAS EM DESTAQUE VÊM PRIMEIRO — 07/09 ─────────────────
          A dona: "coloque as vagas primeiro e inclusive ter uma sessão
          para as em destaque."

          O destaque é PAGO (migration 0116): a empresa compra para a vaga
          dela ficar no topo. Uma vitrine que não honra isso desmente o que
          foi vendido — e é a primeira tela do site, onde mais gente passa.

          A prateleira só existe quando há alguma: uma seção "Em destaque"
          vazia anuncia um produto que ninguém comprou. */}
      {dados.destaques.length > 0 && (
        <Faixa
          titulo="Em destaque"
          total={dados.destaques.length}
          erro={null}
          vazio=""
        >
          {dados.destaques.map((v) => (
            <CartaoDeVaga key={v.id} vaga={v} destaque />
          ))}
        </Faixa>
      )}

      <Faixa
        titulo="Vagas abertas"
        total={dados.totalVagas}
        erro={dados.erroVagas}
        vazio="Nenhuma vaga aberta agora."
        para="/vagas"
        verTudo="Ver todas as vagas"
      >
        {dados.vagas.map((v) => (
          <CartaoDeVaga key={v.id} vaga={v} />
        ))}
      </Faixa>

      <Faixa
        titulo="Quem está procurando"
        total={dados.totalPessoas}
        erro={dados.erroPessoas}
        vazio="Ninguém cadastrado ainda."
        para="/profissionais"
        verTudo="Ver todos os candidatos"
      >
        {dados.pessoas.map((p) => (
          /* Sem link para a ficha: a ficha tem o contato, e contato exige
             conta. Um cartão que abre uma tela pedindo login seria uma
             porta que promete e não entrega — melhor não ser porta. */
          <div key={p.id} className="ei-vitrine-item ei-vitrine-pessoa">
            {p.photo_url ? (
              <img className="ei-vitrine-foto" src={p.photo_url} alt="" loading="lazy" />
            ) : (
              <span className="ei-vitrine-foto ei-vitrine-foto-vazia" aria-hidden="true">
                {(p.name ?? "?").trim().charAt(0).toUpperCase()}
              </span>
            )}
            {/* ── FOTO E TEXTO LADO A LADO — 07/09 ────────────────────
                A dona: "acho que a foto e as informações têm que ficar
                lado a lado."

                Estavam empilhados: foto em cima, nome e ofício embaixo. O
                cartão ficava alto e estreito, e a foto empurrava o nome
                para fora do olhar de quem passa o dedo rápido. Lado a
                lado, o cartão fica na proporção de uma linha de lista —
                que é o que ele é. */}
            <div className="ei-vitrine-quem">
              <span className="ei-vitrine-titulo">{p.name}</span>
              <span className="ei-vitrine-nota">
                {[p.especialidade ?? p.areas_de_interesse?.[0], p.city]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          </div>
        ))}
      </Faixa>
    </div>
  );
}

/**
 * Um cartão de vaga. O mesmo nas duas prateleiras — a de destaque e a
 * comum —, mudando só o selo.
 *
 * O link vai para a vaga aberta, que JÁ abre sem conta (ela está em
 * `COMPARTILHAVEIS`, porque é o que se manda no WhatsApp). Quem quiser
 * responder é que encontra o login, e encontra dentro da vaga, tendo lido
 * o que está respondendo.
 */
function CartaoDeVaga({ vaga, destaque }: { vaga: VagaDaVitrine; destaque?: boolean }) {
  return (
    <Link
      to={`/vaga-aberta/${vaga.id}`}
      className={`ei-vitrine-item${destaque ? " ei-vitrine-item-destaque" : ""}`}
    >
      {destaque && <span className="ei-vitrine-selo">Destaque</span>}
      <span className="ei-vitrine-titulo">{vaga.title}</span>
      <span className="ei-vitrine-nota">
        {[vaga.empresa, vaga.city].filter(Boolean).join(" · ")}
      </span>
      {salarioEmTexto(vaga) && (
        <span className="ei-vitrine-valor">{salarioEmTexto(vaga)}</span>
      )}
    </Link>
  );
}

/**
 * Os três números da capa: vagas abertas, gente procurando, já contratadas.
 *
 * ── POR QUE NÚMERO, E NÃO UMA FRASE BONITA ────────────────────────────
 *
 * A dona: "preciso que a primeira tela seja mais bonita. Chamativa."
 *
 * O que chama atenção numa cidade pequena não é adjetivo — é a prova de
 * que tem gente ali. "47" e "3" dizem em dois caracteres o que nenhuma
 * frase de propaganda diz: o app está vivo, e vale a pena criar conta.
 * São os números de VERDADE do banco, lidos na hora; nenhum deles é
 * escrito à mão em lugar nenhum.
 *
 * ── O ZERO NÃO APARECE ────────────────────────────────────────────────
 *
 * Cada número só entra se for maior que zero. "0 já contratadas" é a
 * única frase desta tela capaz de fazer alguém fechar o app — e num
 * começo de operação ela seria verdade por semanas. Esconder o zero não é
 * mentir: é não afirmar nada enquanto não há o que afirmar.
 */
function Numeros({ dados }: { dados: Dados | null }) {
  if (!dados) {
    /* O espaço fica reservado enquanto os números não chegam, para a capa
       não pular de altura no meio da leitura. */
    return <div className="ei-capa-numeros" aria-hidden="true" />;
  }

  /* Rótulos curtos de propósito. "procurando trabalho" quebrava em duas
     linhas enquanto "vagas abertas" ficava numa, e as três colunas saíam
     com alturas diferentes — o mesmo desalinhamento que já foi reprovado
     nas artes. Em três colunas de 96px numa tela de 390, não cabe frase. */
  const itens: { valor: number; rotulo: string }[] = [];
  if (dados.totalVagas > 0)
    itens.push({ valor: dados.totalVagas, rotulo: dados.totalVagas === 1 ? "vaga aberta" : "vagas abertas" });
  if (dados.totalPessoas > 0)
    itens.push({ valor: dados.totalPessoas, rotulo: "candidatos" });
  if (dados.contratados)
    itens.push({ valor: dados.contratados, rotulo: "já contratadas" });

  if (itens.length === 0) return null;

  return (
    <div className="ei-capa-numeros">
      {itens.map((n) => (
        <div key={n.rotulo} className="ei-capa-numero">
          <span className="ei-capa-valor">{n.valor}</span>
          <span className="ei-capa-rotulo">{n.rotulo}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Uma faixa da vitrine: título, contagem, os cartões e o "ver tudo".
 *
 * O total ao lado do título é o que dá tamanho à cidade. "Vagas abertas"
 * sozinho não diz se são três ou trinta — e é essa diferença que decide
 * se quem chegou cria a conta.
 */
function Faixa({
  titulo,
  total,
  erro,
  vazio,
  para,
  verTudo,
  children,
}: {
  titulo: string;
  total: number;
  erro: string | null;
  vazio: string;
  /* Opcionais: a prateleira de destaque não leva a lugar nenhum próprio.
     A de vagas, logo abaixo, já vai para `/vagas` — e dois links iguais a
     dois dedos de distância fazem a pessoa achar que são destinos
     diferentes. */
  para?: string;
  verTudo?: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="ei-vitrine-faixa">
      <div className="ei-vitrine-cabeca">
        <h2 className="ei-vitrine-secao">{titulo}</h2>
        {total > 0 && <span className="ei-vitrine-conta">{total}</span>}
      </div>

      {/* O erro vem ANTES do "nenhum": erro nunca pode virar lista vazia.
          "Ninguém cadastrado ainda" e "a consulta falhou" são a mesma tela
          e coisas opostas, e a primeira faria a dona achar que a cidade
          está deserta. É a regra do CLAUDE.md. */}
      {erro ? (
        <p className="ei-vitrine-erro" role="alert">
          {erro}
        </p>
      ) : children.length === 0 ? (
        /* ── CLASSE PRÓPRIA, E NÃO A DO CARTÃO — 07/09 ───────────────
           A dona: "Nenhuma vaga aberta agora. Desalinhado na tela de
           início."

           Estava com `ei-vitrine-nota`, que é a linhinha cinza de DENTRO
           do cartão — e lá dentro ela não precisa de recuo nenhum, porque
           o cartão já tem o seu. Solta na prateleira, ela nascia 18px à
           esquerda do título logo acima: medido, título em 33px e esta
           linha em 15px.

           O engano é fácil de repetir, porque a cor e o tamanho estavam
           certos; só o lugar estava errado. Daí a classe separada, com o
           recuo escrito nela. */
        <p className="ei-vitrine-nenhum">{vazio}</p>
      ) : (
        <>
          {/* Rola de lado, como as prateleiras do resto do app. Numa tela
              de 390px, seis cartões empilhados empurrariam a segunda faixa
              para fora da vista — e a segunda faixa é metade do pedido. */}
          <div className="ei-vitrine-trilho">{children}</div>
          {para && verTudo && (
            <Link to={para} className="ei-vitrine-tudo">
              {verTudo} →
            </Link>
          )}
        </>
      )}
    </section>
  );
}
