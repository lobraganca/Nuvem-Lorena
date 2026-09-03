import { Link, useSearchParams } from "react-router-dom";
import { useTituloDaPagina } from "../../lib/tituloDaPagina";

/**
 * "Deu certo" — a tela que confirma que o cadastro foi gravado.
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "ao salvar um cadastro, tanto de empresa, profissional e vaga,
 * abrir uma nova tela falando que o cadastro foi realizado com sucesso e
 * ter a opção de levar a pessoa para as telas para verificar as vagas ou
 * candidatos."
 *
 * ── POR QUE UMA TELA, E NÃO UM AVISINHO ───────────────────────────────
 *
 * Antes, salvar levava direto para a tela seguinte — o painel, a vaga —
 * sem dizer nada. Para quem escreveu vinte campos num celular, isso é
 * ambíguo: a tela mudou, mas mudou porque salvou ou porque deu erro e
 * voltou? Um aviso que some em três segundos não resolve, porque some
 * justamente enquanto a pessoa ainda está lendo.
 *
 * E tem a segunda metade do pedido, que é a mais importante: DEPOIS de
 * cadastrar, ninguém sabe o que fazer. A pessoa acabou de escrever a vaga
 * e não sabe que existe uma lista de gente esperando; acabou de fazer o
 * cadastro e não sabe que as vagas já estão chegando. Esta tela é o lugar
 * de dizer isso — com botão, e não com texto.
 *
 * ── UMA TELA PARA OS TRÊS CASOS ───────────────────────────────────────
 *
 * `?tipo=` diz qual cadastro foi salvo, e daí saem o título e os dois
 * caminhos. Uma tela para cada seria três telas quase iguais que um dia
 * divergem — e a terceira esquece um botão.
 *
 * Os caminhos são sempre DOIS: o principal (o que a pessoa foi fazer) e o
 * outro que ela provavelmente não sabe que existe. Nunca um só: com um
 * botão, a tela vira um "OK" com passo a mais.
 */
type Caso = {
  titulo: string;
  frase: string;
  principal: { para: string; texto: string };
  outro: { para: string; texto: string };
};

const CASOS: Record<string, Caso> = {
  vaga: {
    titulo: "Vaga publicada",
    frase:
      "Ela já está no ar e o aviso saiu para quem faz esse serviço na cidade. Quem se interessar aparece na tela da vaga.",
    principal: { para: "/painel-empresa", texto: "Ver minhas vagas" },
    outro: { para: "/profissionais", texto: "Ver o banco de talentos" },
  },
  empresa: {
    titulo: "Empresa cadastrada",
    frase:
      "Agora dá para publicar vaga por ela. Enquanto isso, o banco de talentos mostra quem está procurando trabalho na cidade — e ele é de graça.",
    principal: { para: "/criar-vaga", texto: "Publicar uma vaga" },
    outro: { para: "/profissionais", texto: "Ver o banco de talentos" },
  },
  profissional: {
    titulo: "Cadastro salvo",
    frase:
      "As vagas do seu ofício passam a chegar aqui, e as empresas conseguem te achar pelo telefone confirmado.",
    principal: { para: "/vagas-para-mim", texto: "Ver vagas para mim" },
    outro: { para: "/vagas", texto: "Ver todas as vagas da cidade" },
  },
};

export function ProntoPage() {
  const [busca] = useSearchParams();
  /* Sem `tipo` conhecido cai no do profissional, que é o lado de mais
     gente — e nunca numa tela em branco: chegar aqui sem parâmetro é um
     link torto, e mostrar "deu certo" com dois caminhos é melhor que
     mostrar nada. */
  const caso = CASOS[busca.get("tipo") ?? ""] ?? CASOS.profissional;
  useTituloDaPagina(caso.titulo);

  return (
    <div className="ei">
      <div className="ei-tela ei-pronto">
        {/* Sem barra de topo e sem "voltar": voltar daqui é voltar para o
            formulário que acabou de ser salvo, e a pessoa pensaria que
            precisa salvar de novo. */}
        <div className="ei-pronto-meio">
          <span className="ei-pronto-marca" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor"
                 strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12.5l5.5 5.5L20 7" />
            </svg>
          </span>
          <h1 className="ei-pronto-titulo">{caso.titulo}</h1>
          <p className="ei-pronto-frase">{caso.frase}</p>
        </div>

        <div className="ei-pronto-pe">
          <Link className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto" to={caso.principal.para}>
            {caso.principal.texto}
          </Link>
          <Link className="ei-btn ei-btn-contorno ei-btn-largo" to={caso.outro.para}>
            {caso.outro.texto}
          </Link>
        </div>
      </div>
    </div>
  );
}
