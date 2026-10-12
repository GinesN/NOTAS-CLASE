// A static-only server that reproduces the /NOTAS-CLASE/ Pages path for smoke tests.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist-pages");
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    if (!url.pathname.startsWith("/NOTAS-CLASE/")) {
      response.writeHead(404);
      response.end();
      return;
    }
    const pathname = decodeURIComponent(
      url.pathname.slice("/NOTAS-CLASE/".length),
    );
    const file = resolve(root, pathname || "index.html");
    if (!file.startsWith(root + sep)) {
      response.writeHead(404);
      response.end();
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
}).listen(4182, "127.0.0.1");
