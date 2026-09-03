import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { useRascunho, CHAVE_RASCUNHO_EMPRESA } from "../lib/rascunho";
import {
  criarEmpresa,
  atualizarEmpresa,
  minhasEmpresas,
  escolherEmpresa,
  marcarOnboardingCompleto,
  confirmarTelefoneDaEmpresa,
  registrarTipoDeUsuario,
  apagarEmpresa,
} from "../lib/company";
import { numeroJaConfirmadoNaConta } from "../lib/whatsappVerify";
import { uploadProfessionalPhoto } from "../lib/storage";
import { DEFAULT_CITY, DEFAULT_UF, CITIES, UFS, type Company } from "../types/domain";
import { formatDocument, isValidDocument, onlyDigits } from "../lib/documents";
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
  /* A dona: "colocar no cadastro da empresa e do empregado a opção de
     PCD" (0115). Aqui é a empresa dizendo que contrata — vale mesmo antes
     de ela publicar a primeira vaga, e aparece no perfil público dela. */
  contrata_pcd: false,
};

/* Os nomes vêm do que a empresa RESPONDE em cada passo, não do nome da
   tabela: "Onde fica" diz mais que "Localização", e é assim que a pessoa
   pensaria na pergunta se alguém a fizesse em voz alta. */
/* ── PESSOA FÍSICA OU EMPRESA GANHOU ETAPA PRÓPRIA (item 9) ──────────
   A dona: "a opção entre escolher pessoa física ou jurídica deve ser em
   uma sessão separada para flagrar a opção que deseja."

   Ela estava certa duas vezes. Primeiro porque a escolha mudava tudo o
   que vinha depois — o rótulo do nome, a máscara do documento, a
   validação — e mesmo assim aparecia como um controlezinho no MEIO da
   etapa 1, depois do campo de nome que ela própria renomeia. Quem
   preenchia primeiro e escolhia depois via o rótulo trocar por baixo do
   que já tinha digitado.

   Segundo porque, sozinha numa tela, ela pode ser explicada: "contrato
   para a minha casa" e "contrato pela minha empresa" são duas frases
   que a pessoa reconhece — "pessoa física ou jurídica" é vocabulário de
   contador. */
const ETAPAS = ["Quem contrata", "A empresa", "Onde fica", "Contato"];

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
  /* A exclusão pede confirmação no lugar do próprio botão: uma janela do
     navegador (`confirm`) some no app instalado em alguns aparelhos, e a
     ação ficaria sem confirmação nenhuma. */
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [etapa, setEtapa] = useState(1);
  /* ── RASCUNHO AUTOMÁTICO, e SÓ no cadastro novo ──────────────────────
     A dona: "ter opção de salvar rascunho nas telas de cadastro pra evitar
     de ter que reescrever tudo quando não tem um dado."

     É o caso exato desta tela: a pessoa para para procurar o CNPJ e volta
     depois. Mas o rascunho vale só para o cadastro NOVO — numa empresa que
     já existe, o formulário vem do banco, e um rascunho velho por cima
     ressuscitaria uma edição abandonada semanas atrás em cima do que está
     no ar. Editar cadastro publicado já tem "salvar"; quem precisa de
     rascunho é quem ainda não tem nada gravado. */
  const [prontoParaGravar, setProntoParaGravar] = useState(false);
  const rascunho = useRascunho(CHAVE_RASCUNHO_EMPRESA, form, etapa, prontoParaGravar);
  const [avisoRascunho, setAvisoRascunho] = useState(false);
  /** O telefone digitado é o mesmo que a conta já confirmou por SMS. */
  const [foneDaConta, setFoneDaConta] = useState(false);
  /* A imagem escolhida fica esperando o enquadramento: só sobe depois que
     a pessoa disser onde é o corte. */
  const [aEnquadrar, setAEnquadrar] = useState<File | null>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [trocandoLado, setTrocandoLado] = useState(false);
  /* ── PESSOA FÍSICA OU EMPRESA ────────────────────────────────────────
     A dona: "no cadastro de quem contrata, tem que ter opção de pessoa
     física ou PJ."

     É o caso mais comum aqui, e o formulário anterior o ignorava: quem
     contrata uma diarista, um pedreiro ou uma babá é uma FAMÍLIA, não uma
     empresa — e a primeira coisa que o cadastro pedia era o CNPJ. Isso
     sozinho manda embora metade de quem vai publicar vaga em Itabirito.

     O tipo não tem coluna própria no banco (isso pediria migration, e
     migration precisa ser aplicada à mão antes de o código subir — a
     regra que custou um dia inteiro na 0060). Ele é DEDUZIDO do documento
     guardado: 11 dígitos é CPF, 14 é CNPJ, e o campo `cnpj` passa a
     guardar os dois. Quando houver uma migration para outra coisa, vale
     acrescentar a coluna e trocar esta dedução por leitura direta. */
  const [tipoDono, setTipoDono] = useState<"pf" | "pj">(() =>
    onlyDigits(EMPTY.cnpj ?? "").length === 11 ? "pf" : "pj",
  );

  /** Em etapas só quem está cadastrando agora. Editando, vê tudo. */
  const emEtapas = !empresaExistente;
  const mostra = (n: number) => !emEtapas || etapa === n;

  /* ── QUAL EMPRESA ESTA TELA ESTÁ EDITANDO ──────────────────────────
     Com mais de uma empresa por conta (item 3, migration 0102), "a minha
     empresa" deixou de ser uma pergunta com uma resposta só. Agora o
     endereço diz:

       /cadastro-empresa            a primeira vez, ou a empresa aberta
       /cadastro-empresa?nova=1     cadastrar mais uma (o botão "+")
       /cadastro-empresa?id=xxx     editar aquela

     O `?nova=1` precisa existir e não podia ser só "sem id": sem ele, o
     botão "+" abriria a tela, ela leria a empresa que já existe e a
     pessoa acabaria EDITANDO a padaria achando que estava cadastrando a
     lanchonete — e o nome antigo já viria escrito no campo. */
  const [params] = useSearchParams();
  const idPedido = params.get("id");
  const querNova = params.get("nova") === "1";

  useEffect(() => {
    if (carregandoConta || !user) return;

    setForm((f) => ({ ...f, owner_id: user.id }));
    setCarregandoEmpresa(true);

    minhasEmpresas(user.id)
      .then((lista) => {
        if (querNova) {
          /* Cadastro novo: o formulário fica em branco, com o dono
             preenchido — ou com o rascunho, se a pessoa tinha parado no
             meio. Nada da empresa anterior entra aqui. */
          const guardado = rascunho.inicial;
          setForm({ ...EMPTY, ...(guardado ? guardado.dados : null), owner_id: user.id });
          setEmpresaExistente(null);
          setTipoDono("pj");
          if (guardado) {
            setEtapa(guardado.etapa);
            setAvisoRascunho(true);
          }
          setProntoParaGravar(true);
          return;
        }
        const empresa = idPedido
          ? lista.find((e) => e.id === idPedido) ?? null
          : lista[0] ?? null;
        if (empresa) {
          setForm(empresa);
          setEmpresaExistente(empresa);
          /* Cadastro que já existe: o tipo vem do que está guardado, e não
             do padrão da tela — senão editar uma pessoa física mostraria a
             máscara de CNPJ em cima de um CPF. */
          if (onlyDigits(empresa.cnpj ?? "").length === 11) setTipoDono("pf");
        } else {
          /* Ninguém cadastrado ainda: é cadastro novo do mesmo jeito, e o
             rascunho vale. */
          const guardado = rascunho.inicial;
          if (guardado) {
            setForm((f) => ({ ...f, ...guardado.dados, owner_id: user.id }));
            setEtapa(guardado.etapa);
            setAvisoRascunho(true);
          }
          setProntoParaGravar(true);
        }
      })
      .catch((err) => {
        /* A leitura falhou. NÃO segue como se a pessoa não tivesse
           empresa: seguir assim abriria o formulário em branco e o
           salvamento criaria uma SEGUNDA empresa por cima de uma que
           existe — e ninguém entenderia de onde ela veio. */
        setErro(mensagemDeErro(err, "Não consegui ler os seus cadastros de empresa."));
      })
      .finally(() => setCarregandoEmpresa(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, carregandoConta, idPedido, querNova]);

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
    /* A etapa 1 (quem contrata) não confere nada: ela sempre tem uma
       resposta marcada, porque começa em "empresa". Uma etapa que nunca
       pode dar erro é uma etapa que nunca prende ninguém — e é o certo
       para uma pergunta que só muda rótulos. */
    if (n === 2) {
      if (!form.company_name.trim()) return "Escreva o nome da empresa.";
      if (form.cnpj && !isValidDocument(form.cnpj, tipoDono))
        return tipoDono === "pf" ? "Esse CPF não confere." : "Esse CNPJ não confere.";
    }
    if (n === 3) {
      if (!form.city.trim()) return "Escolha a cidade.";
    }
    if (n === 4) {
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
    for (const n of [2, 3, 4]) {
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
      /* `insert` ou `update`, nunca mais `upsert`.
         ─────────────────────────────────────────
         O upsert usava `on conflict (owner_id)`, e o alvo dele era o
         `unique` que a 0102 tira. Com a 0102 aplicada ele responderia
         42P10 e o cadastro de empresa pararia INTEIRO — não só o segundo.

         E `update` também é o certo por outra razão, que o CLAUDE.md
         registra: o upsert do PostgREST é `insert ... on conflict`, então
         quem manda passa pela policy de INSERT mesmo editando uma linha
         que já existe. */
      const empresa = empresaExistente
        ? await atualizarEmpresa(empresaExistente.id, { ...form, owner_id: user.id })
        : await criarEmpresa({ ...form, owner_id: user.id });
      await marcarOnboardingCompleto(user.id);

      /* A empresa recém-salva passa a ser a aberta. Sem isto, quem
         cadastra a segunda loja é devolvido ao painel da PRIMEIRA, e
         parece que o cadastro não foi gravado. */
      escolherEmpresa(empresa.id);

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
      /* Gravou: o rascunho cumpriu o papel. Sem isto ele voltaria dentro
         do cadastro da PRÓXIMA empresa, já preenchido com esta. */
      rascunho.limpar();
      /* Cadastro NOVO ganha a tela de "deu certo", com os dois caminhos;
         quem só editou uma empresa que já existe volta para o painel, que
         é de onde veio — uma tela de parabéns depois de corrigir o CNPJ
         seria comemoração de nada. */
      navegar(empresaExistente ? "/painel-empresa" : "/pronto?tipo=empresa", { replace: true });
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

        {/* Sem este aviso, quem volta encontra os campos preenchidos e acha
            que o app se confundiu. Com ele, e com o botão de zerar ao lado,
            o susto vira comodidade. */}
        {avisoRascunho && (
          <div className="ei-rascunho ei-margem" role="status">
            <span>
              <strong>Voltamos de onde você parou.</strong> O que você escreve aqui fica
              guardado neste aparelho até salvar.
            </span>
            <button
              type="button"
              className="ei-btn-inline"
              onClick={() => {
                rascunho.descartar();
                setForm({ ...EMPTY, owner_id: user?.id ?? "" });
                setEtapa(1);
                setAvisoRascunho(false);
              }}
            >
              Começar do zero
            </button>
          </div>
        )}

        {erro && (
          <p className="ei-campo-erro ei-margem" role="alert">{erro}</p>
        )}

        {/* ── 1. Quem contrata (item 9) ──────────────────────────────
            Sozinha numa tela, a escolha pode ser explicada em vez de
            rotulada. "Pessoa física ou jurídica" é vocabulário de
            contador; "contrato para a minha casa" e "contrato pela minha
            empresa" são frases que a pessoa reconhece.

            Dois cartões grandes, e não um controle segmentado: aqui a
            escolha é a única coisa da tela, e um botãozinho de 40px de
            altura no meio do branco lê como enfeite. */}
        {mostra(1) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">Quem está contratando</h2>

            <div className="ei-lados" style={{ marginTop: 12 }}>
              <button
                type="button"
                className={tipoDono === "pf" ? "ei-lado ei-lado-cheio" : "ei-lado"}
                aria-pressed={tipoDono === "pf"}
                onClick={() => {
                  setTipoDono("pf");
                  /* Limpa o documento: um CNPJ digitado e depois marcado
                     como CPF ficaria guardado com 14 dígitos, e a
                     validação passaria a recusar o cadastro inteiro sem
                     dizer qual campo está errado. */
                  setForm((f) => ({ ...f, cnpj: "" }));
                }}
              >
                <span className="ei-lado-nome">Sou pessoa física</span>
                <span className="ei-lado-nota">
                  Contrato para a minha casa, uma obra ou um serviço meu.
                  Diarista, pedreiro, babá, cuidador.
                </span>
              </button>

              <button
                type="button"
                className={tipoDono === "pj" ? "ei-lado ei-lado-cheio" : "ei-lado"}
                aria-pressed={tipoDono === "pj"}
                onClick={() => {
                  setTipoDono("pj");
                  setForm((f) => ({ ...f, cnpj: "" }));
                }}
              >
                <span className="ei-lado-nome">Sou empresa</span>
                <span className="ei-lado-nota">
                  Contrato pela loja, oficina, restaurante ou escritório.
                  Tenho CNPJ.
                </span>
              </button>
            </div>
          </section>
        )}

        {/* ── 2. A empresa ───────────────────────────────────────────── */}
        {mostra(2) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">A empresa</h2>

            <div className="ei-campo">
              <label htmlFor="company_name">
                {tipoDono === "pf" ? "Seu nome ou o da casa/obra" : "Nome da empresa"}
              </label>
              <input
                id="company_name"
                type="text"
                value={form.company_name}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              />
            </div>

            {/* O controle segmentado que ficava aqui saiu: a escolha
                virou a etapa 1 (item 9). No meio desta etapa ela mudava,
                por baixo, o rótulo do campo que está LOGO ACIMA dela — e
                quem preenchia o nome antes de escolher via o rótulo
                trocar depois de digitar. Editando um cadastro que já
                existe, ela continua visível na etapa 1, que aí aparece
                junto com as outras. */}

            <div className="ei-campo">
              <label htmlFor="cnpj">
                {tipoDono === "pf" ? "CPF (opcional)" : "CNPJ (opcional)"}
              </label>
              <input
                id="cnpj"
                type="text"
                inputMode="numeric"
                value={formatDocument(form.cnpj || "", tipoDono)}
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
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* ── PCD (0115) ────────────────────────────────────────────
                A dona: "colocar no cadastro da empresa e do empregado a
                opção de PCD."

                Aqui é a empresa como um todo — diferente da marcação que
                existe em cada vaga. As duas fazem sentido juntas: a
                empresa que contrata PCD aparece assim no perfil dela
                mesmo sem vaga aberta, e cada vaga diz se aceita. */}
            <div className="ei-campo">
              <label className="ei-caixa">
                <input
                  type="checkbox"
                  checked={form.contrata_pcd}
                  onChange={(e) => setForm((f) => ({ ...f, contrata_pcd: e.target.checked }))}
                />
                <span>Nossa empresa contrata pessoa com deficiência (PCD)</span>
              </label>
            </div>
          </section>
        )}

        {/* ── 3. Onde fica ───────────────────────────────────────────── */}
        {mostra(3) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">Onde fica</h2>

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
                value={form.neighborhood || ""}
                onChange={(e) => setForm((f) => ({ ...f, neighborhood: e.target.value }))}
              />
            </div>

            <div className="ei-campo">
              <label htmlFor="address">Endereço (opcional)</label>
              <input
                id="address"
                type="text"
                value={form.address || ""}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
          </section>
        )}

        {/* ── 4. Contato ─────────────────────────────────────────────── */}
        {mostra(4) && (
          <section className="ei-cartao">
            <h2 className="ei-etapa-titulo">Contato</h2>

            <div className="ei-campo">
              <label htmlFor="responsible_name">Quem responde pela empresa</label>
              <input
                id="responsible_name"
                type="text"
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
                value={form.email || ""}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="ei-campo">
              <label htmlFor="website">Site ou Instagram (opcional)</label>
              <input
                id="website"
                type="url"
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

        {/* ── EXCLUIR ESTA EMPRESA, NO FIM DA PÁGINA — 03/09 ───────────
            A dona: "dentro da opção cadastro, ter opção de excluir no
            final da página."

            Não havia caminho nenhum: uma empresa cadastrada por engano —
            ou a loja que fechou — ficava no app para sempre, ocupando
            lugar na tela de escolha e podendo receber vaga.

            Só na EDIÇÃO: durante o cadastro em etapas não há o que
            excluir, e um botão vermelho ao lado de "Salvar e ir para o
            painel" seria só um jeito de errar o dedo.

            Confirma em dois toques, no lugar do próprio botão, e diz o que
            some junto — vaga e candidato de uma loja apagada vão embora
            com ela (`on delete cascade`), e isso ninguém desfaz. */}
        {!emEtapas && empresaExistente && (
          <div className="ei-margem" style={{ textAlign: "center", padding: "22px 0 8px" }}>
            {!confirmandoExclusao ? (
              <button
                type="button"
                className="link-perigo"
                onClick={() => {
                  setErro("");
                  setConfirmandoExclusao(true);
                }}
              >
                Excluir esta empresa
              </button>
            ) : (
              <div style={{ display: "grid", gap: 10, textAlign: "left" }}>
                <p className="ei-apoio" style={{ margin: 0 }}>
                  Excluir <strong>{empresaExistente.company_name}</strong> apaga também as
                  vagas dela e a lista de quem se candidatou. Não dá para desfazer.
                </p>
                <button
                  type="button"
                  className="ei-btn ei-btn-contorno ei-btn-largo"
                  disabled={excluindo}
                  onClick={async () => {
                    setExcluindo(true);
                    setErro("");
                    try {
                      await apagarEmpresa(empresaExistente.id);
                      navegar("/minhas-empresas", { replace: true });
                    } catch (err) {
                      setErro(mensagemDeErro(err, "Não consegui excluir esta empresa."));
                      setExcluindo(false);
                    }
                  }}
                >
                  {excluindo ? "Excluindo…" : "Sim, excluir esta empresa"}
                </button>
                <button
                  type="button"
                  className="ei-btn ei-btn-texto"
                  onClick={() => setConfirmandoExclusao(false)}
                >
                  Não, deixar como está
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── A PORTA DE SAÍDA ────────────────────────────────────────
            A dona: "ao abrir o app está caindo sempre na tela de cadastro
            da empresa."

            E caía mesmo — sem saída. A conta dela está marcada como
            "empresa"; quem é empresa e ainda não tem cadastro é levado
            direto para cá; e a barra de baixo leva ao Painel, que traz de
            volta para cá. A troca de lado existe, mas mora na tela de
            Conta, que saiu da barra quando ela virou Voltar/Avisos/
            Talentos/Painel. Ou seja: um beco, e a única saída era saber o
            endereço de cor.

            Este link é a saída, no lugar onde a pessoa percebe que entrou
            na porta errada — e não três telas adiante. */}
        {emEtapas && (
          <div className="ei-margem" style={{ paddingBottom: 8 }}>
            <button
              type="button"
              className="ei-btn-inline"
              disabled={trocandoLado}
              onClick={async () => {
                if (!user) return;
                setTrocandoLado(true);
                try {
                  await registrarTipoDeUsuario(user.id, "professional");
                  /* Recarrega no endereço do outro lado: a barra de baixo
                     e as telas leem o lado uma vez, na abertura. */
                  window.location.href = "/painel";
                } catch (err) {
                  setErro(mensagemDeErro(err, "Não consegui trocar de lado."));
                  setTrocandoLado(false);
                }
              }}
            >
              {trocandoLado
                ? "Trocando…"
                : "Não é empresa? Ir para o lado de quem procura trabalho"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
