import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  obterMinhaEmpresa,
  criarVaga,
  abrirOnda,
  calcularOndas,
  cotaDeDisparos,
  anunciarVaga,
} from "../lib/company";
import {
  CATEGORIES,
  DEFAULT_CITY,
  DEFAULT_UF,
  DIAS_ANUNCIO_VAGA,
  ONDAS,
  precoDoAnuncioDeVaga,
  type JobListing,
  type WaveNumber,
  type WorkModality,
} from "../types/domain";
import { podeVender } from "../lib/plataforma";
import { mensagemDeErro } from "../lib/erros";

/* `anunciada_ate` fica de fora: ela é consequência de um pagamento, não um
   campo do formulário. Quem a grava é `anunciarVaga`, depois da vaga
   existir — e um dia será a Edge Function que confirma o pagamento, porque
   data de validade escrita pelo navegador é data que se estica de graça. */
type FormState = Omit<
  JobListing,
  "id" | "created_at" | "closed_at" | "status" | "anunciada_ate"
>;

const EMPTY_FORM: FormState = {
  company_id: "",
  title: "",
  description: "",
  profession: "",
  specialty: null,
  required_experience: null,
  skills: [],
  salary_range_min: null,
  salary_range_max: null,
  available_immediately: true,
  work_modality: "presencial",
  city: DEFAULT_CITY,
  uf: DEFAULT_UF,
  neighborhood: null,
};

/**
 * Criar uma vaga de trabalho.
 *
 * Dois passos: o formulário e a conferência. Na conferência a tela mostra
 * quantas pessoas cada onda alcançaria — números lidos do banco, não
 * estimados. Uma versão anterior desta tela sorteava os três números com
 * `Math.random()` para "ilustrar", e ilustração com cara de dado é a
 * mentira mais barata que existe: a empresa decidiria disparar olhando um
 * número que não veio de lugar nenhum.
 *
 * Ao confirmar, **só a onda 1 abre**. As outras duas ficam esperando um
 * toque na tela da vaga — ver `ONDAS` e o cabeçalho da migration 0068.
 */
export function CriarVagaPage() {
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [passo, setPasso] = useState<"formulario" | "preview">("formulario");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [conferindo, setConferindo] = useState(false);
  const [ondaPreview, setOndaPreview] = useState<Array<{ onda: WaveNumber; novos: number }>>([]);

  /* Quais ondas saem já. A 1 sempre sai — é o disparo. As outras duas são
     escolha de quem tem pressa e não quer voltar aqui para tocar o botão.
     Desmarcadas por padrão: avisar mais gente do que o necessário é a
     decisão que não dá para desfazer, então ela é sempre um ato, nunca um
     esquecimento. */
  const [ondasExtras, setOndasExtras] = useState<Record<2 | 3, boolean>>({ 2: false, 3: false });

  /* Anunciar custa dinheiro, então nasce desmarcado — e some inteiro dentro
     do app da loja (ver `podeVender`). */
  const [anunciar, setAnunciar] = useState(false);

  const [cota, setCota] = useState<{ usadas: number; restantes: number; teto: number } | null>(null);
  const [empresaConfirmada, setEmpresaConfirmada] = useState(false);

  useEffect(() => {
    if (carregandoConta || !user) return;

    obterMinhaEmpresa(user.id).then((empresa) => {
      if (!empresa) {
        navegar("/cadastro-empresa", { replace: true });
        return;
      }
      setForm((f) => ({
        ...f,
        company_id: empresa.id,
        city: empresa.city,
        uf: empresa.uf,
        neighborhood: empresa.neighborhood,
      }));

      /* O telefone da empresa também precisa estar confirmado. Vale para
         todo mundo, e aqui tem uma razão a mais: quem responde à vaga vai
         procurar essa empresa de volta, e um número não provado do lado de
         quem contrata é onde mora o golpe do falso emprego. */
      setEmpresaConfirmada(empresa.phone_verified);
      if (!empresa.phone_verified) {
        setErro(
          "Confirme o telefone da sua empresa antes de publicar vagas. " +
            "Dá para fazer isso no seu painel, no aviso do topo."
        );
      }

      /* A cota é buscada AQUI, ao abrir a tela, e não no fim: a empresa
         precisa saber que está no último disparo do mês antes de escrever a
         vaga inteira, não depois de confirmar. */
      cotaDeDisparos(empresa.id)
        .then(setCota)
        .catch(() => {
          /* Sem a cota, a tela continua funcionando — quem realmente
             recusa o disparo é o banco. Deixar `null` faz o aviso sumir em
             vez de mostrar "0 de 2", que seria um número inventado no lugar
             de um que não se sabe. */
          setCota(null);
        });
    });
  }, [user, carregandoConta, navegar]);

  async function previsualizarOndas() {
    setErro("");

    if (!form.title.trim()) {
      setErro("Escreva o título da vaga.");
      return;
    }

    if (!form.profession) {
      setErro("Escolha a profissão.");
      return;
    }

    setConferindo(true);
    try {
      /* A vaga ainda não existe no banco — a contagem é feita sobre o que
         está no formulário. Os campos que `calcularOndas` lê (cidade,
         estado, profissão, especialidade) já estão todos preenchidos aqui. */
      const ondas = await calcularOndas(form as JobListing);
      setOndaPreview(ondas.map(({ onda, novos }) => ({ onda, novos })));
      setPasso("preview");
    } catch (err) {
      /* Contagem que falha não é contagem zero. Mostrar "0 profissionais"
         quando o banco recusou a consulta faria a empresa concluir que não
         há ninguém na cidade — e desistir de uma vaga que teria enchido. */
      setErro(mensagemDeErro(err, "Não foi possível contar os profissionais."));
    } finally {
      setConferindo(false);
    }
  }

  async function confirmarEAbrirPrimeiraOnda() {
    /* A trava de verdade, e não só o aviso lá de cima. Sem esta linha o
       aviso seria decoração: a empresa leria "confirme o telefone" e
       publicaria a vaga do mesmo jeito, tocando o botão de baixo.

       Quem recusa de verdade é o banco — a policy de INSERT em
       `job_listings` exige `phone_verified` (migration 0071). Esta linha
       existe para a empresa ler uma frase que explica, em vez de um erro de
       permissão que não diz o que fazer. */
    if (!empresaConfirmada) {
      setErro(
        "Confirme o telefone da sua empresa antes de publicar. " +
          "É por ele que os profissionais vão te procurar de volta."
      );
      return;
    }

    setSalvando(true);
    setErro("");

    try {
      const vaga = await criarVaga({ ...form, status: "active" });

      /* A onda 1 sempre sai — é o disparo. As outras só se a empresa
         marcou, e em ordem: a 2 antes da 3, porque cada onda desconta quem
         as anteriores já alcançaram, e fora de ordem a conta sai errada. */
      await abrirOnda(vaga, 1);
      if (ondasExtras[2]) await abrirOnda(vaga, 2);
      if (ondasExtras[3]) await abrirOnda(vaga, 3);

      /* O anúncio depois do disparo, e não antes: se a gravação do anúncio
         falhar, a vaga já saiu para as pessoas — que é o que a empresa veio
         fazer. Na ordem inversa, um erro no disparo deixaria uma vaga
         anunciada que nunca avisou ninguém. */
      if (anunciar && podeVender()) {
        await anunciarVaga(vaga.id);
      }

      navegar(`/vaga/${vaga.id}`, { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível criar a vaga."));
      setSalvando(false);
    }
  }

  if (carregandoConta) {
    return <div className="container" style={{ paddingTop: 48 }}>
      <span className="muted">Carregando…</span>
    </div>;
  }

  return (
    <div className="container criar-vaga" style={{ paddingTop: 24, paddingBottom: 24 }}>
      <h1>Criar vaga</h1>

      {erro && (
        <div style={{ color: "var(--color-danger)", marginBottom: 16, padding: 12, backgroundColor: "var(--color-danger-light)", borderRadius: 8 }}>
          {erro}
        </div>
      )}

      {passo === "formulario" ? (
        // FORMULÁRIO
        <div style={{ display: "grid", gap: 16 }}>
          <div>
            <label htmlFor="title">Qual profissional você procura? *</label>
            <input
              id="title"
              type="text"
              placeholder="Ex: Vendedor, Recepcionista, Eletricista"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="profession">Profissão/Categoria *</label>
            <select
              id="profession"
              value={form.profession}
              onChange={(e) => setForm((f) => ({ ...f, profession: e.target.value }))}
            >
              <option value="">Escolha uma profissão</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="specialty">Especialidade (opcional)</label>
            <input
              id="specialty"
              type="text"
              placeholder="Ex: Vendas em loja de roupas"
              value={form.specialty || ""}
              onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value || null }))}
            />
          </div>

          <div>
            <label htmlFor="description">Descrição da vaga</label>
            <textarea
              id="description"
              placeholder="Detalhes sobre a vaga, responsabilidades, etc"
              rows={4}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <label htmlFor="required_experience">Experiência requerida</label>
            <select
              id="required_experience"
              value={form.required_experience || ""}
              onChange={(e) => setForm((f) => ({ ...f, required_experience: e.target.value || null }))}
            >
              <option value="">Qualquer experiência</option>
              <option value="0-2 anos">0-2 anos</option>
              <option value="2-5 anos">2-5 anos</option>
              <option value="5+ anos">5+ anos</option>
            </select>
          </div>

          <div>
            <label htmlFor="work_modality">Modalidade de trabalho</label>
            <select
              id="work_modality"
              value={form.work_modality}
              onChange={(e) => setForm((f) => ({ ...f, work_modality: e.target.value as WorkModality }))}
            >
              <option value="presencial">Presencial</option>
              <option value="remoto">Remoto</option>
              <option value="hibrido">Híbrido</option>
            </select>
          </div>

          <div>
            <label>
              <input
                type="checkbox"
                checked={form.available_immediately}
                onChange={(e) => setForm((f) => ({ ...f, available_immediately: e.target.checked }))}
              />
              {" "}Disponibilidade imediata
            </label>
          </div>

          {/* Não há campo de raio em quilômetros, e não é esquecimento: o
              cadastro de profissional não guarda latitude nem longitude, e
              Itabirito inteira se atravessa em dez minutos. Ver `ONDAS` em
              types/domain.ts. */}

          <div>
            <label htmlFor="salary_min">Faixa salarial mínima (R$)</label>
            <input
              id="salary_min"
              type="number"
              placeholder="Deixar em branco = não informar"
              value={form.salary_range_min ? form.salary_range_min / 100 : ""}
              onChange={(e) => setForm((f) => ({ ...f, salary_range_min: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null }))}
            />
          </div>

          <div>
            <label htmlFor="salary_max">Faixa salarial máxima (R$)</label>
            <input
              id="salary_max"
              type="number"
              placeholder="Deixar em branco = não informar"
              value={form.salary_range_max ? form.salary_range_max / 100 : ""}
              onChange={(e) => setForm((f) => ({ ...f, salary_range_max: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : null }))}
            />
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="btn btn-secondary"
              onClick={() => navegar("/painel-empresa")}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={previsualizarOndas}
              disabled={conferindo}
            >
              {conferindo ? "Contando…" : "Ver quem esta vaga alcança"}
            </button>
          </div>
        </div>
      ) : (
        // PREVIEW DAS ONDAS
        <div style={{ display: "grid", gap: 20 }}>
          <div className="card" style={{ padding: 16 }}>
            <h2 style={{ margin: "0 0 8px 0" }}>Quem esta vaga alcança</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              A <strong>onda 1</strong> é avisada ao confirmar. As outras duas
              ficam esperando — se ninguém responder, você abre a próxima num
              toque, na tela da vaga. Ou marque aqui para avisar já.
            </p>

            {/* O aviso da cota fica no topo da conferência, junto do que ela
                custa. Descobrir no fim que o mês acabou é o pior lugar
                possível: a vaga já está escrita. */}
            {cota && (
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "0.9em",
                  color: cota.restantes === 0 ? "var(--color-danger)" : undefined,
                }}
              >
                {cota.restantes === 0 ? (
                  <>
                    <strong>Você já usou os {cota.teto} disparos deste mês.</strong> A vaga
                    pode ser criada, mas só volta a avisar gente no mês que vem.
                  </>
                ) : (
                  <>
                    Este é o disparo <strong>{cota.usadas + 1} de {cota.teto}</strong> do mês.
                    {cota.restantes === 1 && " Depois dele, o mês acaba."}
                  </>
                )}
              </p>
            )}

            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {ondaPreview.map(({ onda, novos }) => (
                <div
                  key={onda}
                  style={{
                    padding: 12,
                    backgroundColor: "var(--color-bg-input)",
                    borderRadius: 8,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    /* As ondas que não vão sair ficam mais apagadas — sem
                       isso a tela parecia prometer três disparos. Marcar a
                       caixinha acende a onda, que é a confirmação visual de
                       que ela passou a valer. */
                    opacity: onda === 1 || ondasExtras[onda as 2 | 3] ? 1 : 0.62,
                  }}
                >
                  <div>
                    <strong>
                      Onda {onda} — {ONDAS[onda].titulo}
                    </strong>
                    <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.9em" }}>
                      {ONDAS[onda].explicacao}
                    </p>

                    {/* A onda 1 não tem escolha — ela É o disparo. As
                        outras duas ganham caixinha aqui, para quem tem
                        pressa não precisar voltar à tela da vaga depois.
                        Continuam desmarcadas por padrão: avisar gente
                        demais é a única coisa nesta tela que não dá para
                        desfazer. */}
                    {onda === 1 ? (
                      <p style={{ margin: "6px 0 0", fontSize: "0.9em" }}>Sai agora.</p>
                    ) : (
                      <label style={{ display: "flex", gap: 8, marginTop: 8, fontSize: "0.9em" }}>
                        <input
                          type="checkbox"
                          checked={ondasExtras[onda as 2 | 3]}
                          disabled={novos === 0}
                          onChange={(e) =>
                            setOndasExtras((o) => ({ ...o, [onda]: e.target.checked }))
                          }
                        />
                        <span>
                          {novos === 0
                            ? "Não há mais ninguém nesta onda"
                            : "Avisar esta onda junto, agora"}
                        </span>
                      </label>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "1.5em", fontWeight: "bold", color: "var(--color-primary)" }}>
                      {novos}
                    </div>
                    <div className="muted" style={{ fontSize: "0.9em" }}>
                      {novos === 1 ? "pessoa" : "pessoas"}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cada onda conta só quem as anteriores não alcançaram, então
                somar os três números dá o total de verdade. Sem o desconto,
                "12, 30, 45" para 45 pessoas seria lido como 87. */}
            <p className="muted" style={{ marginTop: 16, fontSize: "0.9em" }}>
              No total, {ondaPreview.reduce((soma, o) => soma + o.novos, 0)} pessoas em{" "}
              {form.city} podem ser avisadas — nenhuma duas vezes.
            </p>

            {ondaPreview[0]?.novos === 0 && (
              <p style={{ marginTop: 12, fontSize: "0.9em" }}>
                Ninguém com esse encaixe exato hoje. A vaga pode ser criada do
                mesmo jeito — e a onda 2 provavelmente tem gente.
              </p>
            )}
          </div>

          {/* Anunciar a vaga na área de anúncios.
              ─────────────────────────────────────
              Bloco separado das ondas de propósito: são coisas diferentes.
              A onda EMPURRA a vaga para quem encaixa; o anúncio a deixa
              PARADA onde quem está procurando passa. Uma alcança quem não
              estava olhando, a outra atende quem está.

              Some inteiro dentro do app da loja. A Google não permite
              vender bem digital por fora da cobrança dela, e "vender por
              fora" inclui mostrar o preço aqui. Some inteiro, e não
              desabilitado: um bloco cinza com preço continua sendo uma
              oferta. E em lugar nenhum aparece "assine no site" — convidar
              a pagar fora é a mesma violação que vender. */}
          {podeVender() && (
            <div className="card" style={{ padding: 16 }}>
              <label style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <input
                  type="checkbox"
                  checked={anunciar}
                  style={{ marginTop: 3 }}
                  onChange={(e) => setAnunciar(e.target.checked)}
                />
                <span>
                  <strong>Deixar também na área de anúncios</strong>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.9em" }}>
                    A vaga fica {DIAS_ANUNCIO_VAGA} dias na tela onde as pessoas procuram,
                    além de ser avisada pelas ondas. Quem não recebeu o aviso ainda
                    encontra. <strong>{precoDoAnuncioDeVaga()}</strong>.
                  </p>
                </span>
              </label>
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button
              className="btn btn-secondary"
              onClick={() => setPasso("formulario")}
              disabled={salvando}
            >
              Voltar
            </button>
            <button
              className="btn btn-primary"
              onClick={confirmarEAbrirPrimeiraOnda}
              disabled={salvando}
            >
              {salvando ? "Criando…" : "Criar vaga e avisar a onda 1"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
