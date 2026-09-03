import { MAX_EXPERIENCIAS } from "../types/domain";

/** Uma experiência ainda sendo preenchida: sem id, porque pode não existir no banco. */
export type ExperienciaEmEdicao = {
  id?: string;
  cargo: string;
  onde: string;
  periodo: string;
};

export const EXPERIENCIA_VAZIA: ExperienciaEmEdicao = { cargo: "", onde: "", periodo: "" };

/**
 * "Onde você já trabalhou".
 *
 * Três campos por experiência, e a escolha foi deliberada contra o formato
 * de currículo. Mês e ano de início e fim, cidade, descrição do que fazia —
 * tudo isso é mais completo e fica VAZIO: quem preenche do celular, entre
 * uma coisa e outra, desiste na terceira caixa de texto. Experiência não
 * preenchida não ajuda ninguém, e um formulário longo é a forma mais
 * educada de não receber resposta.
 *
 * "Ajudante de pedreiro / Construções Silva / 2 anos" cabe numa linha, se
 * escreve em quinze segundos, e é o que uma empresa da cidade quer saber.
 *
 * Só o cargo é obrigatório. Quem trabalhou por conta não tem "onde", e quem
 * não lembra o tempo não deve ser obrigado a inventar um — período é texto
 * livre justamente por isso: "uns 3 anos" é uma resposta honesta que
 * nenhum seletor de data aceita.
 */
export function SeletorDeExperiencias({
  experiencias,
  onChange,
}: {
  experiencias: ExperienciaEmEdicao[];
  onChange: (lista: ExperienciaEmEdicao[]) => void;
}) {
  const cheio = experiencias.length >= MAX_EXPERIENCIAS;

  function mudar(i: number, campo: keyof ExperienciaEmEdicao, valor: string) {
    onChange(experiencias.map((e, j) => (j === i ? { ...e, [campo]: valor } : e)));
  }

  function tirar(i: number) {
    onChange(experiencias.filter((_, j) => j !== i));
  }

  return (
    <div className="experiencias">
      {experiencias.map((exp, i) => (
        <div key={exp.id ?? `nova-${i}`} className="experiencia-item">
          <div className="experiencia-cabecalho">
            <span className="muted">{i + 1}ª experiência</span>
            <button
              type="button"
              className="servico-tirar"
              onClick={() => tirar(i)}
              aria-label={`Tirar a ${i + 1}ª experiência`}
            >
              ✕
            </button>
          </div>

          {/* O cargo vem primeiro e sozinho na linha: é o único obrigatório
              e o que a empresa lê primeiro. */}
          {/* ── RÓTULO VISÍVEL, E NÃO EXEMPLO DENTRO DO CAMPO — 03/09 ──
              A dona: "tire todos os exemplos de dentro dos campos do app".
              Aqui o texto de dentro era a ÚNICA identificação dos três
              campos: some ao começar a digitar, e quem parasse no meio
              voltava para três caixas em branco sem nome. */}
          <label className="ei-campo-rotulo" htmlFor={`exp-cargo-${i}`}>
            O que você fazia
          </label>
          <input
            id={`exp-cargo-${i}`}
            value={exp.cargo}
            maxLength={60}
            onChange={(e) => mudar(i, "cargo", e.target.value)}
          />

          {/* Os dois opcionais dividem a linha: juntos eles ocupam menos
              tela e param de parecer duas perguntas novas. */}
          <div className="experiencia-linha">
            <div>
              <label className="ei-campo-rotulo" htmlFor={`exp-onde-${i}`}>
                Onde (opcional)
              </label>
              <input
                id={`exp-onde-${i}`}
                value={exp.onde}
                maxLength={60}
                onChange={(e) => mudar(i, "onde", e.target.value)}
              />
            </div>
            <div>
              <label className="ei-campo-rotulo" htmlFor={`exp-tempo-${i}`}>
                Quanto tempo (opcional)
              </label>
              <input
                id={`exp-tempo-${i}`}
                value={exp.periodo}
                maxLength={30}
                onChange={(e) => mudar(i, "periodo", e.target.value)}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        className="btn-adicionar-servico"
        disabled={cheio}
        onClick={() => onChange([...experiencias, { ...EXPERIENCIA_VAZIA }])}
      >
        <span className="mais" aria-hidden="true">
          +
        </span>
        {experiencias.length === 0 ? "Contar onde já trabalhei" : "Acrescentar outra"}
      </button>

      {cheio && (
        <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
          {MAX_EXPERIENCIAS} experiências é o limite. As mais recentes contam mais.
        </p>
      )}
    </div>
  );
}
