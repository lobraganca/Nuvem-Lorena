import { useEffect } from "react";
import { Link } from "react-router-dom";
import { contarClique, contarExibicao } from "../lib/banners";
import type { Banner } from "../types/domain";

/**
 * Um lugar vendido dentro da lista "Tem gente boa aqui do lado" — a arte
 * da empresa no lugar do texto explicativo, mas com o mesmo tamanho de
 * cartão dos vizinhos, para não parecer um anúncio colado por cima e sim
 * um lugar da lista que foi comprado.
 *
 * A etiqueta "Publicidade" segue a mesma regra da faixa da busca (CDC art.
 * 36): tem que dar para reconhecer que é publicidade sem precisar clicar.
 */
export function CardPatrocinado({ banner }: { banner: Banner }) {
  // Uma vez por montagem — o pai só monta este componente quando já decidiu
  // mostrar o banner, então montar É a exibição. Sem isto num ref de
  // callback (a primeira versão), a contagem repetiria a cada
  // re-renderização do pai, não só quando o banner de fato aparece.
  useEffect(() => {
    void contarExibicao(banner.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner.id]);

  const conteudo = (
    <>
      <img src={banner.imagem_url} alt={banner.titulo || banner.anunciante} loading="lazy" />
      <span className="banner-rodape">
        <span className="banner-selo">Publicidade</span>
        <span className="banner-anunciante">{banner.anunciante}</span>
      </span>
    </>
  );

  if (!banner.link) {
    return <div className="card welcome-feature-card welcome-ad-card banner-publicidade">{conteudo}</div>;
  }

  const aoClicar = () => void contarClique(banner.id);

  if (banner.link.startsWith("/")) {
    return (
      <Link to={banner.link} className="card welcome-feature-card welcome-ad-card banner-publicidade" onClick={aoClicar}>
        {conteudo}
      </Link>
    );
  }

  return (
    <a
      href={banner.link}
      className="card welcome-feature-card welcome-ad-card banner-publicidade"
      target="_blank"
      rel="noopener noreferrer nofollow sponsored"
      onClick={aoClicar}
    >
      {conteudo}
    </a>
  );
}
