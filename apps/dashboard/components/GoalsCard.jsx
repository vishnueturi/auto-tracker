(function goalsCard() {
  const root = document.getElementById("goals-card");

  if (!root) {
    return;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderState(className, message) {
    return `<div class="state ${className}" role="status">${escapeHtml(message)}</div>`;
  }

  function renderGoals(progress) {
    if (!progress.length) {
      return renderState("empty", "No goals yet. Add a category target to start tracking progress.");
    }

    return `<div class="goal-list">${progress
      .map((goal) => {
        const percent = Number(goal.percent || 0);
        const width = Math.max(0, Math.min(100, percent));

        return `<article class="goal-row">
          <div class="goal-heading">
            <h3>${escapeHtml(goal.category)}</h3>
            <strong>${width}%</strong>
          </div>
          <p class="muted">${Number(goal.actual_minutes || 0)} of ${Number(
            goal.target_minutes || 0,
          )} mins today</p>
          <div class="progress-track" aria-label="${escapeHtml(goal.category)} goal progress">
            <div class="progress-fill ${escapeHtml(goal.status)}" style="width: ${width}%"></div>
          </div>
        </article>`;
      })
      .join("")}</div>`;
  }

  function render(progress, options = {}) {
    root.innerHTML = `
      <h2>Goals</h2>
      <form class="goal-form" id="goal-form">
        <div>
          <label for="goal-category">Category</label>
          <input id="goal-category" name="category" placeholder="Coding" autocomplete="off" required />
        </div>
        <div>
          <label for="goal-target">Target minutes</label>
          <input id="goal-target" name="target_minutes" type="number" min="1" step="1" placeholder="300" required />
        </div>
        <button type="submit">Save goal</button>
      </form>
      ${options.message ? renderState(options.messageType || "empty", options.message) : ""}
      <div id="goals-list">${renderGoals(progress)}</div>
    `;
  }

  async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json();

    if (!response.ok || payload.ok === false) {
      throw new Error(payload.details?.[0] || payload.error || "Request failed");
    }

    return payload.data;
  }

  async function load(options = {}) {
    try {
      const progress = await fetchJson("/api/goals/progress");
      render(progress, options);
    } catch (error) {
      render([], {
        message: error.message || "Unable to load goals.",
        messageType: "error",
      });
    }
  }

  root.addEventListener("submit", async (event) => {
    if (event.target.id !== "goal-form") {
      return;
    }

    event.preventDefault();

    const form = event.target;
    const button = form.querySelector("button");
    const formData = new FormData(form);

    button.disabled = true;

    try {
      await fetchJson("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formData.get("category"),
          target_minutes: Number(formData.get("target_minutes")),
        }),
      });

      form.reset();
      await load({ message: "Goal saved.", messageType: "empty" });
    } catch (error) {
      await load({
        message: error.message || "Unable to save goal.",
        messageType: "error",
      });
    } finally {
      button.disabled = false;
    }
  });

  load();
})();
