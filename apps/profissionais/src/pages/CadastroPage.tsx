import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { getProfessionalParaEditar, upsertProfessional } from "../lib/professionals";
import {
  CITIES,
  DEFAULT_CITY,
  MAX_CATEGORIES,
  MAX_ESPECIALIDADE_LEN,
  type Professional,
} from "../types/domain";
import { formatDocument, isValidDocument } from "../lib/documents";
import { uploadProfessionalPhoto } from "../lib/storage";
import { formatPhone, isValidPhone } from "../lib/phone";
import { buscarCep, formatCep } from "../lib/cep";
import { SeletorDeServicos } from "../components/SeletorDeServicos";
import { SeletorDeAtributos } from "../components/SeletorDeAtributos";
import { CatalogoDeServicos } from "../components/CatalogoDeServicos";
import { AjustarFoto } from "../components/AjustarFoto";
import { mensagemDeErro } from "../lib/erros";
import { useTituloDaPagina } from "../lib/tituloDaPagina";

/**
 * Exemplo de especialidade para o ofício escolhido.
 *
 * Um campo vazio chamado "especialidade" recebe qualquer coisa — inclusive
 * o nome da profissão de novo, ou "atendimento de qualidade". O exemplo é o
 * que ensina o formato em silêncio, e por isso ele precisa ser do ramo da
 * pessoa: "Ortodontia" não ajuda um pintor.
 *
 * A lista cobre os ofícios em que a especialidade mais pesa na escolha; para
 * os outros vale o exemplo genérico, que ainda mostra o formato (uma
 * expressão curta, não uma frase).
 */
const EXEMPLOS_DE_ESPECIALIDADE: Record<string, string> = {
  "Dentista": "Ex: Ortodontia (aparelho)",
  "Clínica odontológica": "Ex: Implantes e próteses",
  "Clínica médica": "Ex: Cardiologia",
  "Psicólogo": "Ex: Terapia cognitivo-comportamental",
  "Fisioterapeuta": "Ex: Reabilitação pós-cirúrgica",
  "Nutricionista": "Ex: Nutrição esportiva",
  "Advogado": "Ex: Direito trabalhista",
  "Contador": "Ex: MEI e pequenas empresas",
  "Pintor": "Ex: Pintura residencial e textura",
  "Pedreiro": "Ex: Alvenaria e reforma de banheiro",
  "Eletricista": "Ex: Instalação de chuveiro e quadro",
  "Encanador": "Ex: Caça-vazamento",
  "Mecânico": "Ex: Injeção eletrônica",
  "Cabeleireiro": "Ex: Coloração e mechas",
  "Manicure": "Ex: Alongamento em gel",
  "Professor particular": "Ex: Matemática do ensino médio",
  "Fotógrafo": "Ex: Casamento e ensaio de gestante",
  "Confeiteira": "Ex: Bolo de casamento",
  "Costureira": "Ex: Ajuste de roupa social",
  "Veterinário": "Ex: Cães e gatos",
  "Personal trainer": "Ex: Emagrecimento e hipertrofia",
};

function exemploDeEspecialidade(categoria: string): string {
  return EXEMPLOS_DE_ESPECIALIDADE[categoria] ?? "Ex: no que você é especialista";
}

type FormState = Omit<
  Professional,
  | "id"
  | "created_at"
  | "verified"
  | "verified_until"
  | "verified_since"
  | "whatsapp_verified"
  | "whatsapp_verified_at"
  | "boosted"
  | "boosted_until"
  | "paused"
  | "suspended"
  | "suspended_reason"
  | "contact_mode"
  | "plus_active"
  | "plus_until"
> & { id?: string };

const EMPTY: FormState = {
  owner_id: "",
  name: "",
  // Nada vem marcado. Antes o primeiro serviço da lista já vinha escolhido,
  // e quem não reparasse publicava um cadastro de encanador sem nunca ter
  // dito que é encanador — um valor padrão aqui não é conveniência, é uma
  // resposta colocada na boca da pessoa.
  category: "",
  categories: [],
  especialidade: "",
  atributos: [],
  city: DEFAULT_CITY,
  bio: "",
  phone: "",
  whatsapp: "",
  email: "",
  instagram: "",
  linkedin: "",
  entity_type: "pf",
  document: "",
  company_name: "",
  photo_url: null,
  responsible_name: "",
  cep: "",
  street: "",
  street_number: "",
  neighborhood: "",
  mostrar_endereco: false,
};

const NAME_MAX_LENGTH = 80;

/**
 * Cada etapa responde a uma pergunta só, e o título diz qual é.
 *
 * A ordem não é arbitrária: começa pelo que a pessoa já sabe de cor (nome,
 * foto), passa pelo que ela precisa escolher (serviços) e só no fim pede o
 * telefone — que é o campo que mais faz alguém desistir quando aparece
 * antes de o cadastro ter mostrado para que serve.
 */
const PASSO_TITULOS = ["Quem é você", "O que você faz", "Como te chamam"] as const;

/** Carrega no formulário um cadastro que já existe. */
function preencher(p: Professional): FormState {
  return {
    id: p.id,
    owner_id: p.owner_id,
    name: p.name,
    category: p.category,
    categories: p.categories?.length ? p.categories : [p.category],
    atributos: p.atributos ?? [],
    especialidade: p.especialidade ?? "",
    city: p.city,
    bio: p.bio,
    // Cadastros salvos antes da máscara existir têm o telefone em qualquer
    // formato; ao abrir para editar, já aparecem no formato novo.
    phone: formatPhone(p.phone),
    whatsapp: p.whatsapp ? formatPhone(p.whatsapp) : "",
    email: p.email ?? "",
    instagram: p.instagram ?? "",
    linkedin: p.linkedin ?? "",
    entity_type: p.entity_type,
    document: p.document ? formatDocument(p.document, p.entity_type) : "",
    company_name: p.company_name ?? "",
    photo_url: p.photo_url,
    responsible_name: p.responsible_name ?? "",
    cep: p.cep ?? "",
    street: p.street ?? "",
    street_number: p.street_number ?? "",
    neighborhood: p.neighborhood ?? "",
    mostrar_endereco: p.mostrar_endereco ?? false,
  };
}

/**
 * Tela de cadastro: criar um novo (`/painel/novo`) ou editar um existente
 * (`/painel/editar/:id`).
 *
 * Antes o formulário morava dentro do painel, aberto e fechado por um botão.
 * O painel ficava sendo duas coisas ao mesmo tempo — a lista dos meus
 * cadastros e o editor de um deles — e a pessoa que apertava "Editar" era
 * levada por uma rolagem até um formulário lá embaixo, com os cartões dos
 * outros cadastros ainda acima. Numa tela de celular era fácil não perceber
 * que a tela tinha mudado de assunto.
 *
 * Em endereço próprio, editar é ir a um lugar e voltar: a tela tem um
 * título só, um botão de voltar, e o que ela mostra é o cadastro que está
 * sendo mexido. O painel volta a ser só a lista.
 */
export function CadastroPage() {
  const { id } = useParams<{ id?: string }>();
  const editando = !!id;
  useTituloDaPagina(editando ? "Editar cadastro" : "Novo cadastro");
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>(EMPTY);
  /* Recado de quando o CEP é de uma cidade que o app não atende. Fica
     ao lado do seletor de cidade, e não no rodapé do formulário: é ali
     que a pessoa vai olhar para entender por que a cidade não mudou. */
  const [avisoDeCidade, setAvisoDeCidade] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  /** Arquivo aguardando enquadramento. Enquanto não for nulo, a folha de
   *  ajuste está aberta e nada foi anexado ao formulário ainda. */
  const [fotoParaAjustar, setFotoParaAjustar] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  /**
   * Etapa atual do cadastro (1 a 3).
   *
   * O formulário era um cartão só com vinte campos, dos quais cinco
   * obrigatórios e o resto opcional — sem nada na tela dizendo qual era
   * qual. Quem abria o painel via a parede inteira de uma vez e fechava;
   * é o candidato mais provável para metade das contas criadas nunca
   * terem virado cadastro.
   *
   * Em três etapas cada tela responde a uma pergunta só ("quem é você",
   * "o que você faz", "como te chamam"), e o erro de um campo aparece na
   * etapa dele — não a quatrocentos pixels do botão que a pessoa apertou.
   */
  const [passo, setPasso] = useState(1);
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  /** Distingue "deu errado" de "deu certo" — os dois usam a mesma linha de texto. */
  const [erroAoSalvar, setErroAoSalvar] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  /** Só enquanto o cadastro que vai ser editado está vindo do servidor. */
  const [carregandoCadastro, setCarregandoCadastro] = useState(editando);

  useEffect(() => {
    if (!user || !id) return;
    let ativo = true;
    getProfessionalParaEditar(id).then((p) => {
      if (!ativo) return;
      /* Cadastro apagado, ou de outra pessoa sem que eu seja administração:
         nos dois casos a consulta volta vazia, porque quem recusa é a RLS
         do banco. Mostrar um formulário em branco dizendo "editar" criaria
         um cadastro novo sem ninguém ter pedido. */
      if (!p) {
        navigate("/painel", { replace: true });
        return;
      }
      setForm(preencher(p));
      // Quem já publicou uma vez aceitou os termos; pedir de novo a cada
      // ajuste de telefone é transformar uma correção de um minuto em outra
      // rodada de leitura jurídica.
      setAcceptedTerms(true);
      setCarregandoCadastro(false);
    });
    return () => {
      ativo = false;
    };
  }, [user, id, navigate]);

  /**
   * Troca de etapa leva a tela para o começo do formulário.
   *
   * A primeira versão rolava para `document.body.scrollHeight`, que é o pé
   * da página: a pessoa apertava "Continuar" e era jogada para depois dos
   * campos da etapa nova, encarando os botões. Como cada etapa tem uma
   * altura diferente, o destino ainda mudava de lugar a cada troca.
   */
  function irParaOTopoDoFormulario() {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /**
   * A foto escolhida vai primeiro para o enquadramento, não direto para o
   * formulário: o cartão corta em quadrado pelo centro, e sem escolher o
   * pedaço a foto de corpo inteiro virava um retângulo de camisa.
   *
   * O `value` do campo é zerado de propósito. Sem isso, quem cancela o
   * enquadramento e escolhe O MESMO arquivo de novo não dispara `change`
   * nenhum — o navegador entende que nada mudou —, e a folha não reabre.
   * A pessoa fica tocando no botão sem nada acontecer.
   */
  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (file) setFotoParaAjustar(file);
  }

  /**
   * O que falta na etapa `n`, ou `null` se ela está completa.
   *
   * Cada regra mora na etapa que contém o campo dela. É isso que permite
   * checar antes de avançar — e, quando o salvamento final falha, saber
   * para qual etapa voltar em vez de escrever o motivo embaixo de um
   * formulário que a pessoa já rolou inteiro.
   */
  function validarPasso(n: number): string | null {
    if (n === 1) {
      if (!form.name.trim()) return "Escreva o nome que vai aparecer no cadastro.";
      if (form.document && !isValidDocument(form.document, form.entity_type)) {
        return form.entity_type === "pj"
          ? "CNPJ inválido. Confira os números digitados."
          : "CPF inválido. Confira os números digitados.";
      }
      /* Foto obrigatória nos dois tipos de cadastro. Era exigida só de
         pessoa física; a empresa podia publicar sem logo e ficava um
         retângulo vazio na busca, no meio de cartões com rosto — o cadastro
         sem imagem parece cadastro abandonado, e quem procura passa direto. */
      if (!photoFile && !form.photo_url) {
        return form.entity_type === "pj"
          ? "Envie a logo da empresa para publicar o cadastro."
          : "Envie uma foto de rosto para publicar o cadastro.";
      }
      if (form.entity_type === "pj" && !form.responsible_name?.trim()) {
        return "Informe o nome do responsável pela empresa.";
      }
      return null;
    }
    if (n === 2) {
      if (form.categories.length === 0) return "Marque pelo menos um serviço que você faz.";
      return null;
    }
    if (n === 3) {
      if (!isValidPhone(form.phone)) return "Informe um telefone com DDD, no formato (31) 99999-9999.";
      if (form.whatsapp && !isValidPhone(form.whatsapp)) {
        return "O WhatsApp está incompleto. Use o formato (31) 99999-9999.";
      }
      if (!acceptedTerms) return "Para publicar, é preciso concordar com os Termos de Uso.";
      return null;
    }
    return null;
  }

  /** Avança uma etapa, ou explica o que falta sem sair do lugar. */
  function avancar() {
    const falta = validarPasso(passo);
    if (falta) {
      setErroAoSalvar(true);
      setFormMessage(falta);
      return;
    }
    setFormMessage("");
    setErroAoSalvar(false);
    setPasso((p) => Math.min(3, p + 1));
    irParaOTopoDoFormulario();
  }

  function voltarPasso() {
    setFormMessage("");
    setErroAoSalvar(false);
    setPasso((p) => Math.max(1, p - 1));
    irParaOTopoDoFormulario();
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    // Enter num campo de texto dispara o submit do formulário. Fora da
    // última etapa isso não é "publicar", é "continuar" — tratar como envio
    // faria a tecla mais comum do teclado recusar um cadastro que ainda
    // nem terminou de ser preenchido.
    if (passo < 3) {
      avancar();
      return;
    }

    setFormMessage("");
    setErroAoSalvar(false);

    /* Revalida as três etapas, e não só a atual: a pessoa pode ter voltado
       e apagado um campo já preenchido. Quando alguma falha, a tela vai
       para a etapa dona do problema — o motivo aparece junto do campo que
       o causou, em vez de embaixo de um botão a duas telas dele. */
    for (const n of [1, 2, 3]) {
      const falta = validarPasso(n);
      if (falta) {
        setPasso(n);
        setErroAoSalvar(true);
        setFormMessage(falta);
        // A etapa mudou debaixo da pessoa; sem levar a tela junto, ela fica
        // parada numa altura que agora pertence a outro conteúdo.
        irParaOTopoDoFormulario();
        return;
      }
    }

    setSaving(true);
    try {
      let photoUrl = form.photo_url;
      if (photoFile) {
        /* Na pasta do dono do cadastro, não na de quem está salvando.
           Pelo mesmo motivo do `owner_id` logo abaixo: quando a
           administração corrige a foto de alguém, o arquivo é daquela
           pessoa. A pasta é a única coisa que liga arquivo a dono no
           Storage, e é por ela que uma limpeza futura vai procurar.
           A policy da migration 0058 é o que permite esse envio. */
        photoUrl = await uploadProfessionalPhoto(form.owner_id || user.id, photoFile);
      }
      await upsertProfessional({
        ...form,
        /* O dono continua sendo quem era. Vinha escrito `user.id` fixo, o
           que estava certo enquanto só o dono editava — mas agora a
           administração também abre esta tela, e salvar transferiria o
           cadastro da pessoa para a conta de quem corrigiu a foto. */
        owner_id: form.owner_id || user.id,
        document: form.document ? form.document.replace(/\D/g, "") : null,
        company_name: form.entity_type === "pj" ? form.company_name || null : null,
        responsible_name: form.entity_type === "pj" ? form.responsible_name || null : null,
        photo_url: photoUrl,
      });
      /* Volta para a lista com o aviso na mão. Sem `replace`, o botão de
         voltar do celular traria de novo o formulário do que acabou de ser
         salvo — e um "Publicar cadastro" apertado ali criaria um segundo
         cadastro igual. */
      navigate(voltarPara, {
        replace: true,
        state: { aviso: editando ? "Cadastro atualizado." : "Cadastro salvo." },
      });
    } catch (err) {
      setErroAoSalvar(true);
      setFormMessage(mensagemDeErro(err, "Não foi possível salvar o cadastro."));
      setSaving(false);
    }
  }

  if (loading) return <div className="container" style={{ paddingTop: 40 }}>Carregando…</div>;
  /* Sem conta não há o que editar. O painel é quem sabe oferecer o login,
     e é para lá que a pessoa volta depois de entrar.

     Esta checagem vem ANTES da de carregamento de propósito: quem não está
     logado nunca dispara a busca do cadastro, então `carregandoCadastro`
     fica preso em `true` — e um link de edição aberto deslogado (o que
     acontece toda vez que a sessão expira) mostraria "Carregando…" para
     sempre, sem nada que a pessoa pudesse fazer. */
  if (!user) return <Navigate to="/painel" replace />;
  if (carregandoCadastro) {
    return <div className="container" style={{ paddingTop: 40 }}>Carregando…</div>;
  }

  const isPj = form.entity_type === "pj";
  /* Estou mexendo no cadastro de outra pessoa? Só a administração chega
     aqui nessa situação — para qualquer outro, a consulta teria voltado
     vazia e a tela já teria mandado embora. Serve para dizer isso em voz
     alta e para saber de onde a pessoa veio. */
  const deOutraPessoa = editando && !!form.owner_id && form.owner_id !== user.id;
  const voltarPara = deOutraPessoa ? "/admin" : "/painel";

  return (
    <div className="container" style={{ paddingTop: 24, paddingBottom: 60 }}>
      {/* Uma tela que se abre por cima de outra precisa dizer como sair.
          Aqui é o único caminho de volta que não depende do botão do
          aparelho — e no app instalado esse botão nem sempre existe. */}
      <Link to={voltarPara} className="voltar-link">
        ← {deOutraPessoa ? "Painel administrativo" : "Meus cadastros"}
      </Link>
      <h1 style={{ marginTop: 10 }}>{editando ? "Editar cadastro" : "Termine seu cadastro"}</h1>
      {!editando && (
        <p className="muted painel-subtitulo">São três passos rápidos e você já aparece na busca.</p>
      )}

      {/* Dito na cara, e não escondido: editar o cadastro de outra pessoa é
          um poder que a administração tem, e mexer no trabalho de alguém
          sem que ela saiba merece pelo menos um aviso na tela de quem está
          mexendo. Também evita o acidente mais óbvio — achar que está
          corrigindo o próprio cadastro e estar no de outra pessoa. */}
      {deOutraPessoa && (
        <div className="aviso-admin">
          <strong>Este cadastro é de outra pessoa.</strong> Você está editando como administração. O
          dono não é avisado das alterações — corrija o que estiver claramente errado (foto torta,
          telefone sem DDD) e evite reescrever o que ele escolheu escrever.
        </div>
      )}

      <form ref={formRef} className="card" onSubmit={handleSave} style={{ display: "grid", gap: 12 }}>
        {/* Onde a pessoa está e quanto falta. Sem isso, três telas em
            sequência não são "um cadastro rápido", são um formulário sem
            fim — a barra é o que transforma o segundo passo em progresso
            em vez de mais uma pergunta. */}
        <div className="passos">
          <div className="passos-barra" aria-hidden="true">
            <div className="passos-preenchido" style={{ width: `${(passo / 3) * 100}%` }} />
          </div>
          <p className="passos-rotulo">
            Passo {passo} de 3 · <strong>{PASSO_TITULOS[passo - 1]}</strong>
          </p>
        </div>

        {passo === 1 && (
        <>
        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="entity_type"
              checked={form.entity_type === "pf"}
              onChange={() => setForm({ ...form, entity_type: "pf", document: "" })}
              style={{ width: "auto" }}
            />
            Pessoa física
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="radio"
              name="entity_type"
              checked={form.entity_type === "pj"}
              onChange={() => setForm({ ...form, entity_type: "pj", document: "" })}
              style={{ width: "auto" }}
            />
            Pessoa jurídica (empresa)
          </label>
        </div>

        <input
          placeholder={isPj ? "Nome exibido (ex: Escolinha Golfinho Azul)" : "Nome"}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          maxLength={NAME_MAX_LENGTH}
        />
        {isPj && (
          <p className="muted" style={{ margin: "-6px 0 0", fontSize: "0.82rem" }}>
            É o nome que aparece no seu cadastro — pode ser o nome fantasia, não precisa ser o da razão social.
          </p>
        )}

        {!isPj && (
          <input
            placeholder="CPF"
            value={form.document ?? ""}
            onChange={(e) => setForm({ ...form, document: formatDocument(e.target.value, form.entity_type) })}
            inputMode="numeric"
            maxLength={14}
          />
        )}

        <label style={{ display: "grid", gap: 6 }}>
          <span className="muted">{isPj ? "Logo da empresa" : "Foto de rosto"} (obrigatória)</span>
          <input type="file" accept="image/*" onChange={handlePhotoChange} />
          {(photoPreview || form.photo_url) && (
            <img
              src={photoPreview || form.photo_url || undefined}
              alt={form.name ? `Pré-visualização de ${form.name}` : "Pré-visualização"}
              style={{ width: 96, height: 96, objectFit: "cover", borderRadius: isPj ? 10 : "50%", border: "1px solid var(--color-border)" }}
            />
          )}
        </label>

        {isPj && (
          /* Antes eram três campos soltos entre o nome e a foto — CNPJ,
             razão social e responsável iam sendo pedidos um atrás do
             outro, sem explicar por quê. Agrupados aqui, depois de quem a
             empresa é (nome e logo) e antes do que ela faz, ficam no
             lugar que corresponde à pergunta que respondem: "quem
             responde legalmente por este cadastro?" — não é a mesma
             pergunta que "como você aparece na busca?". */
          <fieldset className="contact-fields">
            <legend>Dados da empresa</legend>
            <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.85rem" }}>
              Não aparecem escondidos: a razão social e o responsável saem no seu cadastro, como sinal de
              que existe uma empresa de verdade por trás dele.
            </p>
            <input
              placeholder="Razão social (nome oficial no CNPJ)"
              value={form.company_name ?? ""}
              onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              style={{ marginBottom: 10 }}
            />
            <input
              placeholder="Responsável pela empresa (ex: Maria Silva)"
              value={form.responsible_name ?? ""}
              onChange={(e) => setForm({ ...form, responsible_name: e.target.value })}
              required
              style={{ marginBottom: 10 }}
            />
            <input
              placeholder="CNPJ"
              value={form.document ?? ""}
              onChange={(e) => setForm({ ...form, document: formatDocument(e.target.value, form.entity_type) })}
              inputMode="numeric"
              maxLength={18}
            />
          </fieldset>
        )}
        </>
        )}

        {passo === 2 && (
        <>
        <fieldset className="contact-fields">
          <legend>O que você faz</legend>
          <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.85rem" }}>
            Até {MAX_CATEGORIES} serviços. Quem faz encanamento e elétrica aparece nas duas buscas, sem
            precisar de dois cadastros — o primeiro da lista é o que aparece em destaque.
          </p>
          <SeletorDeServicos
            escolhidos={form.categories}
            onChange={(lista) =>
              // A principal é sempre a primeira da lista; se ela sair, a
              // seguinte assume — o cadastro nunca fica sem destaque.
              setForm({ ...form, categories: lista, category: lista[0] ?? "" })
            }
          />

          {/* Só aparece depois que existe um ofício: perguntar "qual sua
              especialidade?" antes de saber a profissão é uma pergunta sem
              contexto, e o exemplo — que é o que faz a pessoa entender o
              campo — depende justamente do ofício escolhido. */}
          {form.category && (
            <label style={{ display: "grid", gap: 6, marginTop: 14 }}>
              <span className="muted">
                Sua especialidade <strong>(opcional)</strong>
              </span>
              <input
                placeholder={exemploDeEspecialidade(form.category)}
                value={form.especialidade ?? ""}
                maxLength={MAX_ESPECIALIDADE_LEN}
                onChange={(e) => setForm({ ...form, especialidade: e.target.value })}
              />
              <span className="muted" style={{ fontSize: "0.82rem" }}>
                O que você faz <em>dentro</em> do seu ofício. Quem procura aparelho não quer qualquer
                dentista — e quem digitar sua especialidade na busca vai te encontrar por ela.
              </span>
            </label>
          )}
        </fieldset>

        {/* A lista detalhada vem logo depois dos serviços marcados, porque é
            a mesma pergunta em outro nível: "encanador" é o que você é,
            "caça-vazamento com câmera" é o que você faz. Morava no cartão do
            painel, longe do formulário — quem ia editar o cadastro passava
            direto por ela sem ligar uma coisa à outra.

            Só existe depois que o cadastro foi salvo: cada item guarda o id
            dele, e não há id antes do primeiro "Publicar". Fechada por
            padrão, porque quem faz um serviço só não precisa nem saber que
            ela existe. */}
        {editando && (
          <details className="bloco-recolhivel">
            {/* Título e explicação embrulhados juntos: são um bloco só, e a
                seta do lado precisa de um vizinho único para ficar à direita
                dele. Soltos, cada um virava um item de flex e a seta caía
                numa linha própria. */}
            <summary>
              <span className="recolhivel-titulo">
                <strong>Lista do que eu faço</strong>
                <span className="muted"> — exames, ajustes, pacotes, tipos de atendimento</span>
              </span>
            </summary>
            <CatalogoDeServicos professionalId={form.id!} />
          </details>
        )}

        <fieldset className="contact-fields">
          <legend>Mais informações</legend>
          <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.85rem" }}>
            Opcional. Diz <strong>quando</strong> e <strong>como</strong> você atende — fim de semana,
            emergência, cartão, se vai até o cliente.
          </p>
          <SeletorDeAtributos
            escolhidos={form.atributos}
            onChange={(atributos) => setForm({ ...form, atributos })}
          />
        </fieldset>
        <select
          value={form.city}
          onChange={(e) => {
            setForm({ ...form, city: e.target.value });
            setAvisoDeCidade("");
          }}
        >
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {avisoDeCidade && <p className="aviso-cidade">{avisoDeCidade}</p>}
        <textarea placeholder="Conte o que você faz, com suas palavras" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} />
        <fieldset className="contact-fields">
          <legend>Onde você atende</legend>
          <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.85rem" }}>
            Nada aqui é obrigatório. O <strong>CEP</strong> serve para preencher sozinho a cidade e o
            bairro do seu cadastro — e o bairro é o que ajuda quem procura alguém perto. A{" "}
            <strong>rua e o número só aparecem no cadastro se você marcar a opção no fim deste bloco</strong>:
            quem atende na casa do cliente, ou trabalha na própria casa, deixa desmarcado e ninguém vê onde
            você mora.
          </p>
          <input
            placeholder="CEP"
            value={form.cep ?? ""}
            inputMode="numeric"
            maxLength={9}
            onChange={async (e) => {
              const cep = formatCep(e.target.value);
              setForm((f) => ({ ...f, cep }));
              // Oito dígitos é o sinal de que terminou de digitar — não há
              // botão de buscar, e não deve haver: um passo a mais aqui é
              // um passo que a pessoa esquece.
              if (cep.replace(/\D/g, "").length === 8) {
                const encontrado = await buscarCep(cep);
                if (encontrado) {
                  /* A cidade do CEP só entra se o app atender essa cidade.
                     Antes ela entrava sempre, e isso apagava cadastros da
                     busca sem ninguém perceber: o serviço de endereço
                     conhece o Brasil inteiro, então quem mora em Rio
                     Acima, Moeda ou Nova Lima — ou digitou um número
                     errado — ficava salvo numa cidade que não está na
                     lista. E como a lista não tem essa opção, ela não
                     tinha nem como mostrar o que havia acontecido: a
                     pessoa preenchia tudo, via a tela normal, salvava,
                     recebia "cadastro salvo" e sumia da busca.
                     Fora da lista, a escolha dela fica de pé e a tela
                     diz por quê — que é a única parte disso que ela pode
                     resolver sozinha. */
                  const cidadeAtendida =
                    encontrado.city && (CITIES as readonly string[]).includes(encontrado.city);
                  setAvisoDeCidade(
                    encontrado.city && !cidadeAtendida
                      ? `Este CEP é de ${encontrado.city}, cidade que o procurô ainda não atende. Seu cadastro continua em ${form.city} — é lá que as pessoas vão te encontrar.`
                      : ""
                  );
                  setForm((f) => ({
                    ...f,
                    street: encontrado.street || f.street,
                    neighborhood: encontrado.neighborhood || f.neighborhood,
                    city: cidadeAtendida ? encontrado.city : f.city,
                  }));
                }
              }
            }}
          />
          <input
            placeholder="Rua"
            value={form.street ?? ""}
            onChange={(e) => setForm({ ...form, street: e.target.value })}
          />
          <input
            placeholder="Número"
            value={form.street_number ?? ""}
            onChange={(e) => setForm({ ...form, street_number: e.target.value })}
          />
          <input
            placeholder="Bairro"
            value={form.neighborhood ?? ""}
            onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
          />

          {/* Desligado por padrão, e a chave fica aqui embaixo do endereço
              porque é aqui que a pergunta faz sentido. Boa parte de quem
              se cadastra atende em casa — manicure, confeiteira, costureira —
              e o endereço foi digitado para o CEP completar cidade e
              bairro, não para virar "moro na rua tal, número 42" num
              cadastro aberto. O bairro continua aparecendo de qualquer
              jeito: situa a região sem dizer onde é a porta. */}
          <label className="opcao-endereco">
            <input
              type="checkbox"
              checked={form.mostrar_endereco}
              onChange={(e) => setForm({ ...form, mostrar_endereco: e.target.checked })}
            />
            <span>
              <strong>Mostrar rua e número no meu cadastro.</strong>
              <span className="opcao-obs">
                Marque só se você tem ponto fixo e quer que as pessoas cheguem até lá. Quem atende em casa
                deve deixar desmarcado — o bairro aparece de todo jeito, e é o que ajuda quem procura perto.
              </span>
            </span>
          </label>
        </fieldset>
        </>
        )}

        {passo === 3 && (
        <>
        <fieldset className="contact-fields">
          <legend>Como querem falar com você</legend>
          <p className="muted" style={{ margin: "0 0 10px", fontSize: "0.85rem" }}>
            Preencha o que fizer sentido — só aparece no cadastro o que você escrever aqui. O{" "}
            <strong>WhatsApp</strong> (ou o telefone, se você não preencher o WhatsApp) é o número que recebe
            o código de confirmação e o mesmo que as pessoas usam para te chamar. Trocá-lo depois derruba a
            confirmação, e você confirma de novo.
          </p>
          <input
            placeholder="Telefone: (31) 99999-9999"
            value={form.phone}
            inputMode="tel"
            maxLength={15}
            onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
          />
          <input
            placeholder="WhatsApp: (31) 99999-9999"
            value={form.whatsapp ?? ""}
            inputMode="tel"
            maxLength={15}
            onChange={(e) => setForm({ ...form, whatsapp: formatPhone(e.target.value) })}
          />
          <input
            type="email"
            placeholder="E-mail"
            value={form.email ?? ""}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            placeholder="Instagram (@seuperfil)"
            value={form.instagram ?? ""}
            onChange={(e) => setForm({ ...form, instagram: e.target.value })}
          />
          <input
            placeholder="LinkedIn (link do perfil)"
            value={form.linkedin ?? ""}
            onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
          />
        </fieldset>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.88rem" }}>
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(e) => setAcceptedTerms(e.target.checked)}
            style={{ width: "auto" }}
          />
          Li e concordo com os <Link to="/termos" target="_blank" rel="noreferrer">Termos de Uso</Link>
        </label>
        </>
        )}

        {/* O aviso de erro só existia no topo da página, a uma tela inteira
            de distância do botão. Quem clicava em Salvar via a tela não
            mudar e concluía que o app não salva — o motivo estava escrito,
            fora do campo de visão. Agora ele aparece aqui, colado no botão
            que a pessoa acabou de apertar. */}
        {formMessage && (
          <p className={erroAoSalvar ? "form-erro" : "form-aviso"} role="status">
            {formMessage}
          </p>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {passo > 1 && (
            <button type="button" className="btn btn-outline" onClick={voltarPasso} disabled={saving}>
              Voltar
            </button>
          )}
          {passo < 3 ? (
            /* `type="button"`: só a última etapa envia o formulário. Um
               submit aqui rodaria a validação inteira e recusaria o
               cadastro por causa de campos que ainda nem foram mostrados. */
            <button type="button" className="btn btn-primary" onClick={avancar}>
              Continuar
            </button>
          ) : (
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Salvando…" : editando ? "Salvar alterações" : "Publicar cadastro"}
            </button>
          )}
          {editando && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate(voltarPara)}
              disabled={saving}
            >
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      {fotoParaAjustar && (
        <AjustarFoto
          arquivo={fotoParaAjustar}
          titulo={isPj ? "Enquadre a logo" : "Enquadre sua foto"}
          onCancelar={() => setFotoParaAjustar(null)}
          onPronto={(recortada) => {
            setPhotoFile(recortada);
            setPhotoPreview(URL.createObjectURL(recortada));
            setFotoParaAjustar(null);
            /* O aviso de "falta a foto" some sozinho quando a foto chega —
               senão ele fica na tela contradizendo a miniatura logo acima. */
            if (erroAoSalvar) {
              setErroAoSalvar(false);
              setFormMessage("");
            }
          }}
        />
      )}
    </div>
  );
}
