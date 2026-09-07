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

  if (carregando) {
    return (
      <p className="ei-vitrine-espera" aria-live="polite">
        Carregando o que tem na cidade…
      </p>
    );
  }

  /* Este erro é o da chamada inteira falhar (sem conexão com o banco, por
     exemplo). Falha de UMA das faixas não chega aqui — ela vive dentro da
     faixa, para a outra continuar aparecendo. */
  if (erro) {
    return (
      <p className="ei-vitrine-erro" role="alert">
        {erro}
      </p>
    );
  }

  if (!dados) return null;

  return (
    <div className="ei-vitrine">
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
