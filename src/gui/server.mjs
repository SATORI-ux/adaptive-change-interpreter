import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAnalysis } from "../analyze/runAnalysis.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
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

function getRepoInfo(inputPath) {
  const repoPath = getBrowseRoot(inputPath);

  if (!fs.existsSync(repoPath)) {
    throw new Error(`Folder does not exist: ${repoPath}`);
  }

  const stat = fs.statSync(repoPath);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a folder: ${repoPath}`);
  }

  if (!isGitRepo(repoPath)) {
    throw new Error(`Folder is not a Git repository: ${repoPath}`);
  }

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

function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = requestUrl.pathname === "/"
    ? "/index.html"
    : decodeURIComponent(requestUrl.pathname);
  const absolutePath = path.resolve(publicDir, `.${requestedPath}`);

  if (!absolutePath.startsWith(publicDir)) {
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

const server = http.createServer(async (request, response) => {
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

server.listen(port, "127.0.0.1", () => {
  const url = `http://localhost:${port}`;
  process.stdout.write(`Adaptive Change Interpreter GUI: ${url}\n`);
});
