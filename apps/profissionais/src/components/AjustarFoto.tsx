import { useCallback, useEffect, useRef, useState } from "react";
import { BottomSheet } from "./BottomSheet";

/**
 * Enquadrar a foto antes de enviar.
 *
 * O cartão mostra a foto num quadrado com `object-fit: cover`, ou seja: o
 * navegador corta pelo centro e ninguém é consultado. Foto de corpo inteiro
 * virava um pedaço de camisa; foto tirada de lado perdia metade do rosto. E
 * como a foto é obrigatória para publicar, quem não gostou do corte só tinha
 * a saída de sair do app, cortar em outro aplicativo e voltar.
 *
 * Aqui a pessoa arrasta para escolher o pedaço e usa a barra para aproximar.
 * O que ela vê é literalmente o que vai ser gravado: a moldura é do mesmo
 * tamanho e do mesmo raio do cartão.
 *
 * Desenho e exportação partem do MESMO canvas e da mesma conta. Fossem dois
 * caminhos — um `<img>` com `transform` para ver, um canvas para gravar —,
 * qualquer diferença de arredondamento entre eles apareceria como "cortou
 * diferente do que eu vi", que é o defeito mais difícil de acreditar quando
 * alguém relata.
 */

/** Lado do arquivo gravado. Acima disso é peso sem ganho: o maior uso é a
 *  foto do perfil, que aparece com 96px de lado numa tela de celular. */
const LADO_SAIDA = 512;
/** Aproximação máxima. Passando disso, foto de celular já mostra o grão. */
const ZOOM_MAXIMO = 3;

export function AjustarFoto({
  arquivo,
  titulo = "Enquadre sua foto",
  onCancelar,
  onPronto,
}: {
  arquivo: File;
  titulo?: string;
  onCancelar: () => void;
  onPronto: (recortada: File) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const molduraRef = useRef<HTMLDivElement>(null);
  const imagemRef = useRef<ImageBitmap | HTMLImageElement | null>(null);
  const [pronta, setPronta] = useState(false);
  const [erro, setErro] = useState("");
  const [zoom, setZoom] = useState(1);
  /** Canto superior esquerdo da imagem, em pixels da moldura. */
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const arraste = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  /** Lado da moldura em pixels de CSS — medido, porque depende da largura da tela. */
  const [lado, setLado] = useState(280);

  /* A moldura mede a si mesma e continua medindo: a largura vem de
     `min(280px, 72vw)`, então girar o celular muda o lado. Medir uma vez só
     deixaria o valor velho, e o recorte final — que divide por ele — sairia
     diferente do que a pessoa enquadrou na tela. */
  useEffect(() => {
    const el = molduraRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const l = Math.round(el.getBoundingClientRect().width);
      if (l > 0) setLado((atual) => (l === atual ? atual : l));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [pronta]);

  useEffect(() => {
    let vivo = true;
    carregar(arquivo)
      .then((img) => {
        if (!vivo) return;
        imagemRef.current = img;
        setPronta(true);
      })
      .catch(() => {
        if (vivo) setErro("Não foi possível abrir esta imagem. Tente outra.");
      });
    return () => {
      vivo = false;
    };
  }, [arquivo]);

  /** Escala que faz a imagem cobrir a moldura inteira, antes do zoom. */
  const escalaBase = useCallback(() => {
    const img = imagemRef.current;
    if (!img) return 1;
    return Math.max(lado / img.width, lado / img.height);
  }, [lado]);

  /* A imagem nunca pode "descolar" da moldura: sem este limite dá para
     arrastar até sobrar tarja branca, e o recorte sairia com um pedaço
     vazio que a pessoa não pediu. */
  const limitar = useCallback(
    (p: { x: number; y: number }, z: number) => {
      const img = imagemRef.current;
      if (!img) return p;
      const escala = escalaBase() * z;
      const largura = img.width * escala;
      const altura = img.height * escala;
      return {
        x: Math.min(0, Math.max(lado - largura, p.x)),
        y: Math.min(0, Math.max(lado - altura, p.y)),
      };
    },
    [escalaBase, lado]
  );

  // Centraliza ao abrir e sempre que a moldura mudar de tamanho.
  useEffect(() => {
    const img = imagemRef.current;
    if (!pronta || !img) return;
    const escala = escalaBase();
    setZoom(1);
    setPos({ x: (lado - img.width * escala) / 2, y: (lado - img.height * escala) / 2 });
  }, [pronta, lado, escalaBase]);

  // Redesenha a cada mudança de posição ou zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imagemRef.current;
    if (!canvas || !img || !pronta) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = lado * dpr;
    canvas.height = lado * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, lado, lado);
    const escala = escalaBase() * zoom;
    ctx.drawImage(img, pos.x, pos.y, img.width * escala, img.height * escala);
  }, [pos, zoom, pronta, lado, escalaBase]);

  function aoSoltar() {
    arraste.current = null;
  }

  function aoPegar(clientX: number, clientY: number) {
    arraste.current = { x: clientX, y: clientY, px: pos.x, py: pos.y };
  }

  function aoMover(clientX: number, clientY: number) {
    const a = arraste.current;
    if (!a) return;
    setPos(limitar({ x: a.px + (clientX - a.x), y: a.py + (clientY - a.y) }, zoom));
  }

  function mudarZoom(novo: number) {
    const img = imagemRef.current;
    if (!img) return;
    /* Aproxima pelo centro da moldura, e não pelo canto: aproximando pelo
       canto o rosto escapa para fora e a pessoa precisa reposicionar a cada
       toque na barra. */
    const antes = escalaBase() * zoom;
    const depois = escalaBase() * novo;
    const centroX = (lado / 2 - pos.x) / antes;
    const centroY = (lado / 2 - pos.y) / antes;
    setZoom(novo);
    setPos(limitar({ x: lado / 2 - centroX * depois, y: lado / 2 - centroY * depois }, novo));
  }

  async function confirmar() {
    const img = imagemRef.current;
    if (!img) return;
    const escala = escalaBase() * zoom;
    const saida = document.createElement("canvas");
    saida.width = LADO_SAIDA;
    saida.height = LADO_SAIDA;
    const ctx = saida.getContext("2d");
    if (!ctx) return onCancelar();

    /* O pedaço da imagem original que está sob a moldura. Dividir por
       `escala` converte de pixels de tela para pixels da imagem. */
    const origemX = -pos.x / escala;
    const origemY = -pos.y / escala;
    const origemLado = lado / escala;
    ctx.drawImage(img, origemX, origemY, origemLado, origemLado, 0, 0, LADO_SAIDA, LADO_SAIDA);

    const blob = await new Promise<Blob | null>((r) => saida.toBlob(r, "image/jpeg", 0.86));
    if (!blob) return onCancelar();
    const nome = arquivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    onPronto(new File([blob], nome, { type: "image/jpeg", lastModified: Date.now() }));
  }

  return (
    <BottomSheet
      title={titulo}
      subtitle="Arraste para escolher o pedaço e use a barra para aproximar."
      onClose={onCancelar}
    >
      {erro ? (
        <p className="form-erro">{erro}</p>
      ) : (
        <div className="ajustar-foto">
          <div
            className="ajustar-moldura"
            ref={molduraRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              aoPegar(e.clientX, e.clientY);
            }}
            onPointerMove={(e) => aoMover(e.clientX, e.clientY)}
            onPointerUp={aoSoltar}
            onPointerCancel={aoSoltar}
          >
            <canvas ref={canvasRef} style={{ width: lado, height: lado, display: "block" }} />
          </div>

          <label className="ajustar-zoom">
            <span className="muted">Aproximar</span>
            <input
              type="range"
              min={1}
              max={ZOOM_MAXIMO}
              step={0.01}
              value={zoom}
              onChange={(e) => mudarZoom(Number(e.target.value))}
            />
          </label>

          <div className="ajustar-acoes">
            <button type="button" className="btn btn-outline" onClick={onCancelar}>
              Trocar de foto
            </button>
            <button type="button" className="btn btn-primary" onClick={confirmar} disabled={!pronta}>
              Usar esta foto
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

/** `imageOrientation` é o que impede foto tirada de lado de abrir deitada —
 *  mesma razão de `lib/imagem.ts`. */
async function carregar(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    return await createImageBitmap(arquivo, { imageOrientation: "from-image" } as ImageBitmapOptions);
  }
  const url = URL.createObjectURL(arquivo);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
