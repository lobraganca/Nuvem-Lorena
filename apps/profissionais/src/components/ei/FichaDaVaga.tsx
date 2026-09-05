import { Prop } from "./Pagina";
import {
  nomeDoContrato,
  nomeDaJornada,
  salarioEmTexto,
  type JobListing,
} from "../../types/domain";

/**
 * A ficha da vaga: tudo o que a empresa preencheu, em cartões por assunto.
 *
 * ── Por que virou componente — 05/09 ──────────────────────────────────
 *
 * A dona, sobre a tela da vaga do lado da EMPRESA: "essa tela está bem
 * quebrada. Confusa e tem itens repetidos. Ajuste para que tenha todas as
 * informações e que seja bem intuitivo de mexer."
 *
 * "Todas as informações" era o buraco maior, e não a repetição: a tela da
 * empresa mostrava cinco linhas (ofício, jeito, experiência, salário, data)
 * e mais nada. Benefícios, horário, escala, tipo de contratação,
 * escolaridade, CNH, idiomas, prazo — tudo o que ela tinha acabado de
 * preencher no formulário — não aparecia em lugar nenhum. Para conferir a
 * própria vaga, ela teria de abrir a versão pública.
 *
 * Duas telas mostrando a mesma vaga com fichas diferentes é como isso
 * acontece: uma recebe um campo novo e a outra não, e ninguém percebe até
 * alguém reclamar. Agora é uma ficha só, nas duas.
 *
 * ── O desenho ─────────────────────────────────────────────────────────
 *
 * As seções são as MESMAS do formulário que a empresa preencheu — dinheiro,
 * horário e local, requisitos, datas. Duas telas com a mesma ordem se leem
 * sem reaprender, e é a ordem em que a própria empresa pensou a vaga.
 *
 * Cada seção só existe quando tem alguma linha: uma ficha cheia de "não
 * informado" não informa mais que uma ficha curta — só faz a empresa
 * parecer descuidada. A exceção é o SALÁRIO, que aparece ausente dizendo
 * que está ausente, porque escondê-lo não o torna menos ausente: torna a
 * vaga mais suspeita.
 */
export function FichaDaVaga({
  vaga,
  comDescricao = false,
}: {
  vaga: JobListing;
  /**
   * Inclui o texto que a empresa escreveu sobre a vaga.
   *
   * Ligado só na tela da EMPRESA. Na tela pública essa descrição já vem
   * no cartão de cima, junto do título e dos selos — ali ela é a primeira
   * coisa que quem procura emprego lê, e repeti-la aqui embaixo seria o
   * mesmo texto duas vezes na mesma rolagem.
   */
  comDescricao?: boolean;
}) {
  const salario = salarioEmTexto(vaga);
  const contrato = nomeDoContrato(vaga.tipo_contrato);
  const jornada = nomeDaJornada(vaga.jornada);

  return (
    <>
      {comDescricao && vaga.description?.trim() && (
        <section className="ei-ficha">
          {/* "O que a vaga diz" logo abaixo do título de seção "A vaga"
              eram dois cabeçalhos com a mesma palavra, um colado no
              outro. Este cartão só existe do lado da empresa, então o
              título pode falar com ela: é o texto que ELA escreveu. */}
          <h2 className="ei-ficha-titulo">O texto que você escreveu</h2>
          {/* `pre-line` guarda as quebras que a empresa escreveu: uma
              lista de tarefas em linhas vira parágrafo corrido sem
              isso. */}
          <p className="ei-corpo" style={{ whiteSpace: "pre-line", margin: 0 }}>
            {vaga.description}
          </p>
        </section>
      )}

  {/* ── 3. A FICHA, EM SEÇÕES — 04/09 ─────────────────────────
      A dona: "depois todos os dados que a vaga teve de preenchimento
      pelo dono, separado por seções."

      Era uma lista só, com o título "Especificações", empilhando
      catorze linhas de assuntos diferentes: salário, horário, CNH,
      idiomas, benefícios. Quem procurava uma coisa lia todas.

      As seções são as MESMAS do formulário que a empresa preencheu —
      dinheiro, horário e local, requisitos, datas. Duas telas com a
      mesma ordem se leem sem reaprender, e é a ordem em que a
      própria empresa pensou a vaga.

      Cada seção só existe quando tem alguma linha: uma ficha cheia
      de "não informado" não informa mais que uma ficha curta — só faz
      a empresa parecer descuidada. A exceção é o SALÁRIO, que
      aparece ausente dizendo que está ausente, porque escondê-lo não
      o torna menos ausente: torna a vaga mais suspeita. */}
  <section className="ei-ficha">
    <h2 className="ei-ficha-titulo">Salário e benefícios</h2>
  <div className="ei-props">
    <Prop rotulo="Salário">
      {salario ?? <span className="ei-apoio">A empresa não informou</span>}
    </Prop>
    {vaga.comissao && <Prop rotulo="Comissão">{vaga.comissao}</Prop>}
    {vaga.beneficios?.length > 0 && (
      <Prop rotulo="Benefícios">
        <span className="ei-chips">
          {vaga.beneficios.map((b) => (
            <span key={b} className="ei-selo ei-selo-verde">
              {b}
            </span>
          ))}
        </span>
      </Prop>
    )}
    {vaga.outros_beneficios && (
      <Prop rotulo="Também oferece">{vaga.outros_beneficios}</Prop>
    )}
  </div>
      </section>

  <section className="ei-ficha">
    <h2 className="ei-ficha-titulo">Horário e local</h2>
  <div className="ei-props">
    <Prop rotulo="Contratação">
      {contrato ?? <span className="ei-apoio">A empresa não informou</span>}
    </Prop>
    <Prop rotulo="Horário">
      {jornada ?? <span className="ei-apoio">A empresa não informou</span>}
    </Prop>
    {vaga.horario && <Prop rotulo="Que horas">{vaga.horario}</Prop>}
    {vaga.escala && <Prop rotulo="Escala">{vaga.escala}</Prop>}
    {/* O JEITO de trabalhar, e não o endereço: o endereço já está
        embaixo do nome da empresa, lá em cima. O que falta saber
        aqui é se a pessoa vai até lá todo dia. */}
    <Prop rotulo="Trabalho">
      {vaga.work_modality === "remoto"
        ? "De casa"
        : vaga.work_modality === "hibrido"
          ? "Parte no local, parte de casa"
          : "No local da empresa"}
    </Prop>
    {vaga.exige_viagem && <Prop rotulo="Viagem">A vaga exige viajar</Prop>}
    {vaga.aceita_outras_cidades === false && (
      <Prop rotulo="De onde">Só quem mora em {vaga.city}</Prop>
    )}
  </div>
      </section>

  <section className="ei-ficha">
    <h2 className="ei-ficha-titulo">O que a vaga pede</h2>
  <div className="ei-props">
    <Prop rotulo="Experiência">
      {vaga.required_experience || "Não precisa de experiência"}
    </Prop>
    {vaga.escolaridade_minima && (
      <Prop rotulo="Escolaridade">{nomeDaEscolaridade(vaga.escolaridade_minima)}</Prop>
    )}
    {vaga.curso_especifico && <Prop rotulo="Curso">{vaga.curso_especifico}</Prop>}
    {vaga.cnh_exigida && (
      <Prop rotulo="CNH">
        {vaga.cnh_categorias.length > 0
          ? `Categoria ${vaga.cnh_categorias.join(", ")}`
          : "Precisa ter"}
      </Prop>
    )}
    {vaga.idiomas?.length > 0 && (
      <Prop rotulo="Idiomas">{vaga.idiomas.join(", ")}</Prop>
    )}
  </div>
      </section>

  {/* As datas ficam por último e juntas: são as duas linhas que a
      pessoa confere DEPOIS de decidir que quer — e "responder até" é
      o que faz responder hoje em vez de deixar para depois, que é
      como se perde uma vaga. */}
  {(vaga.data_inicio || vaga.prazo_candidatura) && (
    <>
      <section className="ei-ficha">
        <h2 className="ei-ficha-titulo">Datas</h2>
      <div className="ei-props">
        {vaga.data_inicio && (
          <Prop rotulo="Começa em">
            {new Date(`${vaga.data_inicio}T12:00:00`).toLocaleDateString("pt-BR")}
          </Prop>
        )}
        {vaga.prazo_candidatura && (
          <Prop rotulo="Responder até">
            {new Date(`${vaga.prazo_candidatura}T12:00:00`).toLocaleDateString("pt-BR")}
          </Prop>
        )}
      </div>
    </section>
    </>
  )}

  {/* As informações complementares vêm DEPOIS da ficha, e como
      parágrafo: é texto corrido escrito pela empresa, e espremê-lo
      numa linha de "rótulo à esquerda, valor à direita" cortaria a
      frase no meio. */}
  {vaga.observacoes?.trim() && (
    <>
      <section className="ei-ficha">
        <h2 className="ei-ficha-titulo">Mais sobre a vaga</h2>
        <p className="ei-corpo" style={{ whiteSpace: "pre-line", margin: 0 }}>
          {vaga.observacoes}
        </p>
      </section>
    </>
  )}
    </>
  );
}

/** "Ensino médio", "Superior" — o nome de escolaridade como se lê. */
function nomeDaEscolaridade(v: string): string {
  const nomes: Record<string, string> = {
    fundamental: "Ensino fundamental",
    medio: "Ensino médio",
    tecnico: "Técnico",
    superior: "Superior",
    pos: "Pós-graduação",
    mestrado: "Mestrado",
    doutorado: "Doutorado",
  };
  return nomes[v] ?? v;
}
