// Baut dist/orgamorph.html: esbuild (IIFE) + CSS inline + CSP-Hash. Kein Server.
import { createHash } from "node:crypto";
import { watch as fsWatch, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const watch = process.argv.includes("--watch");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const CSS_FILES = ["tokens.css", "base.css", "app.css", "print.css"];
const SIZE_LIMIT = 400 * 1024;

/** @param {string} js */
function assemble(js) {
  // "</script" darf im Inline-Skript nicht vorkommen, sonst endet das Element vorzeitig.
  const script = js.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
  const css = CSS_FILES.map((f) => readFileSync(join(root, "src/styles", f), "utf8")).join("\n");
  const hash = createHash("sha256").update(script, "utf8").digest("base64");
  const csp = [
    "default-src 'none'",
    `script-src 'sha256-${hash}'`,
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
  const template = readFileSync(join(root, "src/index.html"), "utf8");
  const html = template
    .replace("{{CSP}}", csp)
    .replace("{{VERSION}}", pkg.version)
    .replace("{{BUILD_DATE}}", new Date().toISOString().slice(0, 10))
    .replace("/*{{CSS}}*/", () => css)
    .replace("/*{{JS}}*/", () => script);
  if (html.includes("{{")) throw new Error("Unersetzter Platzhalter in src/index.html");
  mkdirSync(join(root, "dist"), { recursive: true });
  writeFileSync(join(root, "dist/orgamorph.html"), html);
  const size = Buffer.byteLength(html);
  const kb = (size / 1024).toFixed(1);
  if (size > SIZE_LIMIT) console.warn(`WARNUNG: dist/orgamorph.html ist ${kb} kB (Grenze 400 kB)`);
  else console.log(`dist/orgamorph.html  ${kb} kB`);
}

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: [join(root, "src/main.tsx")],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["chrome110", "firefox115", "safari16"],
  minify: !watch,
  legalComments: "none",
  jsx: "automatic",
  jsxImportSource: "preact",
  charset: "utf8",
  define: {
    __VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  logLevel: "warning",
};

if (watch) {
  const ctx = await esbuild.context({
    ...options,
    plugins: [
      {
        name: "assemble",
        setup(build) {
          build.onEnd((result) => {
            if (result.errors.length) return;
            try {
              assemble(result.outputFiles?.[0]?.text ?? "");
            } catch (e) {
              console.error(e);
            }
          });
        },
      },
    ],
  });
  await ctx.watch();
  // CSS wird nicht von esbuild verarbeitet: Änderungen lösen einen Rebuild aus.
  fsWatch(join(root, "src/styles"), () => ctx.rebuild().catch(() => {}));
  console.log("Beobachte src/ … (Strg+C beendet)");
} else {
  const result = await esbuild.build(options);
  assemble(result.outputFiles?.[0]?.text ?? "");
}
