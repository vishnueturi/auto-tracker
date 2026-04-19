const {
  createRule,
  deleteRule,
  getRule,
  listRules,
  updateRule,
} = require("../../packages/db/sessionStore");

const ALLOWED_SOURCES = new Set(["app", "title", "domain"]);
const ALLOWED_MATCH_TYPES = new Set(["exact", "contains"]);

let cachedActiveRules = [];

function toInteger(value, fallback) {
  const parsed = Number(value);

  return Number.isInteger(parsed) ? parsed : fallback;
}

function toActiveFlag(value, fallback = 1) {
  if (value === undefined || value === null) {
    return fallback;
  }

  return value ? 1 : 0;
}

function normalizeRulePayload(payload, existingRule) {
  const errors = [];
  const pattern = String(payload.pattern ?? existingRule?.pattern ?? "").trim();
  const source = String(payload.source ?? existingRule?.source ?? "")
    .trim()
    .toLowerCase();
  const matchType = String(payload.match_type ?? existingRule?.match_type ?? "")
    .trim()
    .toLowerCase();
  const category = String(payload.category ?? existingRule?.category ?? "").trim();
  const priority = toInteger(payload.priority ?? existingRule?.priority, 100);
  const isActive = toActiveFlag(payload.is_active, existingRule?.is_active ?? 1);

  if (!pattern) {
    errors.push("pattern is required");
  }

  if (pattern.length > 160) {
    errors.push("pattern must be 160 characters or fewer");
  }

  if (!ALLOWED_SOURCES.has(source)) {
    errors.push("source must be app, title, or domain");
  }

  if (!ALLOWED_MATCH_TYPES.has(matchType)) {
    errors.push("match_type must be exact or contains");
  }

  if (!category) {
    errors.push("category is required");
  }

  if (category.length > 80) {
    errors.push("category must be 80 characters or fewer");
  }

  if (!Number.isInteger(priority) || priority < 0) {
    errors.push("priority must be a non-negative integer");
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      pattern,
      source,
      matchType,
      category,
      priority,
      isActive,
    },
  };
}

function refreshRulesCache() {
  cachedActiveRules = listRules({ activeOnly: true });
  return cachedActiveRules;
}

function getActiveRules() {
  if (cachedActiveRules.length === 0) {
    refreshRulesCache();
  }

  return cachedActiveRules;
}

function getRules() {
  return listRules();
}

function addRule(payload) {
  const validation = normalizeRulePayload(payload);

  if (!validation.valid) {
    const error = new Error("Invalid rule payload");
    error.statusCode = 400;
    error.details = validation.errors;
    throw error;
  }

  const rule = createRule(validation.value);
  refreshRulesCache();
  return rule;
}

function editRule(id, payload) {
  const existingRule = getRule(id);

  if (!existingRule) {
    const error = new Error("Rule not found");
    error.statusCode = 404;
    throw error;
  }

  const validation = normalizeRulePayload(payload, existingRule);

  if (!validation.valid) {
    const error = new Error("Invalid rule payload");
    error.statusCode = 400;
    error.details = validation.errors;
    throw error;
  }

  const rule = updateRule(id, validation.value);
  refreshRulesCache();
  return rule;
}

function removeRule(id) {
  if (!deleteRule(id)) {
    const error = new Error("Rule not found");
    error.statusCode = 404;
    throw error;
  }

  refreshRulesCache();
}

refreshRulesCache();

module.exports = {
  addRule,
  editRule,
  getActiveRules,
  getRules,
  refreshRulesCache,
  removeRule,
};
