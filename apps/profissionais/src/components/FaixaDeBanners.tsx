import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { contarClique, contarExibicao, getBannersDaBusca } from "../lib/banners";
import { EspacoLivre } from "./EspacoLivre";
import type { Banner } from "../types/domain";

/**
 * Publicidade na tela de busca.
 *
 * Três decisões que valem ser ditas, porque nenhuma é óbvia e todas
 * protegem quem usa o app de quem paga por ele:
 *
 * 1. **A etiqueta "Publicidade" é obrigatória e não some.** Não é enfeite
 *    legal: o CDC (art. 36) exige que a pessoa consiga identificar
 *    publicidade como tal, e um banner que se confunde com resultado de
 *    busca é justamente o que a lei chama de publicidade dissimulada. Além
 *    de ser o que destrói a confiança na busca inteira.
 *
 * 2. **Um por vez, e sorteado.** Com vários anunciantes ativos, mostrar
 *    todos empilhados transformaria a busca em encarte de supermercado. Um
 *    sorteio a cada abertura divide as exibições entre os que pagaram sem
 *    precisar de fila, e sem o primeiro cadastrado levar sempre a melhor.
 *
 * 3. **A contagem é do banco, não daqui.** Só conta o que está no ar (ver
 *    migration 0040): número inflado numa venda para um comércio pequeno é
 *    o tipo de coisa que se descobre e nunca mais se conserta.
 */
export function FaixaDeBanners({ cidade, categoria }: { cidade: string; categoria: string }) {
  const [banner, setBanner] = useState<Banner | null>(null);
  /** Enquanto a busca não volta, "sem banner" e "ainda não sei" são a mesma
      coisa em `banner === null` — e tratá-las igual faria o convite "Apareça
      aqui" piscar por um instante em cima do espaço de quem pagou. */
  const [carregando, setCarregando] = useState(true);
  /** Ids já contados nesta visita: sem isso, rolar a lista contaria de novo. */
  const contados = useRef<Set<string>>(new Set());

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    getBannersDaBusca(cidade, categoria).then((lista) => {
      if (!ativo) return;
      setBanner(lista.length === 0 ? null : lista[Math.floor(Math.random() * lista.length)]);
      setCarregando(false);
    });
    return () => {
      ativo = false;
    };
  }, [cidade, categoria]);

  useEffect(() => {
    if (!banner || contados.current.has(banner.id)) return;
    contados.current.add(banner.id);
    // Sem `await`: contador é informação de venda, e não pode atrasar nem
    // quebrar a tela de quem veio procurar alguém.
    void contarExibicao(banner.id);
  }, [banner]);

  if (carregando) return null;
  // Espaço vazio não some: vira o convite para comprá-lo. Some sozinho no
  // dia em que alguém compra, porque aí `banner` deixa de ser nulo.
  if (!banner) return <EspacoLivre variante="faixa" />;

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
    return <div className="banner-publicidade">{conteudo}</div>;
  }

  const aoClicar = () => void contarClique(banner.id);

  // Link interno (um anúncio do próprio app) navega sem recarregar; externo
  // abre em outra aba, para a pessoa não perder a busca que estava fazendo.
  if (banner.link.startsWith("/")) {
    return (
      <Link to={banner.link} className="banner-publicidade" onClick={aoClicar}>
        {conteudo}
      </Link>
    );
  }

  return (
    <a
      href={banner.link}
      className="banner-publicidade"
      target="_blank"
      // `noopener` impede que a página aberta mexa na aba do app; `nofollow`
      // e `sponsored` dizem ao Google que é link pago, o que evita punição
      // por venda de link.
      rel="noopener noreferrer nofollow sponsored"
      onClick={aoClicar}
    >
      {conteudo}
    </a>
  );
}
