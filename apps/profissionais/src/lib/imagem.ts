/**
 * Reduz a foto no próprio navegador, antes de enviar.
 *
 * A foto que sai de um celular tem 4000 pixels de largura e 5 a 8 MB. No
 * cadastro ela aparece com 96 pixels. Enviar o original é gastar minutos de
 * 4G — e é aí que a pessoa desiste do cadastro achando que o app travou,
 * porque nada na tela diz que ainda está subindo.
 *
 * 1024px de lado maior é o suficiente para a foto continuar nítida em tela
 * cheia de celular, e derruba o arquivo para algo entre 100 e 300 KB.
 *
 * Se qualquer passo falhar (navegador antigo, imagem corrompida, arquivo que
 * não é imagem de verdade), devolve o arquivo original: cadastro lento é
 * ruim, cadastro impossível é pior.
 */
const LADO_MAXIMO = 1024;
const QUALIDADE = 0.82;

export async function comprimirImagem(arquivo: File): Promise<File> {
  if (!arquivo.type.startsWith("image/")) return arquivo;
  // PNG com transparência (logo de empresa) perde o fundo ao virar JPEG.
  // Arquivo pequeno também não compensa reprocessar.
  if (arquivo.type === "image/png" && arquivo.size < 500 * 1024) return arquivo;

  try {
    const bitmap = await criarBitmap(arquivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));

    // Já é pequena o bastante e leve: não há o que ganhar.
    if (escala === 1 && arquivo.size < 400 * 1024) return arquivo;

    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.drawImage(bitmap, 0, 0, largura, altura);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALIDADE)
    );
    if (!blob) return arquivo;
    // Comprimir e piorar acontece com imagens já otimizadas — nesse caso o
    // original é o melhor arquivo disponível.
    if (blob.size >= arquivo.size) return arquivo;

    const nome = arquivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return arquivo;
  }
}

async function criarBitmap(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  // `createImageBitmap` já respeita a orientação EXIF; sem isso, foto tirada
  // de lado sobe deitada.
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
