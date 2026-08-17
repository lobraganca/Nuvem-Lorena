import { Link } from "react-router-dom";
import { isCurrentlyBoosted, isCurrentlyVerified, type ProfessionalWithRating } from "../lib/professionals";
import { corDoNome, iniciais } from "../lib/avatar";
import { cidadeComEstado } from "../types/domain";
import { Estrelas } from "./Estrelas";
import { FavoriteButton } from "./FavoriteButton";
import { VerifiedBadge } from "./VerifiedBadge";

/**
 * O cartão largo — o mesmo em toda tela onde um cadastro aparece inteiro.
 *
 * Este arquivo existe porque o mesmo cartão estava escrito quatro vezes, e
 * as quatro cópias tinham se afastado uma da outra. Na busca, um cadastro
 * sem nota dizia "Novo por aqui — seja o primeiro a avaliar"; nos favoritos,
 * "Sem avaliações", que lê como defeito. Nos favoritos não havia "Em
 * destaque", então quem pagava por ele não o via ali. Na tela de anúncios
 * não havia foto nenhuma — o mesmo profissional aparecia com rosto numa
 * tela e sem rosto na outra.
 *
 * Nada disso foi decidido: aconteceu, uma cópia de cada vez. Cartão
 * duplicado é assim — cada tela conserta o seu e as diferenças só aparecem
 * quando alguém abre as duas telas lado a lado.
 *
 * `previa` é o painel do profissional mostrando ao dono o que o cliente vê.
 * Ali o coração sai: ele é o único controle do cartão que mexe em dado de
 * verdade, e numa prévia o toque favoritaria o próprio dono. O resto fica
 * idêntico, que é o motivo de a prévia existir.
 */
export function CartaoProfissional({
  p,
  favoritado = false,
  previa = false,
  extra,
}: {
  p: ProfessionalWithRating;
  favoritado?: boolean;
  previa?: boolean;
  /* O que cada tela acrescenta ao pé do cartão — hoje só os favoritos, com
     o "Chamar no WhatsApp". Vai dentro do cartão de propósito: precisa ser
     `<button>`, nunca `<a>`. O cartão inteiro já é um link, e link dentro de
     link o navegador "conserta" fechando o cartão antes — o botão escapava
     e virava uma célula própria da grade, o borrão verde gigante no meio
     dos favoritos. */
  extra?: React.ReactNode;
}) {
  const verificado = isCurrentlyVerified(p);
  const destacado = isCurrentlyBoosted(p);

  return (
    <Link
      to={`/profissional/${p.id}`}
      className={`card card-pro ${p.entity_type === "pj" ? "card-pro-pj" : ""}`}
      style={{ textDecoration: "none", color: "inherit" }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "start" }}>
        {p.photo_url ? (
          <img src={p.photo_url} alt="" className="card-foto" />
        ) : (
          /* Iniciais sobre a cor que o próprio nome gera. Cadastro sem foto
             continua parecendo cadastro, e não erro de carregamento. */
          <div className="avatar-iniciais card-foto" style={{ background: corDoNome(p.name) }} aria-hidden="true">
            {iniciais(p.name)}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
            <h3 className="card-nome">{p.name}</h3>
            {!previa && <FavoriteButton professionalId={p.id} initialFavorited={favoritado} />}
          </div>
          <p className="muted" style={{ margin: "4px 0" }}>
            {p.category}
            {(p.categories?.length ?? 0) > 1 && ` +${p.categories.length - 1}`} · {cidadeComEstado(p.city, p.uf)}
          </p>
          {/* A especialidade vem numa linha só dela, e não colada na
              categoria: é o que decide entre dois cadastros do mesmo ofício,
              e emendada no "Dentista · Itabirito" ela viraria mais uma
              palavra numa linha que ninguém termina de ler. */}
          {p.especialidade && <p className="card-especialidade">{p.especialidade}</p>}
          {/* Selo e destaque numa fila própria, embaixo. Ao lado do nome,
              disputavam a mesma linha com o coração e empurravam tudo para
              fora da tela — e o nome, que é o que se lê primeiro, quebrava
              em duas para caber. */}
          <div className="card-selos">
            {verificado && (
              <span className="badge badge-selo">
                <VerifiedBadge size={14} /> Premium
              </span>
            )}
            {destacado && <span className="badge badge-boosted">Em destaque</span>}
            <span className={p.entity_type === "pj" ? "badge badge-entity-pj" : "badge badge-entity-pf"}>
              {p.entity_type === "pj" ? "Empresa" : "Profissional autônomo"}
            </span>
          </div>
          {p.entity_type === "pj" && p.responsible_name && (
            <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.82rem" }}>
              Responsável: {p.responsible_name}
            </p>
          )}
        </div>
      </div>
      <p style={{ marginTop: 10 }}>
        {p.average_rating ? (
          <>
            <Estrelas nota={p.average_rating} />{" "}
            <strong>{p.average_rating.toFixed(1).replace(".", ",")}</strong>{" "}
            <span className="muted">({p.review_count})</span>
          </>
        ) : (
          /* "Sem avaliações" lia como defeito do cadastro. Quem acabou de se
             cadastrar não tem culpa de ainda não ter sido avaliado — e o
             convite ainda serve a quem está lendo. */
          <span className="muted card-sem-nota">Novo por aqui — seja o primeiro a avaliar</span>
        )}
      </p>
      <span className="card-cta">Ver contatos e avaliações →</span>
      {extra}
    </Link>
  );
}
