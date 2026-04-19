const BROWSER_SUFFIXES = [
  "google chrome",
  "chrome",
  "microsoft edge",
  "edge",
  "mozilla firefox",
  "firefox",
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[|()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(title) {
  let normalized = normalizeText(title);

  for (const suffix of BROWSER_SUFFIXES) {
    if (normalized.endsWith(` - ${suffix}`)) {
      normalized = normalized.slice(0, -(` - ${suffix}`).length).trim();
    }
  }

  return normalized;
}

function normalizeSession({ app, title, domain } = {}) {
  return {
    app: normalizeText(app),
    title: normalizeTitle(title),
    domain: normalizeText(domain),
  };
}

module.exports = {
  normalizeSession,
  normalizeText,
  normalizeTitle,
};
