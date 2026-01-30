import { build, emptyDir } from "jsr:@deno/dnt";
import * as esbuild from "npm:esbuild@^0.27.2";
import packageInfo from "./deno.json" with { type: "json" };

await emptyDir("./npm");

await build({
  entryPoints: ["./src/mod.ts"],
  outDir: "./npm",
  scriptModule: false,
  typeCheck: false,
  declaration: "separate",
  test: false,
  shims: {
    deno: false,
  },
  compilerOptions: {
    lib: ["ESNext"],
    target: "ES2023",
  },
  package: {
    name: "@scirexs/fetchy",
    version: packageInfo.version,
    type: "module",
    sideEffects: false,
    description: "A lightweight fetch wrapper.",
    author: "scirexs",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/scirexs/fetchy.git"
    },
    keywords: [
      "fetch",
      "fetch-wrapper",
      "fetch-client",
      "request",
      "http",
      "get",
      "url",
      "typescript",
    ],
    homepage: "https://github.com/scirexs/fetchy#readme",
    bugs: {
      url: "https://github.com/scirexs/fetchy/issues"
    },
  },
  async postBuild() {
    const main = "./npm/esm/main.js";
    removeInternals(main);
    replaceInternalName(main);
    minify(main);
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});

function removeInternals(path: string) {
  const content = Deno.readTextFileSync(path);
  const lines = content.split("\n");
  lines[0] = "export { fetchy, fy, HTTPStatusError, setFetchy, sfetchy };"
  Deno.writeTextFileSync(path, lines.join("\n"));
}

function replaceInternalName(path: string) {
  const list: [string, string][] = [
    ["ztimeout","a"],
    ["zjitter","b"],
    ["zinterval","c"],
    ["zmaxInterval","d"],
    ["zmaxAttempts","e"],
    ["zonTimeout","f"],
    ["znoIdempotent","g"],
    ["zstatusCodes","h"],
    ["zrespects","i"],
    ["znative","j"],
    ["zsignal","k"],
    ["zurl","l"],
    ["zbase","m"],
    ["zbody","n"],
  ];
  let content = Deno.readTextFileSync(path);
  for (const [from, to] of list) {
    content = content.replaceAll(from, to);
  }
  Deno.writeTextFileSync(path, content);
}

async function minify(path: string) {
  try {
    const result = await esbuild.build({
      entryPoints: [path],
      write: false,
      minify: true,
      bundle: false,
    });
    await Deno.writeTextFile(path, result.outputFiles[0].text);
  } finally {
    esbuild.stop();
  }
}

