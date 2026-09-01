import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import {
  upsertCompany,
  obterMinhaEmpresa,
  marcarOnboardingCompleto,
  confirmarTelefoneDaEmpresa,
} from "../lib/company";
import { numeroJaConfirmadoNaConta } from "../lib/whatsappVerify";
import { uploadProfessionalPhoto } from "../lib/storage";
import { DEFAULT_CITY, DEFAULT_UF, CITIES, UFS, type Company } from "../types/domain";
import { formatDocument, isValidDocument } from "../lib/documents";
import { formatPhone, isValidPhone } from "../lib/phone";
import { mensagemDeErro } from "../lib/erros";
import { Pagina } from "../components/ei/Pagina";
import { Etapas } from "../components/ei/Etapas";
import { AjustarFoto } from "../components/ei/AjustarFoto";

/* O selo do telefone fica de fora: quem o grava é a função
   `confirmar_telefone_empresa`, no banco, e um campo aqui viraria um valor
   que a tela manda junto no salvamento — que é exatamente o caminho que o
   gatilho da 0071 existe para recusar. */
type FormState = Omit<
  Company,
  | "id"
  | "created_at"
  | "phone_verified"
  | "phone_verified_at"
  /* O plano também sai daqui: ele é consequência de um pagamento, e um
     campo no formulário do cadastro seria um plano que a tela manda junto
     ao salvar o endereço. */
  | "plano"
  | "plano_ate"
  | "plano_recorrente"
>;

const EMPTY: FormState = {
  owner_id: "",
  company_name: "",
  cnpj: "",
  city: DEFAULT_CITY,
  uf: DEFAULT_UF,
  neighborhood: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  photo_url: "",
  responsible_name: "",
  description: "",
};

/* Os nomes vêm do que a empresa RESPONDE em cada passo, não do nome da
   tabela: "Onde fica" diz mais que "Localização", e é assim que a pessoa
   pensaria na pergunta se alguém a fizesse em voz alta. */
const ETAPAS = ["A empresa", "Onde fica", "Contato"];

/**
 * Cadastro de empresa, em etapas.
 *
 * ── POR QUE EM ETAPAS ──────────────────────────────────────────────────
 *
 * Era um formulário só, com treze campos empilhados: logo, nome, CNPJ,
 * responsável, telefone, e-mail, site, descrição, cidade, estado, bairro,
 * endereço. Num celular isso são quatro dobras de rolagem antes do botão
 * de salvar — e a primeira coisa que a empresa via ao querer contratar era
 * uma parede.
 *
 * Dividido, cada tela pede três ou quatro coisas da mesma família e o
 * botão está sempre à vista. É o mesmo desenho que o cadastro do lado do
 * profissional já usava; a dona pediu que os dois ficassem iguais, "em
 * cards por etapas".
 *
 * ── A VALIDAÇÃO MUDOU DE LUGAR JUNTO ───────────────────────────────────
 *
 * Antes tudo era conferido no fim, no clique de salvar: quem errasse o
 * CNPJ na primeira dobra descobria depois de preencher as outras três, e
 * ainda tinha de achar o campo. Agora cada etapa confere o que é dela ao
 * pedir "Continuar" — o erro aparece ao lado do que acabou de ser
 * digitado, que é onde ele significa alguma coisa.
 *
 * Quem JÁ tem empresa cadastrada não vê etapa nenhuma: vê o formulário
 * inteiro, porque aí o objetivo é achar um campo e mudá-lo, não percorrer
 * um caminho.
 */
export function CadastroEmpresaPage() {
  const navegar = useNavigate();
  const { user, loading: carregandoConta } = useAuth();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [carregandoEmpresa, setCarregandoEmpresa] = useState(false);
  /* O estado da confirmação vem do banco e não entra no formulário: quem
     grava esse campo é a função `confirmar_telefone_empresa`, e um valor
     editável aqui seria só um espelho — que sai do lugar no primeiro
     salvamento. */
  const [empresaExistente, setEmpresaExistente] = useState<Company | null>(null);
  const [etapa, setEtapa] = useState(1);
  /** O telefone digitado é o mesmo que a conta já confirmou por SMS. */
  const [foneDaConta, setFoneDaConta] = useState(false);
  /* A imagem escolhida fica esperando o enquadramento: só sobe depois que
     a pessoa disser onde é o corte. */
  const [aEnquadrar, setAEnquadrar] = useState<File | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);

  /** Em etapas só quem está cadastrando agora. Editando, vê tudo. */
  const emEtapas = !empresaExistente;
  const mostra = (n: number) => !emEtapas || etapa === n;

  useEffect(() => {
    if (carregandoConta || !user) return;

    setForm((f) => ({ ...f, owner_id: user.id }));
    setCarregandoEmpresa(true);

    obterMinhaEmpresa(user.id).then((empresa) => {
      if (empresa) {
        setForm(empresa);
        setEmpresaExistente(empresa);
      }
      setCarregandoEmpresa(false);
    });
  }, [user, carregandoConta]);

  /* ── O TELEFONE DO LOGIN JÁ VEM CONFIRMADO ──────────────────────────
     Mesma regra do lado do profissional: quem entrou por SMS já provou
     que o número é dela. Se o telefone comercial for esse mesmo, o selo
     fica verde na hora e o carimbo no banco sai sozinho ao salvar — em
     vez de mandar a empresa confirmar de novo o que acabou de confirmar
     para entrar. Número diferente do da conta continua pedindo
     confirmação, que é o ponto todo do selo. */
  useEffect(() => {
    if (!form.phone) {
      setFoneDaConta(false);
      return;
    }
    let vivo = true;
    numeroJaConfirmadoNaConta(form.phone).then((sim) => {
      if (vivo) setFoneDaConta(sim);
    });
    return () => { vivo = false; };
  }, [form.phone]);

  if (carregandoConta || !user || carregandoEmpresa) {
    return (
      <div className="ei">
        <div className="ei-tela">
          <Pagina titulo="Cadastro da empresa" />
          <p className="ei-apoio ei-margem">Carregando…</p>
        </div>
      </div>
    );
  }

  /** O que cada etapa exige para deixar seguir. Devolve o erro, ou "". */
  function conferirEtapa(n: number): string {
    if (n === 1) {
      if (!form.company_name.trim()) return "Escreva o nome da empresa.";
      if (form.cnpj && !isValidDocument(form.cnpj, "pj")) return "Esse CNPJ não confere.";
    }
    if (n === 2) {
      if (!form.city.trim()) return "Escolha a cidade.";
    }
    if (n === 3) {
      if (!form.responsible_name?.trim()) return "Escreva o nome de quem responde pela empresa.";
      if (!form.phone || !isValidPhone(form.phone)) return "Esse telefone não confere.";
    }
    return "";
  }

  function continuar() {
    const problema = conferirEtapa(etapa);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro("");
    setEtapa((e) => e + 1);
    /* Volta ao topo: sem isto, quem rolou até o fim da etapa 1 começa a
       etapa 2 no meio dela, e parece que nada mudou. */
    window.scrollTo({ top: 0 });
  }

  async function salvar() {
    if (!user) {
      setErro("Você não está conectada.");
      return;
    }

    /* Fora do modo de etapas ninguém passou pelas conferências acima, e o
       salvamento precisa das três mesmo assim. */
    for (const n of [1, 2, 3]) {
      const problema = conferirEtapa(n);
      if (problema) {
        setErro(problema);
        if (emEtapas) setEtapa(n);
        return;
      }
    }

    setErro("");
    setSalvando(true);
    try {
      const empresa = await upsertCompany({ ...form, owner_id: user.id });
      await marcarOnboardingCompleto(user.id);

      /* Só aqui dá para carimbar: a função do banco compara o telefone do
         CADASTRO com o da conta, e o cadastro acabou de ser gravado.
         Falhar não derruba nada — a empresa já está salva e o painel
         continua oferecendo a confirmação. */
      if (foneDaConta && !empresaExistente?.phone_verified && empresa?.id) {
        try {
          await confirmarTelefoneDaEmpresa(empresa.id);
        } catch {
          /* silêncio proposital: ver comentário acima */
        }
      }
      navegar("/painel-empresa", { replace: true });
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar a empresa."));
    } finally {
      setSalvando(false);
    }
  }

  /* Escolher a imagem não envia nada: abre o enquadramento. Quem envia é
     o `guardarFoto`, com o recorte já feito. */
  function escolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setAEnquadrar(file);
    /* Limpa o input: sem isto, escolher O MESMO arquivo de novo (depois de
       cancelar o enquadramento) não dispara evento nenhum. */
    e.target.value = "";
  }

  async function guardarFoto(recortada: File) {
    if (!user) return;
    setAEnquadrar(null);
    setEnviandoFoto(true);
    try {
      const url = await uploadProfessionalPhoto(user.id, recortada);
      setForm((f) => ({ ...f, photo_url: url }));
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar a logo."));
    } finally {
      setEnviandoFoto(false);
    }
  }

  return (
    <div className="ei">
      <div className="ei-tela">
        <Pagina titulo={emEtapas ? "Cadastre sua empresa" : "Dados da empresa"} />

        {aEnquadrar && (
          <AjustarFoto
            arquivo={aEnquadrar}
            aoConfirmar={guardarFoto}
            aoCancelar={() => setAEnquadrar(null)}
          />
        )}

        {emEtapas && <Etapas passos={ETAPAS} atual={etapa} />}

        {erro && (
          <p className="ei-campo-erro ei-margem" role="alert">{erro}</p>
        )}

        {/* ── 1. A empresa ───────────────────────────────────────────── */}
        {mostra(1) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">A empresa</h2>
            <p className="ei-etapa-apoio">
              É esse nome que aparece na vaga, para quem procura trabalho.
            </p>

            <div className="ei-campo">
              <label htmlFor="company_name">Nome da empresa</label>
              <input
                id="company_name"
                type="text"
                placeholder="Como as pessoas conhecem sua empresa"
                value={form.company_name}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              />
            </div>

            <div className="ei-campo">
              <label htmlFor="cnpj">CNPJ (opcional)</label>
              <input
                id="cnpj"
                type="text"
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                value={formatDocument(form.cnpj || "", "pj")}
                onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
              />
            </div>

            {/* A logo fica na primeira etapa de propósito: é o que dá cara
                de empresa de verdade na lista, e enviar imagem é o que
                mais demora — melhor começar por ela do que descobrir no
                fim que a foto não sobe. */}
            <div className="ei-campo">
              <label htmlFor="photo_upload">Logo (opcional)</label>
              <div className="ei-foto-escolha">
                {form.photo_url ? (
                  <img className="ei-foto-escolha-img" src={form.photo_url} alt="Logo da empresa" />
                ) : (
                  <div className="ei-foto-escolha-vazia" aria-hidden="true">
                    {form.company_name.trim().charAt(0).toUpperCase() || "?"}
                  </div>
                )}
                <label htmlFor="photo_upload" className="ei-btn ei-btn-contorno">
                  {enviandoFoto ? "Enviando…" : form.photo_url ? "Trocar logo" : "Escolher logo"}
                </label>
                <input
                  id="photo_upload"
                  type="file"
                  accept="image/*"
                  onChange={escolherFoto}
                  style={{ display: "none" }}
                />
              </div>
            </div>

            <div className="ei-campo">
              <label htmlFor="description">Sobre a empresa (opcional)</label>
              <textarea
                id="description"
                rows={3}
                placeholder="Em uma ou duas linhas, o que a empresa faz"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </section>
        )}

        {/* ── 2. Onde fica ───────────────────────────────────────────── */}
        {mostra(2) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">Onde fica</h2>
            <p className="ei-etapa-apoio">
              A cidade é o que aproxima a vaga de quem mora perto. Rua e número são
              opcionais.
            </p>

            <div className="ei-campo">
              <label htmlFor="city">Cidade</label>
              <select
                id="city"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="ei-campo">
              <label htmlFor="uf">Estado</label>
              <select
                id="uf"
                value={form.uf}
                onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))}
              >
                {UFS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div className="ei-campo">
              <label htmlFor="neighborhood">Bairro (opcional)</label>
              <input
                id="neighborhood"
                type="text"
                placeholder="Centro, Praia, Nossa Senhora do Carmo…"
                value={form.neighborhood || ""}
                onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
              />
            </div>

            <div className="ei-campo">
              <label htmlFor="address">Endereço (opcional)</label>
              <input
                id="address"
                type="text"
                placeholder="Rua, número, complemento"
                value={form.address || ""}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
          </section>
        )}

        {/* ── 3. Contato ─────────────────────────────────────────────── */}
        {mostra(3) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">Contato</h2>
            <p className="ei-etapa-apoio">
              É por aqui que quem responde à vaga vai procurar vocês de volta.
            </p>

            <div className="ei-campo">
              <label htmlFor="responsible_name">Quem responde pela empresa</label>
              <input
                id="responsible_name"
                type="text"
                placeholder="Seu nome"
                value={form.responsible_name || ""}
                onChange={(e) => setForm((f) => ({ ...f, responsible_name: e.target.value }))}
              />
            </div>

            {/* O telefone da empresa confirma-se no próprio campo.
                ────────────────────────────────────────────────────
                Era um campo comum aqui, e a confirmação vinha depois, num
                aviso solto no painel — quando a empresa já tinha terminado
                o cadastro e ido embora. É a mesma coisa que a dona apontou
                no lado do profissional: "tem que ser algo inerente ao
                cadastro, não uma coisa apartada".

                Do lado de quem contrata isso pesa ainda mais: é por este
                número que quem responde à vaga vai procurar a empresa de
                volta, e é aí que mora o golpe do falso emprego. */}
            <div className="ei-campo">
              <label htmlFor="phone">
                Telefone comercial{" "}
                {empresaExistente?.phone_verified || foneDaConta ? (
                  <span className="ei-selo ei-selo-verde">Confirmado</span>
                ) : (
                  <span className="ei-selo ei-selo-laranja">Falta confirmar</span>
                )}
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                placeholder="(31) 99999-9999"
                value={formatPhone(form.phone)}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              {foneDaConta && !empresaExistente?.phone_verified && (
                <p className="ei-campo-ajuda">
                  É o mesmo número com que você entrou no app, então ele já está
                  confirmado — nada a fazer aqui.
                </p>
              )}
              {!empresaExistente?.phone_verified && !foneDaConta && (
                <p className="ei-campo-ajuda">
                  Sem confirmar este número a empresa não publica vaga. Salve o cadastro
                  e a confirmação é o próximo passo — ela usa o mesmo número com que
                  você entrou no app.
                </p>
              )}
            </div>

            <div className="ei-campo">
              <label htmlFor="email">E-mail (opcional)</label>
              <input
                id="email"
                type="email"
                placeholder="contato@empresa.com.br"
                value={form.email || ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="ei-campo">
              <label htmlFor="website">Site ou Instagram (opcional)</label>
              <input
                id="website"
                type="url"
                placeholder="https://…"
                value={form.website || ""}
                onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              />
            </div>
          </section>
        )}

        {/* O rodapé muda com a etapa: no meio do caminho ele leva adiante,
            no fim ele salva. Um "Salvar" visível na etapa 1 convidaria a
            gravar um cadastro sem telefone — que é o campo sem o qual a
            empresa não publica nada. */}
        <div className="ei-margem ei-pe-etapas">
          {emEtapas ? (
            <>
              {etapa < ETAPAS.length ? (
                <button className="ei-btn ei-btn-cheio" onClick={continuar}>
                  Continuar
                </button>
              ) : (
                <button className="ei-btn ei-btn-cheio" onClick={salvar} disabled={salvando}>
                  {salvando ? "Salvando…" : "Salvar e ir para o painel"}
                </button>
              )}
              {etapa > 1 && (
                <button
                  className="ei-btn ei-btn-contorno"
                  onClick={() => {
                    setErro("");
                    setEtapa((e) => e - 1);
                    window.scrollTo({ top: 0 });
                  }}
                >
                  Voltar
                </button>
              )}
            </>
          ) : (
            <button className="ei-btn ei-btn-cheio" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar alterações"}
            </button>
          )}
        </div>

        <p className="ei-apoio ei-margem">
          Dá para mudar tudo isso depois, no painel da empresa.
        </p>
      </div>
    </div>
  );
}
