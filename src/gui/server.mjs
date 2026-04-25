import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAnalysis } from "../analyze/runAnalysis.mjs";
import { resolveGitRepoPath, runGitCommand } from "../git/collectRepoData.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const modulePath = fileURLToPath(import.meta.url);
const defaultPort = Number(process.env.PORT || 4731);
const portArgIndex = process.argv.indexOf("--port");
const port = portArgIndex >= 0
  ? Number(process.argv[portArgIndex + 1])
  : defaultPort;

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;

      if (raw.length > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });

    request.on("error", reject);
  });
}

function normalizeAnalysisOptions(body = {}) {
  return {
    repo: body.repo,
    from: body.from || undefined,
    to: body.to || undefined,
    depth: body.depth || "level_1",
    mode: body.mode || "project_health_review",
    format: "json",
    maxCommits: body.maxCommits || "50",
    limit: body.limit || "8"
  };
}

function getBrowseRoot(inputPath) {
  if (inputPath) {
    return path.resolve(inputPath);
  }

  return process.cwd();
}

function isGitRepo(directoryPath) {
  return fs.existsSync(path.join(directoryPath, ".git"));
}

function resolveGitRoot(inputPath) {
  const repoPath = resolveGitRepoPath(inputPath);
  return runGitCommand(repoPath, "rev-parse --show-toplevel");
}

function getRepoLabel(repoPath) {
  const packageJsonPath = path.join(repoPath, "package.json");

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

      if (typeof packageJson.name === "string" && packageJson.name.trim()) {
        return packageJson.name.trim();
      }
    } catch {
      // Fall back to folder name below.
    }
  }

  return path.basename(repoPath);
}

export function getRepoInfo(inputPath) {
  const repoPath = resolveGitRoot(getBrowseRoot(inputPath));

  return {
    path: repoPath,
    label: getRepoLabel(repoPath)
  };
}

function browseDirectory(inputPath) {
  const currentPath = getBrowseRoot(inputPath);

  if (!fs.existsSync(currentPath)) {
    throw new Error(`Folder does not exist: ${currentPath}`);
  }

  const stat = fs.statSync(currentPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a folder: ${currentPath}`);
  }

  const parentPath = path.dirname(currentPath);
  const entries = fs.readdirSync(currentPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => {
      const absolutePath = path.join(currentPath, entry.name);
      return {
        name: entry.name,
        path: absolutePath,
        isGitRepo: isGitRepo(absolutePath)
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 300);

  return {
    path: currentPath,
    parent: parentPath === currentPath ? null : parentPath,
    isGitRepo: isGitRepo(currentPath),
    entries
  };
}

export function resolvePublicPath(requestPath) {
  const requestedPath = requestPath === "/"
    ? "/index.html"
    : decodeURIComponent(requestPath);
  const absolutePath = path.resolve(publicDir, `.${requestedPath}`);
  const relativePath = path.relative(publicDir, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return absolutePath;
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const absolutePath = resolvePublicPath(requestUrl.pathname);

  if (!absolutePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(absolutePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const contentType = MIME_TYPES.get(path.extname(absolutePath)) ||
      "application/octet-stream";
    response.writeHead(200, { "content-type": contentType });
    response.end(content);
  });
}

export const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && requestUrl.pathname === "/api/defaults") {
    const repoInfo = getRepoInfo(process.cwd());
    sendJson(response, 200, {
      repo: repoInfo.path,
      repoLabel: repoInfo.label,
      modes: [
        "project_health_review",
        "feature_timeline",
        "change_interpretation",
        "paired_session"
      ]
    });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/repo-info") {
    try {
      sendJson(response, 200, getRepoInfo(requestUrl.searchParams.get("path")));
    } catch (error) {
      sendJson(response, 400, {
        error: error.message
      });
    }
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/browse") {
    try {
      sendJson(response, 200, browseDirectory(requestUrl.searchParams.get("path")));
    } catch (error) {
      sendJson(response, 400, {
        error: error.message
      });
    }
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/analyze") {
    try {
      const body = await readRequestBody(request);
      const output = runAnalysis(normalizeAnalysisOptions(body));
      sendJson(response, 200, output);
    } catch (error) {
      sendJson(response, 400, {
        error: error.message
      });
    }
    return;
  }

  if (request.method === "GET") {
    serveStatic(request, response);
    return;
  }

  response.writeHead(405);
  response.end("Method not allowed");
});

export function startServer({ listenPort = port, host = "127.0.0.1" } = {}) {
  return new Promise((resolve, reject) => {
    function onError(error) {
      server.off("listening", onListening);
      reject(error);
    }

    function onListening() {
      server.off("error", onError);
      resolve(server);
    }

    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(listenPort, host);
  });
}

export function stopServer() {
  return new Promise((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

if (process.argv[1] === modulePath) {
  startServer()
    .then(() => {
      const url = `http://localhost:${port}`;
      process.stdout.write(`Adaptive Change Interpreter GUI: ${url}\n`);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
