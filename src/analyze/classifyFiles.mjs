import path from "node:path";

function hasPathToken(filePath, token) {
  const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[\\/_\\-.])${escapedToken}([\\/_\\-.]|$)`).test(filePath);
}

function looksLikeFrontendAppPath(normalized, ext) {
  if (ext === ".html" || ext === ".css" || ext === ".scss" || ext === ".sass") {
    return true;
  }

  if (![".js", ".mjs", ".ts", ".jsx", ".tsx"].includes(ext)) {
    return false;
  }

  return (
    normalized.startsWith("js/") ||
    normalized.includes("/js/") ||
    normalized.startsWith("src/components/") ||
    normalized.includes("/components/") ||
    normalized.startsWith("src/pages/") ||
    normalized.includes("/pages/") ||
    normalized.startsWith("src/routes/") ||
    normalized.includes("/routes/") ||
    normalized.startsWith("src/screens/") ||
    normalized.includes("/screens/") ||
    hasPathToken(normalized, "ui") ||
    hasPathToken(normalized, "theme") ||
    hasPathToken(normalized, "page") ||
    hasPathToken(normalized, "screen") ||
    hasPathToken(normalized, "route") ||
    normalized.endsWith("/main.js") ||
    normalized.endsWith("/main.ts") ||
    normalized.endsWith("/app.js") ||
    normalized.endsWith("/app.mjs") ||
    normalized.endsWith("/app.ts") ||
    normalized.endsWith("/app.jsx") ||
    normalized.endsWith("/app.tsx")
  );
}

function getFileCategory(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  const ext = path.extname(normalized).toLowerCase();
  const fileName = path.basename(normalized).toLowerCase();

  if (
    normalized === "readme.md" ||
    fileName === "readme.md" ||
    ext === ".md"
  ) {
    return "docs";
  }

  if (
    normalized.startsWith("supabase/functions/") ||
    normalized.startsWith("api/") ||
    normalized.startsWith("server/")
  ) {
    return "backend";
  }

  if (
    normalized.startsWith("supabase/") ||
    ext === ".sql"
  ) {
    return "database";
  }

  if (
    normalized.includes("service-worker") ||
    normalized.includes("sw.js")
  ) {
    return "notifications_background";
  }

  if (
    ext === ".css" ||
    ext === ".scss" ||
    ext === ".sass"
  ) {
    return "styling";
  }

  if (
    looksLikeFrontendAppPath(normalized, ext)
  ) {
    return "frontend_app";
  }

  if (
    fileName === ".gitignore" ||
    fileName === ".env" ||
    fileName.startsWith(".env.") ||
    fileName === "vite.config.js" ||
    fileName === "vite.config.mjs" ||
    fileName === "vite.config.ts" ||
    fileName === "vercel.json" ||
    fileName === "package.json" ||
    fileName === "package-lock.json"
  ) {
    return "config_build";
  }

  if (
    ext === ".png" ||
    ext === ".jpg" ||
    ext === ".jpeg" ||
    ext === ".svg" ||
    ext === ".gif" ||
    ext === ".webp" ||
    ext === ".ico"
  ) {
    return "assets";
  }

  if (
    normalized.startsWith("dist/") ||
    normalized.startsWith("build/")
  ) {
    return "generated_output";
  }

  if (
    fileName === ".ds_store"
  ) {
    return "local_artifact";
  }

  return "other";
}

export function classifyFiles(filePaths = []) {
  const classified = filePaths.map((filePath) => ({
    path: filePath,
    category: getFileCategory(filePath),
  }));

  const countsByCategory = classified.reduce((acc, file) => {
    acc[file.category] = (acc[file.category] || 0) + 1;
    return acc;
  }, {});

  return {
    files: classified,
    countsByCategory,
  };
}
