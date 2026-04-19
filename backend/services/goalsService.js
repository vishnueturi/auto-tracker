const { getGoalProgress, listGoals, saveGoal } = require("../../packages/db/sessionStore");

const ALLOWED_PERIODS = new Set(["daily"]);

function normalizeCategory(category) {
  return String(category || "").trim();
}

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function validateGoalPayload(payload) {
  const category = normalizeCategory(payload.category);
  const targetMinutes = parsePositiveInteger(payload.target_minutes);
  const period = String(payload.period || "daily").trim().toLowerCase();
  const errors = [];

  if (!category) {
    errors.push("category is required");
  }

  if (category.length > 80) {
    errors.push("category must be 80 characters or fewer");
  }

  if (!targetMinutes) {
    errors.push("target_minutes must be a positive integer");
  }

  if (!ALLOWED_PERIODS.has(period)) {
    errors.push("period must be daily");
  }

  return {
    valid: errors.length === 0,
    errors,
    value: {
      category,
      targetMinutes,
      period,
    },
  };
}

function getGoals() {
  return listGoals();
}

function upsertGoal(payload) {
  const validation = validateGoalPayload(payload);

  if (!validation.valid) {
    const error = new Error("Invalid goal payload");
    error.statusCode = 400;
    error.details = validation.errors;
    throw error;
  }

  const { category, targetMinutes, period } = validation.value;
  saveGoal(category, targetMinutes, period);

  return listGoals().find((goal) => goal.category.toLowerCase() === category.toLowerCase());
}

function getProgress() {
  return getGoalProgress();
}

module.exports = {
  getGoals,
  getProgress,
  upsertGoal,
};
