import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const [root, port] = process.argv.slice(2);
if (!root || !port) {
  console.error("usage: node serve.mjs <dir> <port>");
  process.exit(2);
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".md": "text/markdown; charset=utf-8",
};
const base = path.resolve(root);

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(base, urlPath);
    if (!file.startsWith(base)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    fs.readFile(file, (error, data) => {
      if (error) {
        res.writeHead(404).end(`not found: ${urlPath}`);
        return;
      }
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file)] || "application/octet-stream",
        "cache-control": "no-cache",
      });
      res.end(data);
    });
  })
  .listen(Number(port), "127.0.0.1", () => console.log(`serving ${base} on http://127.0.0.1:${port}`));
