import * as esbuild from "esbuild";
import { copyFile } from "node:fs/promises";

const development = process.argv.includes("--dev");

async function main() {
  const context = await esbuild.context({
    entryPoints: ["src/main.tsx"],
    bundle: true,
    outdir: "dist",
    entryNames: "main",
    jsx: "automatic",
    loader: { ".css": "local-css" },
    platform: "browser",
    target: ["es2022"],
    sourcemap: development,
    minify: !development,
    define: {
      __SUPABASE_URL__: JSON.stringify(process.env.SUPABASE_URL ?? ""),
      __SUPABASE_PUBLISHABLE_KEY__: JSON.stringify(
        process.env.SUPABASE_PUBLISHABLE_KEY ?? "",
      ),
    },
  });

  if (!development) {
    await context.rebuild();
    await copyFile("index.html", "dist/index.html");
    await context.dispose();
    return;
  }

  await context.rebuild();
  await copyFile("index.html", "dist/index.html");
  await context.watch();
  const server = await context.serve({
    servedir: "dist",
    host: "127.0.0.1",
    port: 3000,
  });
  console.log(`Development server running at http://127.0.0.1:${server.port}`);

  const stop = async () => {
    await context.dispose();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

main().catch((error) => {
  console.error("Build failed:", error);
  process.exitCode = 1;
});
