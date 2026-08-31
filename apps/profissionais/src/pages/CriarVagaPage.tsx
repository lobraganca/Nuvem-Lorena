import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  obterMinhaEmpresa,
  criarVaga,
  abrirOnda,
  calcularOndas,
  situacaoDoPlano,
  anunciarVaga,
} from "../lib/company";
import {
  CATEGORIES,
  DEFAULT_CITY,
  DEFAULT_UF,
  DIAS_ANUNCIO_VAGA,
  ONDAS,
  ONDAS_POR_VAGA,
  type JobListing,
  type WaveNumber,
  type WorkModality,
} from "../types/domain";
import { podeVender } from "../lib/plataforma";
import { mensagemDeErro } from "../lib/erros";
import { Callout, Pagina } from "../components/ei/Pagina";

/* `anunciada_ate` fica de fora: ela é gravada depois que a vaga existe, por
   `anunciarVaga`. O plano é que dá direito ao anúncio — quem não tem plano
   não chega nem a criar a vaga (migration 0073). */
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

  /* A segunda onda desta vaga, se a empresa quiser usá-la já.
     ────────────────────────────────────────────────────────
     Cada vaga tem direito a `ONDAS_POR_VAGA` ondas; a 1 sai na criação, e
     sobra uma. `null` = guardar para depois, que é o padrão: avisar mais
     gente do que o necessário é a única decisão desta tela que não dá para
     desfazer, então ela é sempre um ato, nunca um esquecimento. */
  const [ondaExtra, setOndaExtra] = useState<2 | 3 | null>(null);

  /* O anúncio vem junto do plano, então nasce MARCADO: quem pagou para
     publicar quer ser encontrado, e desmarcado por padrão ele viraria um
     benefício que a maioria nunca liga. Continua sendo escolha porque nem
     toda contratação é para se expor — substituir alguém que ainda está na
     empresa é o caso de avisar só quem encaixa, sem cartaz. */
  const [anunciar, setAnunciar] = useState(true);

  const [plano, setPlano] = useState<{
    limite: number;
    abertas: number;
    temPlano: boolean;
    cabeMais: boolean;
  } | null>(null);
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

      /* O plano é buscado AQUI, ao abrir a tela, e não no fim: a empresa
         precisa saber que o plano dela já está cheio antes de escrever a
         vaga inteira, não depois de confirmar. */
      situacaoDoPlano(empresa.id)
        .then(setPlano)
        .catch(() => {
          /* Sem a resposta, a tela continua funcionando — quem realmente
             recusa o anúncio é o banco. Deixar `null` faz o aviso sumir em
             vez de mostrar "0 de 1", que seria um número inventado no lugar
             de um que não se sabe. */
          setPlano(null);
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
      if (ondaExtra) await abrirOnda(vaga, ondaExtra);

      /* O anúncio depois do disparo, e não antes: se a gravação do anúncio
         falhar, a vaga já saiu para as pessoas — que é o que a empresa veio
         fazer. Na ordem inversa, um erro no disparo deixaria uma vaga
         anunciada que nunca avisou ninguém.

         Sem `podeVender()` aqui: o anúncio deixou de ser compra à parte e
         virou parte do plano, então marcá-lo dentro do app da loja não é
         venda nenhuma — é usar o que já foi pago. */
      if (anunciar) {
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

  /* Sem plano, o formulário nem abre.
     ─────────────────────────────────
     Deixar escrever a vaga inteira e recusar no fim é a pior forma de
     cobrar: a pessoa fez o trabalho, se animou, e leva um "não" na hora de
     confirmar. Aqui ela sabe antes de digitar a primeira letra.

     E a tela diz o que ela JÁ PODE fazer sem pagar — procurar e falar com
     os profissionais um a um. Sem essa frase, "assine para publicar" soa
     como se o app inteiro estivesse trancado, e ela vai embora sem
     descobrir a busca, que é de graça e resolve o problema de muita gente. */
  if (plano && !plano.temPlano) {
    return (
      /* No visual do resto do app, e não no antigo.
         ───────────────────────────────────────────
         Estas duas telas de bloqueio tinham ficado para trás no redesenho:
         `container`, `card`, botão laranja cheio — o único laranja gritante
         que sobrou no app. E é a tela que a empresa vê quando leva um
         "não": justo nela o app parecia outro produto, o que faz um
         bloqueio comum parecer defeito.

         O caminho de saída também é o mesmo: cabeçalho de página, aviso e
         a fila de ações. Nada aqui é decoração — o que muda é a empresa
         reconhecer onde está. */
      <div className="ei">
        <div className="ei-tela">
          <Pagina icone="🔒" titulo="Para publicar vaga, precisa de um plano" ondeEstou="Empresa">
            <p className="ei-corpo ei-margem">
              Com o plano, sua vaga é avisada por SMS para quem faz aquele serviço na
              cidade, e as pessoas interessadas chegam até você.
            </p>
          </Pagina>

          <Callout emoji="✅">
            <strong>Sem plano você já pode, agora:</strong> ver e procurar todos os
            profissionais de Itabirito, e falar com cada um direto, pelo telefone que
            está no cadastro. É grátis e não precisa nem de conta — o plano serve para
            não ter que chamar um por um.
          </Callout>

          <div className="ei-margem" style={{ display: "grid", gap: 10, marginTop: 18 }}>
            {podeVender() && (
              <button
                type="button"
                className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
                onClick={() => navegar("/planos-empresa")}
              >
                Ver os planos
              </button>
            )}
            <button
              type="button"
              className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
              onClick={() => navegar("/profissionais")}
            >
              Procurar profissionais
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* Plano cheio: mesma ideia, motivo diferente. E o caminho de saída é
     fechar uma vaga, não pagar mais — quem já paga não deve ser empurrado
     para o upgrade antes de saber que basta fechar a que já encheu. */
  if (plano && plano.temPlano && !plano.cabeMais) {
    return (
      <div className="ei">
        <div className="ei-tela">
          {/* O título dizia "Suas vagas já estão todas abertas" — que lido
              rápido soa a elogio, e não a "não dá para abrir mais uma". A
              empresa veio publicar; o título tem que dizer o que houve com
              o que ela veio fazer. */}
          <Pagina icone="📋" titulo="O plano já está cheio" ondeEstou="Empresa">
            <p className="ei-corpo ei-margem">
              Seu plano permite {plano.limite}{" "}
              {plano.limite === 1 ? "vaga aberta" : "vagas abertas"} por vez, e{" "}
              {plano.limite === 1 ? "ela já está no ar" : "todas já estão no ar"}. Feche
              uma que já encheu para abrir outra — ou mude de plano.
            </p>
          </Pagina>

          <div className="ei-margem" style={{ display: "grid", gap: 10, marginTop: 18 }}>
            <button
              type="button"
              className="ei-btn ei-btn-cheio ei-btn-largo ei-btn-alto"
              onClick={() => navegar("/painel-empresa")}
            >
              Ver minhas vagas
            </button>
            {podeVender() && (
              <button
                type="button"
                className="ei-btn ei-btn-contorno ei-btn-largo ei-btn-alto"
                onClick={() => navegar("/planos-empresa")}
              >
                Ver os planos
              </button>
            )}
          </div>
        </div>
      </div>
    );
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
              Cada vaga tem direito a <strong>{ONDAS_POR_VAGA} ondas</strong>. A onda 1
              é avisada ao confirmar; a segunda é sua para usar quando quiser — se
              ninguém responder, você escolhe qual abrir, num toque na tela da vaga.
              Ou já escolhe aqui.
            </p>

            {/* Disparar não depende de plano — qualquer vaga publicada
                avisa as pessoas. O que o plano limita é o ANÚNCIO, e o
                aviso disso mora no bloco do anúncio, mais abaixo. */}

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
                    opacity: onda === 1 || ondaExtra === onda ? 1 : 0.62,
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
                      /* Cada vaga tem direito a 2 ondas, e a 1 já é uma
                         delas — então sobra UMA. São botões de rádio, e não
                         caixinhas: com caixinha a pessoa marca as duas,
                         confirma, e o banco recusa a segunda com um erro
                         que ela não tem como prever. A forma do controle é
                         o que ensina a regra, antes de qualquer texto. */
                      <label style={{ display: "flex", gap: 8, marginTop: 8, fontSize: "0.9em" }}>
                        <input
                          type="radio"
                          name="onda-extra"
                          checked={ondaExtra === onda}
                          disabled={novos === 0}
                          onChange={() => setOndaExtra(onda as 2 | 3)}
                        />
                        <span>
                          {novos === 0
                            ? "Não há mais ninguém nesta onda"
                            : "Usar minha segunda onda nesta, agora"}
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
          {/* O anúncio vem junto do plano — não custa nada a mais.
              Continua sendo escolha porque nem toda contratação é para se
              expor: uma vaga que substitui alguém que ainda está lá é
              exatamente o caso de avisar só quem encaixa, sem cartaz.

              Sem `podeVender()` em volta: não há preço nesta tela, e o que
              a regra da loja proíbe é vender, não escolher. */}
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
                  Além do aviso das ondas, a vaga fica {DIAS_ANUNCIO_VAGA} dias na tela
                  onde as pessoas procuram — quem não recebeu o aviso ainda encontra.
                  Já está no seu plano.
                </p>
              </span>
            </label>
          </div>


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
