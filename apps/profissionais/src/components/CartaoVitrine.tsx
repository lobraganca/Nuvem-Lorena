import { Link } from "react-router-dom";
import { isCurrentlyVerified, type ProfessionalWithRating } from "../lib/professionals";
import { VerifiedBadge } from "./VerifiedBadge";
import { corDoNome, iniciais } from "../lib/avatar";

/**
 * O cartão estreito das prateleiras da tela inicial.
 *
 * Não é o cartão da busca (`card-pro`), e não deveria ser: aquele é largo,
 * traz descrição, etiquetas e um convite escrito, porque quem chegou nele já
 * pediu alguma coisa e está comparando. Aqui a pessoa ainda não pediu nada —
 * está passando o olho. Cabe o que se reconhece de relance: a cara, o nome,
 * o ofício e a nota.
 *
 * A foto ocupa o topo inteiro e é quadrada. Quem não mandou foto não fica
 * com um buraco cinza: recebe as iniciais sobre a cor que o próprio nome
 * gera (`corDoNome`), que é o mesmo recurso já usado na busca — um cadastro
 * sem foto continua parecendo um cadastro, não um erro de carregamento.
 */
export function CartaoVitrine({ p }: { p: ProfessionalWithRating }) {
  const verificado = isCurrentlyVerified(p);
  /* O nome é o que a pessoa escolheu, sempre — inclusive para empresa.
     Este cartão mostrava a razão social quando havia uma, e razão social é
     o nome do CNPJ, não o nome do negócio: "M. A. Souza Comércio de
     Alimentos ME" no lugar de "Padaria da Praça". Ninguém procura pelo
     primeiro nem reconhece a padaria por ele. A razão social continua na
     página do cadastro, escrita como o que é — um dado do documento. */
  const nome = p.name;

  return (
    <Link to={`/profissional/${p.id}`} className="cartao-vitrine" role="listitem">
      <span className="cartao-vitrine-foto">
        {p.photo_url ? (
          <img src={p.photo_url} alt="" loading="lazy" />
        ) : (
          <span className="cartao-vitrine-iniciais" style={{ background: corDoNome(nome) }} aria-hidden="true">
            {iniciais(nome)}
          </span>
        )}
        {/* A nota fica sobre a foto, no canto, como nos aplicativos de
            entrega — é o dado que decide o toque, e embaixo do nome ela
            some no meio das outras linhas. Só aparece com avaliação de
            verdade: "0,0" leria como nota ruim, e não como ausência. */}
        {p.average_rating !== null && (
          <span className="cartao-vitrine-nota">
            <span aria-hidden="true">★</span> {p.average_rating.toFixed(1).replace(".", ",")}
          </span>
        )}
      </span>
      <span className="cartao-vitrine-nome">
        {nome}
        {verificado && <VerifiedBadge size={13} />}
      </span>
      <span className="cartao-vitrine-oficio">{p.category}</span>
    </Link>
  );
}
