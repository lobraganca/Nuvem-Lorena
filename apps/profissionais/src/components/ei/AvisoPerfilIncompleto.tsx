/**
 * "Falta preencher isto no seu cadastro."
 *
 * ── O PEDIDO ───────────────────────────────────────────────────────────
 *
 * A dona: "ao escolher o ambiente, se o perfil não estiver preenchido,
 * deve ter um aviso na tela."
 *
 * ── POR QUE ISTO NÃO É UMA BARREIRA ────────────────────────────────────
 *
 * O app já tem barreiras: `ExigirConta`, `ExigirSenha`, `ExigirNumero`,
 * `CompletarPerfil`. Cada uma delas PARA a pessoa até ela responder, e
 * cada uma existe porque sem aquela resposta nada mais funciona.
 *
 * Este aviso é o contrário: o cadastro pela metade FUNCIONA — a pessoa
 * aparece na busca, recebe vaga, responde. Só aparece pior. Transformar
 * isso numa barreira cobraria bio, foto e pretensão de quem entrou para ver
 * uma vaga hoje, e o resultado conhecido é a pessoa fechar o app.
 *
 * Então é um aviso: diz exatamente o que falta (não "complete seu perfil",
 * que não diz nada), leva ao lugar certo com um toque, e pode ser
 * dispensado — mas só nesta visita, porque a informação continua faltando
 * amanhã.
 *
 * ── O QUE CONTA COMO "FALTANDO" ────────────────────────────────────────
 *
 * Só o que muda o resultado para a pessoa, e nesta ordem:
 *
 *   quem procura trabalho   funções (sem elas nenhuma vaga encontra você),
 *                           foto, bairro, e o que você quer (pretensão e
 *                           horário — a 0101)
 *   quem contrata           foto e descrição da empresa: são as duas coisas
 *                           que quem procura trabalho olha antes de
 *                           responder a uma vaga de nome desconhecido
 *
 * O telefone confirmado NÃO entra: sem ele o cadastro não existe para
 * ninguém, e quem cuida disso é uma barreira de verdade (`ExigirNumero`).
 * Repetir aqui seria dois avisos para o mesmo problema.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/useAuth";
import { mensagemDeErro } from "../../lib/erros";

type Lado = "professional" | "company";

/** O que falta, em português, já na ordem em que vale a pena preencher. */
async function oQueFalta(lado: Lado, ownerId: string): Promise<string[]> {
  const sb = supabase();
  if (!sb) return [];

  if (lado === "company") {
    const { data, error } = await sb
      .from("companies")
      .select("photo_url, description")
      .eq("owner_id", ownerId)
      /* Várias empresas por conta desde a 0102, então `limit(1)` e não
         `maybeSingle`: com duas linhas o `maybeSingle` devolve erro, e o
         aviso sumiria justamente para quem tem mais cadastro. */
      .limit(1);
    if (error) throw error;
    const empresa = data?.[0];
    /* Sem empresa nenhuma não é "incompleto", é "ainda não cadastrou" — e
       disso cuida o desvio para a tela de cadastro, não este aviso. */
    if (!empresa) return [];
    const falta: string[] = [];
    if (!empresa.photo_url) falta.push("a foto ou logo da empresa");
    if (!empresa.description?.trim()) falta.push("uma descrição do que a empresa faz");
    return falta;
  }

  const { data, error } = await sb
    .from("professionals")
    .select("photo_url, neighborhood, areas_de_interesse, bio, pretensao_centavos, pretensao_combinar, disponibilidade")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return [];

  const falta: string[] = [];
  if (!data.areas_de_interesse?.length) falta.push("as funções que você faz");
  if (!data.photo_url) falta.push("sua foto");
  if (!data.neighborhood?.trim()) falta.push("seu bairro");
  if (!data.disponibilidade?.length) falta.push("seus horários");
  /* "A combinar" é resposta. Sem esta parte o aviso cobraria um valor de
     quem já respondeu que prefere conversar — e voltaria todo dia. */
  if (data.pretensao_centavos == null && !data.pretensao_combinar) {
    falta.push("sua pretensão de salário");
  }
  if (!data.bio?.trim()) falta.push("um resumo sobre você");
  return falta;
}

export function AvisoPerfilIncompleto({ lado }: { lado: Lado }) {
  const { user } = useAuth();
  const [falta, setFalta] = useState<string[]>([]);
  const [dispensado, setDispensado] = useState(false);

  useEffect(() => {
    if (!user) return;
    let valeu = true;
    oQueFalta(lado, user.id)
      .then((lista) => {
        if (valeu) setFalta(lista);
      })
      .catch((err) => {
        /* Falhou a leitura: NÃO mostra aviso nenhum.
           Um aviso de "falta preencher" gerado por erro de rede manda a
           pessoa a um formulário que já está preenchido, e ela desconfia
           do app inteiro. O erro vai para o console de quem for
           investigar, e não para a tela de quem não pode fazer nada. */
        console.warn("[aviso de perfil]", mensagemDeErro(err, "não consegui ler o cadastro"));
        if (valeu) setFalta([]);
      });
    return () => {
      valeu = false;
    };
  }, [user, lado]);

  if (dispensado || falta.length === 0) return null;

  /* Três, no máximo. A lista inteira de seis vira um parágrafo que ninguém
     lê, e o resto continua aparecendo depois que estes forem preenchidos. */
  const mostrados = falta.slice(0, 3);
  const resto = falta.length - mostrados.length;

  return (
    <div className="ei-aviso-perfil" role="status">
      <div className="ei-aviso-perfil-texto">
        <strong>Seu cadastro está pela metade.</strong>{" "}
        Falta {mostrados.join(", ")}
        {resto > 0 ? ` e mais ${resto} ${resto === 1 ? "coisa" : "coisas"}` : ""}.{" "}
        {lado === "company"
          ? "Empresa sem foto e sem descrição recebe menos resposta."
          : "Cadastro completo aparece antes na busca de quem contrata."}
      </div>
      <div className="ei-aviso-perfil-acoes">
        <Link className="ei-btn ei-btn-cheio" to={lado === "company" ? "/cadastro-empresa" : "/painel"}>
          Completar
        </Link>
        <button
          type="button"
          className="ei-aviso-perfil-fechar"
          aria-label="Agora não"
          onClick={() => setDispensado(true)}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
