import { createServer } from "http";
import { readFile, stat } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = process.env.PORT || 8080;
const distPath = path.join(__dirname, "dist");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    const requestedPath = new URL(req.url, `http://${req.headers.host}`).pathname;
    let filePath = path.join(distPath, requestedPath);

    let fileStat;
    try {
      fileStat = await stat(filePath);
    } catch {
      // If the file isn't found, fall back to the SPA entry point
      filePath = path.join(distPath, "index.html");
      fileStat = await stat(filePath);
    }

    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";

    const content = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch (error) {
    console.error("Error handling request", error);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
