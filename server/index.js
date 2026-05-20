import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addFeedback, getDashboard, getFeedback, importFeedbacks, listFeedbacks } from "./store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const port = globalThis.process?.env?.PORT ?? 4000;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const resolved = path.resolve(rootDir, `.${pathname}`);

  if (!resolved.startsWith(rootDir)) {
    sendJson(response, 403, { message: "Acesso negado" });
    return;
  }

  try {
    const file = await fs.readFile(resolved);
    const type = contentTypes[path.extname(resolved)] ?? "application/octet-stream";
    response.writeHead(200, { "Content-Type": type });
    response.end(file);
  } catch {
    const fallback = await fs.readFile(path.join(rootDir, "index.html"));
    response.writeHead(200, { "Content-Type": contentTypes[".html"] });
    response.end(fallback);
  }
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/feedbacks") {
    sendJson(response, 200, listFeedbacks());
    return;
  }

  if (request.method === "GET" && parts[0] === "api" && parts[1] === "feedbacks" && parts[2]) {
    const feedback = getFeedback(parts[2]);
    sendJson(response, feedback ? 200 : 404, feedback ?? { message: "Feedback nao encontrado" });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/feedbacks") {
    const body = await readBody(request);
    if (!body.text?.trim()) {
      sendJson(response, 400, { message: "O texto do feedback e obrigatorio" });
      return;
    }
    sendJson(response, 201, addFeedback(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/feedbacks/import") {
    const body = await readBody(request);
    if (!Array.isArray(body.items)) {
      sendJson(response, 400, { message: "Envie items como uma lista de feedbacks" });
      return;
    }
    sendJson(response, 201, importFeedbacks(body.items));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/dashboard") {
    sendJson(response, 200, getDashboard());
    return;
  }

  sendJson(response, 404, { message: "Rota nao encontrada" });
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.url.startsWith("/api/")) {
      await handleApi(request, response);
      return;
    }
    await serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { message: error.message });
  }
});

server.listen(port, () => {
  console.log(`AI Feedback Intelligence rodando em http://localhost:${port}`);
});
