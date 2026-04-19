const { normalizeSession, normalizeText } = require("./normalizer");
const { getActiveRules } = require("./rulesService");

const fallbackMatchers = [
  { tokens: ["leetcode", "hackerrank", "geeksforgeeks"], category: "Preparation" },
  { tokens: ["linkedin jobs", "naukri", "indeed", "wellfound"], category: "Job Search" },
  { tokens: ["youtube", "netflix", "prime video"], category: "Entertainment" },
  { tokens: ["teams", "outlook", "slack"], category: "Office Work" },
  { tokens: ["visual studio code", "auto-tracker"], category: "Personal Project" },
];

function matchesRule(rule, normalizedSession) {
  const sourceText = normalizedSession[rule.source] || "";
  const pattern = normalizeText(rule.pattern);

  if (!sourceText || !pattern) {
    return false;
  }

  if (rule.match_type === "exact") {
    return sourceText === pattern;
  }

  return sourceText.includes(pattern);
}

function fallbackCategory(normalizedSession) {
  const searchable = `${normalizedSession.app} ${normalizedSession.title} ${normalizedSession.domain}`;

  for (const matcher of fallbackMatchers) {
    if (matcher.tokens.some((token) => searchable.includes(token))) {
      return matcher.category;
    }
  }

  return "General";
}

function classifySession(session) {
  try {
    const normalizedSession = normalizeSession(session);

    for (const rule of getActiveRules()) {
      if (matchesRule(rule, normalizedSession)) {
        return {
          category: rule.category,
          matchedRuleId: rule.id,
          confidence: rule.match_type === "exact" ? "high" : "medium",
        };
      }
    }

    return {
      category: fallbackCategory(normalizedSession),
      matchedRuleId: null,
      confidence: "fallback",
    };
  } catch (error) {
    return {
      category: "General",
      matchedRuleId: null,
      confidence: "fallback",
    };
  }
}

module.exports = {
  classifySession,
};
