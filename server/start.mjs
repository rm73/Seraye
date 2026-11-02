import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { handleApi } from "./handle.mjs";

const dist = path.join(process.cwd(), "dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function safeFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const candidate = path.normalize(path.join(dist, decoded));
  if (!candidate.startsWith(dist)) return "";
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return path.join(dist, "index.html");
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    try {
      await handleApi(req, res);
    } catch {
      res.statusCode = 500;
      res.end("Server gagal memproses permintaan.");
    }
    return;
  }
  const file = safeFile(url.pathname);
  res.statusCode = 200;
  res.setHeader("content-type", types[path.extname(file)] || "application/octet-stream");
  createReadStream(file).pipe(res);
});

const port = Number(process.env.PORT || 80);
server.listen(port, () => {
  console.log(`Seraye listening on ${port}`);
});
