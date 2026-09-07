import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { lerVitrine, type Vitrine as Dados } from "../../lib/vitrine";
import { salarioEmTexto } from "../../types/domain";

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
export function Vitrine() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    lerVitrine()
      .then((d) => vivo && setDados(d))
      .catch((e: unknown) => vivo && setErro(e instanceof Error ? e.message : String(e)))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, []);

  /* A CAPA APARECE ANTES DOS DADOS, sempre.

     Ela é a primeira coisa que a pessoa vê, e não pode piscar: se o
     título só nascesse junto com a consulta, a abertura do site seria
     meio segundo de tela cinza vazia — que é exatamente a impressão que
     esta tela existe para desfazer. Só os NÚMEROS esperam, e eles entram
     no lugar já reservado, sem empurrar nada. */
  const capa = (
    <header className="ei-capa">
      <h1 className="ei-capa-titulo">Itabirito contrata Itabirito</h1>
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
      <div className="ei-capa-portas">
        <Link to="/login?lado=trabalhar" className="ei-capa-porta ei-capa-porta-forte">
          Procuro emprego
        </Link>
        <Link to="/login?lado=contratar" className="ei-capa-porta">
          Quero contratar
        </Link>
      </div>
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
      <Faixa
        titulo="Vagas abertas"
        total={dados.totalVagas}
        erro={dados.erroVagas}
        vazio="Nenhuma vaga aberta agora."
        para="/vagas"
        verTudo="Ver todas as vagas"
      >
        {dados.vagas.map((v) => (
          /* O link vai para a vaga aberta, que JÁ abre sem conta (ela está
             em `COMPARTILHAVEIS`, porque é o que se manda no WhatsApp).
             Quem quiser responder é que encontra o login — e encontra
             dentro da vaga, tendo lido o que está respondendo. */
          <Link key={v.id} to={`/vaga-aberta/${v.id}`} className="ei-vitrine-item">
            <span className="ei-vitrine-titulo">{v.title}</span>
            <span className="ei-vitrine-nota">
              {[v.empresa, v.city].filter(Boolean).join(" · ")}
            </span>
            {salarioEmTexto(v) && (
              <span className="ei-vitrine-valor">{salarioEmTexto(v)}</span>
            )}
          </Link>
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
            <span className="ei-vitrine-titulo">{p.name}</span>
            <span className="ei-vitrine-nota">
              {[p.especialidade ?? p.areas_de_interesse?.[0], p.city]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
        ))}
      </Faixa>
    </div>
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
  para: string;
  verTudo: string;
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
        <p className="ei-vitrine-nota">{vazio}</p>
      ) : (
        <>
          {/* Rola de lado, como as prateleiras do resto do app. Numa tela
              de 390px, seis cartões empilhados empurrariam a segunda faixa
              para fora da vista — e a segunda faixa é metade do pedido. */}
          <div className="ei-vitrine-trilho">{children}</div>
          <Link to={para} className="ei-vitrine-tudo">
            {verTudo} →
          </Link>
        </>
      )}
    </section>
  );
}
