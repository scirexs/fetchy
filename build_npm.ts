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
    minify(main);
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});

function removeInternals(path: string) {
  const content = Deno.readTextFileSync(path);
  const lines = content.split("\n");
  lines[0] = "export { fetchy, fetchyb, HTTPStatusError, RedirectError };";
  Deno.writeTextFileSync(path, lines.join("\n"));
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
