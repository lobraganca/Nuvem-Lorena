import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { contarClique, contarExibicao, getBannersDaBusca } from "../lib/banners";
import { searchProfessionals } from "../lib/professionals";
import { DEFAULT_CITY, type Banner } from "../types/domain";
import type { ProfessionalWithRating } from "../lib/professionals";
import { Estrelas } from "../components/Estrelas";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { useTituloDaPagina } from "../lib/tituloDaPagina";
import { NOME_PLATAFORMA } from "../config";

/**
 * Tela de anúncios: quem pagou para aparecer.
 *
 * Existe por dois motivos que se sustentam um ao outro.
 *
 * Para quem procura, é uma vitrine — o comércio da cidade reunido, para
 * quando a pessoa não está atrás de um serviço específico e sim "vendo o que
 * tem". A busca serve a quem já sabe o que quer; esta tela serve a quem não
 * sabe, e essa pessoa hoje não tinha para onde ir.
 *
 * Para o app, é estoque de publicidade. Na busca cabe um banner por vez, e
 * com razão: mais que isso vira encarte e afasta quem veio procurar alguém.
 * Aqui todos aparecem, porque aqui é isso que a pessoa veio ver — e é o que
 * permite vender para o oitavo anunciante sem estragar a busca.
 *
 * A honestidade é a mesma dos dois lados: tudo aqui está marcado como
 * publicidade, e o título da tela diz o que é. Uma vitrine que finge ser
 * recomendação vale menos que uma vitrine assumida.
 */
export function AnunciosPage() {
  useTituloDaPagina("Anúncios");
  const [banners, setBanners] = useState<Banner[]>([]);
  const [destaques, setDestaques] = useState<ProfessionalWithRating[]>([]);
  const [carregando, setCarregando] = useState(true);
  const contados = useRef<Set<string>>(new Set());

  useEffect(() => {
    let ativo = true;
    Promise.all([
      getBannersDaBusca(DEFAULT_CITY, ""),
      searchProfessionals({ pageSize: 50 }),
    ]).then(([bs, pros]) => {
      if (!ativo) return;
      setBanners(bs);
      // Só quem pagou pelo destaque. A tela é dos anunciantes; misturar
      // quem não pagou faria o destaque valer menos para quem paga.
      setDestaques(pros.filter((p) => p.boosted).slice(0, 12));
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    for (const b of banners) {
      if (contados.current.has(b.id)) continue;
      contados.current.add(b.id);
      void contarExibicao(b.id);
    }
  }, [banners]);

  const vazio = !carregando && banners.length === 0 && destaques.length === 0;

  return (
    <div className="container" style={{ paddingTop: 28, paddingBottom: 40 }}>
      <h1 style={{ marginBottom: 4 }}>Anúncios</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Comércios e profissionais que pagaram para aparecer aqui. É publicidade — e é assim que o{" "}
        {NOME_PLATAFORMA} se mantém de pé sem cobrar de quem procura.
      </p>

      {carregando && <p className="muted">Carregando…</p>}

      {vazio && (
        <div className="card" style={{ marginTop: 16 }}>
          <strong>Ainda não tem ninguém anunciando.</strong>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Tem um comércio e quer aparecer aqui? Fale com a gente — o espaço é da cidade.
          </p>
        </div>
      )}

      {banners.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <div className="anuncios-lista">
            {banners.map((b) => {
              const miolo = (
                <>
                  <img src={b.imagem_url} alt={b.titulo || b.anunciante} loading="lazy" />
                  <span className="banner-rodape">
                    <span className="banner-selo">Publicidade</span>
                    <span className="banner-anunciante">{b.anunciante}</span>
                  </span>
                </>
              );
              if (!b.link) return <div key={b.id} className="banner-publicidade">{miolo}</div>;
              const aoClicar = () => void contarClique(b.id);
              return b.link.startsWith("/") ? (
                <Link key={b.id} to={b.link} className="banner-publicidade" onClick={aoClicar}>
                  {miolo}
                </Link>
              ) : (
                <a
                  key={b.id}
                  href={b.link}
                  className="banner-publicidade"
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  onClick={aoClicar}
                >
                  {miolo}
                </a>
              );
            })}
          </div>
        </section>
      )}

      {destaques.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: "1.05rem" }}>Profissionais em destaque</h2>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.86rem" }}>
            Anúncios turbinados — quem pagou para aparecer antes na busca.
          </p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {destaques.map((p) => (
              <Link
                key={p.id}
                to={`/profissional/${p.id}`}
                className="card card-pro"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <h3 className="card-nome" style={{ margin: 0 }}>
                  {p.name}
                </h3>
                <p className="muted" style={{ margin: "4px 0" }}>
                  {p.category} · {p.city}
                </p>
                {p.especialidade && <p className="card-especialidade">{p.especialidade}</p>}
                <div className="card-selos">
                  {p.verified && (
                    <span className="badge badge-selo">
                      <VerifiedBadge size={14} /> Premium
                    </span>
                  )}
                  <span className="badge badge-boosted">Destaque</span>
                </div>
                {p.average_rating ? (
                  <p style={{ marginTop: 10 }}>
                    <Estrelas nota={p.average_rating} />{" "}
                    <strong>{p.average_rating.toFixed(1).replace(".", ",")}</strong>
                  </p>
                ) : (
                  <p className="muted card-sem-nota" style={{ marginTop: 10 }}>
                    Novo por aqui
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
