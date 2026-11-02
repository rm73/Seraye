import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { handleApi } from "./server/handle.mjs";

function serayeApi() {
  return {
    name: "seraye-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();
        try {
          await handleApi(req, res);
        } catch {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ message: "Server gagal memproses permintaan." }));
          }
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serayeApi()],
  server: {
    port: 5175,
    strictPort: true,
  },
});
