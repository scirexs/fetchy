import { build, emptyDir } from "jsr:@deno/dnt";
import packageInfo from "./deno.json" with { type: "json" };

await emptyDir("./npm");

await build({
  entryPoints: [
    {
      name: "./client",
      path: "./src/client/mod.ts",
    },
    {
      name: "./server",
      path: "./src/server/mod.ts",
    },
  ],
  outDir: "./npm",
  scriptModule: false,
  typeCheck: false,
  declaration: "separate",
  test: false,
  shims: {
    deno: false,
  },
  compilerOptions: {
    lib: ["ES2023"],
    target: "ES2023",
  },
  package: {
    name: "@scirexs/srp6a",
    version: packageInfo.version,
    type: "module",
    sideEffects: false,
    description: "SRP-6a (Secure Remote Password) implementation in TypeScript for browser and server.",
    author: "scirexs",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/scirexs/srp6a.git"
    },
    keywords: [
      "authentication",
      "srp",
      "srp6a",
      "secure-remote-password",
      "typescript",
    ],
    homepage: "https://github.com/scirexs/srp6a#readme",
    bugs: {
      url: "https://github.com/scirexs/srp6a/issues"
    },
  },
  postBuild() {
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});
