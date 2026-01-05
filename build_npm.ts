import { build, emptyDir } from "jsr:@deno/dnt";
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
    description: "A light fetch wrapper.",
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
  postBuild() {
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
