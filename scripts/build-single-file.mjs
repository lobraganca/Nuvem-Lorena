/**
 * Builds one self-contained .html with the whole app inside it.
 *
 * For showing the app to someone without a server: they double-click the file
 * and it opens. Not how the site is deployed — the real build stays split, so
 * the browser can cache the parts that do not change.
 *
 * Everything is inlined: the JavaScript, the stylesheet, the logo and the
 * icons. The only thing still fetched from the network is the map tiles, which
 * come from OpenStreetMap and cannot be bundled.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";

/**
 * `--fragment` emits only the page *contents* — style, root and script — with
 * no doctype, html, head or body. Hosts that wrap the file in their own
 * document skeleton need that; a file opened from disk needs the full one.
 */
const asFragment = process.argv.includes("--fragment");
const OUT = asFragment ? "avena-app-fragment.html" : "avena-app.html";

console.log("Compilando…");
rmSync(DIST, { recursive: true, force: true });
execSync("tsc -b && vite build", {
  stdio: "inherit",
  env: { ...process.env, VITE_SINGLE_FILE: "true" },
});

let html = readFileSync(join(DIST, "index.html"), "utf8");

// Inline the stylesheet.
html = html.replace(
  /<link rel="stylesheet"[^>]*href="\.?\/?([^"]+\.css)"[^>]*>/g,
  (_match, file) => {
    const css = readFileSync(join(DIST, file), "utf8");
    return `<style>\n${css}\n</style>`;
  }
);

// Inline the script.
html = html.replace(
  /<script type="module"[^>]*src="\.?\/?([^"]+\.js)"[^>]*><\/script>/g,
  (_match, file) => {
    const js = readFileSync(join(DIST, file), "utf8");
    // </script> inside a string literal would close the tag early.
    return `<script type="module">\n${js.replace(/<\/script>/g, "<\\/script>")}\n</script>`;
  }
);

// The favicon and the social image are files on the server; as a data URI the
// favicon still works, and the social image is meaningless offline.
const favicon = readFileSync(join(DIST, "favicon.png")).toString("base64");
html = html.replace(
  /<link rel="icon"[^>]*>/,
  `<link rel="icon" type="image/png" href="data:image/png;base64,${favicon}" />`
);
html = html.replace(/<link rel="apple-touch-icon"[^>]*>/, "");
html = html.replace(/<meta property="og:image"[^>]*>/g, "");
html = html.replace(/<meta name="twitter:image"[^>]*>/g, "");
html = html.replace(/<link rel="manifest"[^>]*>/g, "");
html = html.replace(/<link rel="canonical"[^>]*>/g, "");

if (asFragment) {
  // Keep what carries the app, drop the document wrapper the host supplies.
  const styles = [...html.matchAll(/<style>[\s\S]*?<\/style>/g)].map((m) => m[0]);
  const scripts = [...html.matchAll(/<script type="module">[\s\S]*?<\/script>/g)].map(
    (m) => m[0]
  );
  if (styles.length === 0 || scripts.length === 0) {
    throw new Error("Nada para extrair: o CSS ou o JS não foram embutidos.");
  }
  html = [...styles, '<div id="root"></div>', ...scripts].join("\n");
}

writeFileSync(OUT, html);

// Anything still pointing at /assets would be a broken link once the file
// leaves this folder, so it is worth knowing about.
const leftovers = html.match(/(?:src|href)="\.?\/assets\/[^"]+"/g);
if (leftovers) {
  console.warn("\nAtenção: sobraram referências a arquivos externos:", leftovers);
}

const remaining = existsSync(join(DIST, "assets"))
  ? readdirSync(join(DIST, "assets"))
  : [];
const sizeMb = (Buffer.byteLength(html) / (1024 * 1024)).toFixed(1);

console.log(`\n${OUT} — ${sizeMb} MB, tudo embutido.`);
console.log(`Arquivos que ficaram de fora (não são necessários): ${remaining.length}`);
