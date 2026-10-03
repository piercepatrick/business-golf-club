const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT) || 3000;
const root = __dirname;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";

  const file = path.resolve(root, `.${pathname}`);
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
    });
    res.end(data);
  });
});

server.listen(port, () => {
  console.log(`Site running at http://localhost:${port}`);
});
