// Monta o vídeo do anúncio: abre anuncio-tiktok.html, chama quadro(t) 30 vezes por segundo,
// fotografa cada quadro e entrega a sequência ao ffmpeg, que faz o MP4 (H.264, o que o iPhone
// salva na galeria e o TikTok aceita), com uma faixa de áudio muda — a música se põe no TikTok.
//   cd /home/user/Nuvem-Lorena/sites/marca/video && node gerar-video.mjs [saida.mp4] [--quadros 2.5,8.6]
import { execSync, spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(join(execSync("npm root -g").toString().trim(), "playwright", "index.mjs"));
const aqui = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const so = args.includes("--quadros") ? args[args.indexOf("--quadros") + 1].split(",").map(Number) : null;
const saida = args.find((a) => a.endsWith(".mp4")) || join(aqui, "anuncio-tiktok.mp4");
const FPS = 30;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1080, height: 1920 } });
await pagina.goto("file://" + join(aqui, "anuncio-tiktok.html"));
await pagina.waitForLoadState("networkidle");
await pagina.evaluate(() => document.fonts.ready);
const duracao = await pagina.evaluate(() => window.DURACAO);

if (so) { // só alguns quadros, em PNG, para conferir o visual
  for (const t of so) {
    await pagina.evaluate((t) => window.quadro(t), t);
    await pagina.screenshot({ path: join(aqui, `quadro-${t}.png`) });
    console.log("quadro", t);
  }
} else {
  const ffmpeg = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-shortest",
    "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart",
    "-c:a", "aac", "-b:a", "128k", saida], { stdio: ["pipe", "inherit", "inherit"] });
  const total = Math.round(duracao * FPS);
  for (let i = 0; i < total; i++) {
    await pagina.evaluate((t) => window.quadro(t), i / FPS);
    const img = await pagina.screenshot({ type: "jpeg", quality: 95 });
    if (!ffmpeg.stdin.write(img)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
    if (i % 60 === 0) console.log(`quadro ${i}/${total}`);
  }
  ffmpeg.stdin.end();
  await new Promise((r) => ffmpeg.on("close", r));
  console.log("pronto:", saida);
}
await navegador.close();
