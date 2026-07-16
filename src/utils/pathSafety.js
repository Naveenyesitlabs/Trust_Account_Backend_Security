const path = require("path");

const sanitizePathSegment = (value, fallback = "file") => {
  const normalized = path.basename(String(value || fallback));
  return normalized.replace(/[^a-zA-Z0-9._-]/g, "_") || fallback;
};

const resolvePathWithin = (baseDir, ...segments) => {
  const resolvedBaseDir = path.resolve(baseDir);
  const safeSegments = segments.map((segment) => sanitizePathSegment(segment));
  const resolvedPath = path.resolve(resolvedBaseDir, ...safeSegments);

  if (resolvedPath !== resolvedBaseDir && !resolvedPath.startsWith(`${resolvedBaseDir}${path.sep}`)) {
    throw new Error("Invalid file path");
  }

  return resolvedPath;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

module.exports = {
  sanitizePathSegment,
  resolvePathWithin,
  escapeHtml,
};
