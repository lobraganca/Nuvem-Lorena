/**
 * Enquadrar a foto antes de enviar.
 *
 * ── O DEFEITO QUE ISTO CONSERTA ────────────────────────────────────────
 *
 * A foto ia direto do celular para o banco, e o app a exibia com
 * `object-fit: cover` num quadrado. Quem escolhia uma foto em pé — que é a
 * foto que todo mundo tem no celular — via o corte que o navegador decidiu:
 * o meio da imagem. Numa selfie de corpo inteiro isso é a barriga; num
 * cartaz de loja, o meio do texto. A pessoa não tinha o que fazer além de
 * tirar outra foto.
 *
 * A dona: "ter opção de ajustar a foto pra ficar bem enquadrada em ambos os
 * casos, empresa e profissional".
 *
 * ── COMO FUNCIONA ──────────────────────────────────────────────────────
 *
 * Uma janela com a foto dentro de uma moldura quadrada: arrasta com o dedo
 * para escolher o pedaço, e a barrinha aproxima. O que sai é um JPEG
 * quadrado de 512px, já cortado — ou seja, o corte é decidido AQUI e
 * gravado no arquivo, em vez de ficar por conta de cada tela que exibe a
 * foto depois. Uma foto, um enquadramento, todas as telas iguais.
 *
 * ── TRÊS DECISÕES QUE PARECEM DETALHE ──────────────────────────────────
 *
 * 1. A imagem NUNCA descola da moldura. O arrasto é limitado para a foto
 *    sempre cobrir o quadrado inteiro — sem isso é fácil deixar uma tira
 *    branca na borda e só descobrir depois de salvar.
 * 2. A moldura mostra um círculo por cima quando a foto é de pessoa,
 *    porque é assim que ela aparece na lista. Enquadrar num quadrado e ver
 *    redondo depois corta a testa de quem centralizou o rosto.
 * 3. `touch-action: none` no palco. Sem isso o navegador do Android
 *    entende o arrasto como rolagem da página e a foto não anda —
 *    o controle parece quebrado sem dar erro nenhum.
 */
import { useEffect, useRef, useState } from "react";

const LADO_SAIDA = 512;
const LADO_PALCO = 264;

type Props = {
  /** O arquivo escolhido no seletor. */
  arquivo: File;
  /** Círculo por cima da moldura: foto de pessoa. */
  redondo?: boolean;
  /** Recebe o recorte pronto, já quadrado. */
  aoConfirmar: (recortada: File) => void;
  aoCancelar: () => void;
};

export function AjustarFoto({ arquivo, redondo = false, aoConfirmar, aoCancelar }: Props) {
  const [imagem, setImagem] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [erro, setErro] = useState("");
  const arrastando = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      setImagem(img);
      setZoom(1);
      setPos({ x: 0, y: 0 });
    };
    img.onerror = () => setErro("Não consegui abrir essa imagem.");
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  /* A escala em que a foto COBRE a moldura. É a base: zoom 1 é a foto
     inteira preenchendo o quadrado, sem sobra. */
  const escalaBase = imagem
    ? LADO_PALCO / Math.min(imagem.naturalWidth, imagem.naturalHeight)
    : 1;
  const escala = escalaBase * zoom;
  const largura = imagem ? imagem.naturalWidth * escala : 0;
  const altura = imagem ? imagem.naturalHeight * escala : 0;

  /** Impede que a foto descole da moldura em qualquer direção. */
  function limitar(p: { x: number; y: number }) {
    const folgaX = Math.max(0, (largura - LADO_PALCO) / 2);
    const folgaY = Math.max(0, (altura - LADO_PALCO) / 2);
    return {
      x: Math.min(folgaX, Math.max(-folgaX, p.x)),
      y: Math.min(folgaY, Math.max(-folgaY, p.y)),
    };
  }

  useEffect(() => {
    setPos((p) => limitar(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, imagem]);

  function comecarArrasto(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arrastando.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }
  function arrastar(e: React.PointerEvent) {
    if (!arrastando.current) return;
    setPos(limitar({ x: e.clientX - arrastando.current.x, y: e.clientY - arrastando.current.y }));
  }
  function soltar() {
    arrastando.current = null;
  }

  function confirmar() {
    if (!imagem) return;
    const canvas = document.createElement("canvas");
    canvas.width = LADO_SAIDA;
    canvas.height = LADO_SAIDA;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setErro("Este navegador não conseguiu cortar a imagem.");
      return;
    }

    /* Do palco para a foto original: o pedaço visível da moldura, medido
       em pixels da imagem. `pos` é o deslocamento do CENTRO, por isso o
       meio da imagem entra na conta. */
    const ladoNaFoto = LADO_PALCO / escala;
    const centroX = imagem.naturalWidth / 2 - pos.x / escala;
    const centroY = imagem.naturalHeight / 2 - pos.y / escala;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, LADO_SAIDA, LADO_SAIDA);
    ctx.drawImage(
      imagem,
      centroX - ladoNaFoto / 2,
      centroY - ladoNaFoto / 2,
      ladoNaFoto,
      ladoNaFoto,
      0,
      0,
      LADO_SAIDA,
      LADO_SAIDA,
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErro("Não consegui gerar a foto cortada.");
          return;
        }
        const nome = arquivo.name.replace(/\.[^.]+$/, "") + ".jpg";
        aoConfirmar(new File([blob], nome, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <div className="ei-folha-fundo" role="dialog" aria-modal="true" aria-label="Ajustar a foto">
      <div className="ei-folha">
        <h2 className="ei-etapa-titulo">Ajuste a foto</h2>
        <p className="ei-etapa-apoio">Arraste para escolher o pedaço e use a barra para aproximar.</p>

        {erro && <p className="ei-campo-erro" role="alert">{erro}</p>}

        <div
          className={`ei-palco${redondo ? " ei-palco-redondo" : ""}`}
          onPointerDown={comecarArrasto}
          onPointerMove={arrastar}
          onPointerUp={soltar}
          onPointerCancel={soltar}
        >
          {imagem && (
            <img
              src={imagem.src}
              alt=""
              draggable={false}
              style={{
                width: largura,
                height: altura,
                transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
              }}
            />
          )}
        </div>

        <label className="ei-campo">
          <span>Aproximar</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
        </label>

        <div className="ei-pe-etapas">
          <button className="ei-btn ei-btn-cheio" onClick={confirmar} disabled={!imagem}>
            Usar esta foto
          </button>
          <button className="ei-btn ei-btn-contorno" onClick={aoCancelar}>
            Escolher outra
          </button>
        </div>
      </div>
    </div>
  );
}
