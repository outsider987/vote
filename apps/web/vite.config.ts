import { createReadStream, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Connect, type Plugin } from "vite";

// In dev and preview, /live/* is served straight from the poller's output folder, so rehearsal data never
// lands in public/ or in a production build. On election night the poller publishes results.json itself.
const liveDir = resolve(process.env.VOTE_LIVE_DIR ?? fileURLToPath(new URL("../poller/out", import.meta.url)));

function serveLive(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const file = resolve(liveDir, `.${path}`);
    if (!file.startsWith(liveDir + sep)) return next();
    let size: number;
    try {
      const stat = statSync(file);
      if (!stat.isFile()) return next();
      size = stat.size;
    } catch {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    res.setHeader("Content-Type", file.endsWith(".json") ? "application/json; charset=utf-8" : "application/octet-stream");
    res.setHeader("Content-Length", size);
    res.setHeader("Cache-Control", "no-cache");
    createReadStream(file).pipe(res);
  };
}

const liveDevData = (): Plugin => ({
  name: "vote-live-dev-data",
  configureServer(server) { server.middlewares.use("/live", serveLive()); },
  configurePreviewServer(server) { server.middlewares.use("/live", serveLive()); },
});

export default defineConfig({
  // Relative asset URLs, so the build can be hosted under any path on a static host or CDN.
  base: "./",
  plugins: [liveDevData()],
  build: {
    target: "es2022",
    sourcemap: true,
    // three.js changes far less often than the app, so it gets its own long-cached chunk
    chunkSizeWarningLimit: 700,
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: "three", test: /node_modules[\\/]three[\\/]/ }] } } },
  },
  server: { port: 5188 },
  preview: { port: 4188 },
});
