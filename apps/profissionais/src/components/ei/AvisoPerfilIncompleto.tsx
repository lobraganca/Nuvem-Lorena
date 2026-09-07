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
 *
 * ── E ELE NÃO CHAMA O CADASTRO DE INCOMPLETO — 07/09 ───────────────────
 *
 * A dona: "tá aparecendo o aviso de cadastro incompleto quando não está."
 *
 * Do lado da empresa, as duas coisas que ele cobra — foto e descrição —
 * estão escritas no formulário como "Logo (opcional)" e "Sobre a empresa
 * (opcional)". Chamar de "pela metade" um cadastro em que a pessoa
 * preencheu tudo o que foi pedido é o app se contradizendo, e quem lê tem
 * razão em achar que ele está errado.
 *
 * A informação continua valendo; o que mudou é o que o aviso AFIRMA. Ele
 * deixou de dizer que falta alguma coisa e passou a dizer o que se ganha —
 * "sua vaga rende mais com isto". Uma frase é falsa e acusa; a outra é
 * verdadeira e convida. Ver o texto lá embaixo.
 *
 * Do lado de quem procura trabalho a palavra continua: ali os campos são
 * pedidos de verdade, e sem função marcada nenhuma vaga encontra a pessoa.
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
    /* Escritos para caber na frase "Empresa com ___ recebe mais
       resposta" — antes eram "a foto ou logo da empresa" e "uma descrição
       do que a empresa faz", que vinham de um texto começado por "Falta"
       e, na frase nova, repetiam a palavra empresa três vezes. */
    const falta: string[] = [];
    if (!empresa.photo_url) falta.push("foto ou logo");
    if (!empresa.description?.trim()) falta.push("uma descrição do que faz");
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
  /* "a, b e c" — e não "a, b, c". A vírgula no lugar do "e" faz a frase
     parecer cortada no meio, e esta é lida de relance. */
  const lista =
    mostrados.length <= 1
      ? mostrados.join("")
      : `${mostrados.slice(0, -1).join(", ")} e ${mostrados[mostrados.length - 1]}`;

  return (
    <div className="ei-aviso-perfil" role="status">
      {/* ── DEIXOU DE DIZER QUE O CADASTRO ESTÁ ERRADO — 07/09 ────────
          A dona: "tá aparecendo o aviso de cadastro incompleto quando não
          está."

          Ela tinha razão, e a contradição era do app: o formulário escreve
          "Logo (opcional)" e "Sobre a empresa (opcional)", e depois este
          aviso chamava o cadastro de "pela metade" por causa dessas mesmas
          duas coisas. Ou é opcional, ou está faltando — as duas ao mesmo
          tempo é o app se contradizendo na cara de quem acabou de
          preencher tudo o que foi pedido.

          O aviso continua existindo porque a informação continua valendo:
          foto e descrição são o que quem procura trabalho olha antes de
          responder a uma vaga de nome desconhecido. O que muda é o que ele
          AFIRMA. Não "está pela metade" (que é falso e soa como defeito),
          e sim "isto aqui te ajuda" — que é verdade e não acusa ninguém. */}
      <div className="ei-aviso-perfil-texto">
        {lado === "company" ? (
          <>
            <strong>Sua vaga rende mais com isto.</strong>{" "}
            Empresa com {lista}
            {resto > 0 ? ` e mais ${resto} ${resto === 1 ? "coisa" : "coisas"}` : ""}{" "}
            recebe mais resposta — quem procura trabalho olha isso antes de
            responder a um nome que não conhece.
          </>
        ) : (
          <>
            <strong>Você aparece mais com isto.</strong>{" "}
            Falta {lista}
            {resto > 0 ? ` e mais ${resto} ${resto === 1 ? "coisa" : "coisas"}` : ""}.{" "}
            Cadastro completo aparece antes na busca de quem contrata.
          </>
        )}
      </div>
      <div className="ei-aviso-perfil-acoes">
        {/* "Completar" dizia, de novo, que havia algo incompleto. */}
        <Link className="ei-btn ei-btn-cheio" to={lado === "company" ? "/cadastro-empresa" : "/painel"}>
          {lado === "company" ? "Melhorar" : "Completar"}
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
