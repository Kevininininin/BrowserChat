(() => {
  const PHASES = Object.freeze({
    NORMALIZE: "normalize_goal",
    STRATEGIZE: "create_strategy",
    OBSERVE: "observe_state",
    CHOOSE: "choose_action",
    VALIDATE: "validate_action",
    CONSEQUENTIAL_CHECK: "consequential_check",
    APPROVAL: "await_approval",
    EXECUTE: "execute_action",
    VERIFY: "deterministic_verification",
    EVALUATE: "model_evaluation",
    REPLAN: "replan",
    COMPLETE: "complete",
    BLOCKED: "blocked"
  });

  const CONSEQUENTIAL_LABEL =
    /\b(?:apply|buy|checkout|confirm|delete|finish|order|pay|place order|post|purchase|remove|send|submit|unsubscribe)\b/i;
  const SAFE_SEARCH_LABEL = /\b(?:find|query|search)\b/i;
  const STATE_CHANGING_TOOL_NAMES = new Set([
    "find_and_click",
    "fill_field",
    "press_key",
    "click_element",
    "select_option",
    "scroll_page",
    "go_back"
  ]);
  const DEFAULT_SAFETY_POLICY = Object.freeze({
    requireApprovalForConsequentialActions: true,
    allowRecognizedSearchSubmission: true,
    blockPasswordFields: true,
    approvalScope: "single_action"
  });

  function normalizeGoal(value) {
    return String(value || "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4_000);
  }

  function normalizeSafetyPolicy(value = {}) {
    void value;
    return Object.freeze({
      requireApprovalForConsequentialActions: true,
      allowRecognizedSearchSubmission: true,
      blockPasswordFields: true,
      approvalScope: "single_action"
    });
  }

  function getSchemaMap(schemas = []) {
    return new Map(
      schemas
        .filter((schema) => schema?.function?.name)
        .map((schema) => [schema.function.name, schema.function.parameters || {}])
    );
  }

  function matchesType(value, type) {
    if (type === "array") return Array.isArray(value);
    if (type === "object") {
      return Boolean(value) && typeof value === "object" && !Array.isArray(value);
    }
    if (type === "number") return typeof value === "number" && Number.isFinite(value);
    if (type === "integer") return Number.isInteger(value);
    if (type === "null") return value === null;
    return typeof value === type;
  }

  function validateToolCall(call, schemas = []) {
    const name = call?.function?.name;
    const schema = getSchemaMap(schemas).get(name);
    if (!schema) {
      return { valid: false, errors: [`Unknown tool: ${name || "missing name"}`] };
    }
    const arguments_ = call?.function?.arguments;
    if (!arguments_ || typeof arguments_ !== "object" || Array.isArray(arguments_)) {
      return { valid: false, errors: ["Tool arguments must be a JSON object."] };
    }

    const errors = [];
    const properties = schema.properties || {};
    for (const required of schema.required || []) {
      if (arguments_[required] === undefined) {
        errors.push(`Missing required argument: ${required}`);
      }
    }
    for (const [key, value] of Object.entries(arguments_)) {
      const property = properties[key];
      if (!property) {
        errors.push(`Unexpected argument: ${key}`);
        continue;
      }
      if (property.type && !matchesType(value, property.type)) {
        errors.push(`${key} must be ${property.type}.`);
        continue;
      }
      if (property.enum && !property.enum.includes(value)) {
        errors.push(`${key} must be one of: ${property.enum.join(", ")}.`);
      }
      if (typeof value === "number") {
        if (Number.isFinite(property.minimum) && value < property.minimum) {
          errors.push(`${key} must be at least ${property.minimum}.`);
        }
        if (Number.isFinite(property.maximum) && value > property.maximum) {
          errors.push(`${key} must be at most ${property.maximum}.`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  function getObservedElement(call, observationState) {
    const ref = String(call?.function?.arguments?.elementRef || "");
    return ref ? observationState?.elements?.get?.(ref) || null : null;
  }

  function classifyConsequentialAction(
    call,
    observationState,
    safetyPolicy = DEFAULT_SAFETY_POLICY
  ) {
    const policy = normalizeSafetyPolicy(safetyPolicy);
    const name = call?.function?.name || "";
    const arguments_ = call?.function?.arguments || {};
    const element = getObservedElement(call, observationState);
    const label = [
      arguments_.query,
      element?.label,
      element?.name
    ].filter(Boolean).join(" ");

    if (name === "fill_field" && arguments_.submit === true) {
      const searchEvidence = [label, element?.kind, element?.inputType]
        .filter(Boolean)
        .join(" ");
      if (
        !policy.allowRecognizedSearchSubmission ||
        !SAFE_SEARCH_LABEL.test(searchEvidence)
      ) {
        return {
          consequential: true,
          category: "form_submission",
          reason: "This action submits a form and may create an external side effect.",
          summary: `Submit the form after filling “${element?.label || arguments_.elementRef || "a field"}”`
        };
      }
    }
    if (name === "press_key" && arguments_.key === "Enter") {
      const searchEvidence = [label, element?.kind, element?.inputType]
        .filter(Boolean)
        .join(" ");
      if (
        !policy.allowRecognizedSearchSubmission ||
        !SAFE_SEARCH_LABEL.test(searchEvidence)
      ) {
        return {
          consequential: true,
          category: "form_submission",
          reason: "Pressing Enter here may submit a form or confirm a choice.",
          summary: `Press Enter on “${element?.label || arguments_.elementRef || "a control"}”`
        };
      }
    }
    if (
      policy.requireApprovalForConsequentialActions &&
      ["click_element", "find_and_click"].includes(name) &&
      CONSEQUENTIAL_LABEL.test(label)
    ) {
      return {
        consequential: true,
        category: "consequential_click",
        reason: "The control label indicates a potentially consequential external action.",
        summary: `Click “${label.trim() || "the consequential control"}”`
      };
    }
    return {
      consequential: false,
      category: "ordinary",
      reason: "",
      summary: ""
    };
  }

  function getPlanOutcome(plan) {
    if (!plan?.objectives?.length) return "unplanned";
    const current = plan.objectives.filter((item) => item.status !== "revised");
    if (current.length && current.every((item) => item.status === "completed")) {
      return "complete";
    }
    if (current.some((item) => item.status === "active")) return "progressing";
    if (current.some((item) => item.status === "pending")) return "strategy_invalid";
    if (current.some((item) => item.status === "blocked")) return "blocked";
    return "strategy_invalid";
  }

  function shouldObserveResultingState({
    toolName,
    previousObservationId = null,
    currentObservationId = null,
    executionSucceeded = false
  } = {}) {
    return Boolean(
      executionSucceeded &&
      STATE_CHANGING_TOOL_NAMES.has(toolName) &&
      (
        !currentObservationId ||
        currentObservationId === previousObservationId
      )
    );
  }

  function isStateChangingTool(toolName) {
    return STATE_CHANGING_TOOL_NAMES.has(toolName);
  }

  function objectiveActionSatisfied(
    objective,
    activityName,
    meaningfulProgress = false
  ) {
    const description = String(objective?.description || "").toLocaleLowerCase();
    const requirements = [
      {
        pattern: /\b(?:click|open|visit)\b/,
        tools: new Set(["click_element", "find_and_click"])
      },
      {
        pattern: /\b(?:fill|enter|type)\b/,
        tools: new Set(["fill_field"])
      },
      {
        pattern: /\bselect\b/,
        tools: new Set(["select_option"])
      },
      {
        pattern: /\bscroll\b/,
        tools: new Set(["scroll_page"])
      }
    ];
    const requirement = requirements.find(({ pattern }) =>
      pattern.test(description)
    );
    if (!requirement || objective?.actionEvidence) return true;
    return Boolean(
      requirement.tools.has(activityName) &&
      meaningfulProgress
    );
  }

  function validateStrategy(plan) {
    const errors = [];
    if (!plan || typeof plan !== "object") {
      return { valid: false, errors: ["The strategy is missing."] };
    }
    if (!normalizeGoal(plan.goal)) errors.push("The strategy goal is missing.");
    const objectives = Array.isArray(plan.objectives) ? plan.objectives : [];
    if (!objectives.length) errors.push("The strategy needs at least one objective.");
    if (objectives.length > 12) errors.push("The strategy has too many objectives.");
    const ids = new Set();
    let activeCount = 0;
    for (const [index, objective] of objectives.entries()) {
      const label = objective?.id || `objective ${index + 1}`;
      if (!objective?.id || ids.has(objective.id)) {
        errors.push(`Objective identifiers must be present and unique (${label}).`);
      }
      ids.add(objective?.id);
      if (!normalizeGoal(objective?.description)) {
        errors.push(`${label} needs a description.`);
      }
      if (objective?.status === "active") activeCount += 1;
      if (
        objective?.status !== "revised" &&
        (!Array.isArray(objective?.predicates) || !objective.predicates.length)
      ) {
        errors.push(`${label} needs deterministic completion predicates.`);
      } else {
        for (const predicate of objective?.predicates || []) {
          const hasTarget = String(
            predicate?.type?.startsWith("control_")
              ? predicate.query || ""
              : predicate.value || ""
          ).trim();
          if (!hasTarget) {
            errors.push(`${label} has a completion predicate without a target.`);
          }
        }
      }
    }
    if (activeCount > 1) errors.push("Only one objective can be active.");
    return { valid: errors.length === 0, errors };
  }

  function createRun(
    goal,
    safetyPolicy = DEFAULT_SAFETY_POLICY,
    onTransition = null
  ) {
    const normalizedGoal = normalizeGoal(goal);
    const normalizedSafetyPolicy = normalizeSafetyPolicy(safetyPolicy);
    const events = [];
    let sequence = 0;
    const run = {
      goal: normalizedGoal,
      safetyPolicy: normalizedSafetyPolicy,
      phase: PHASES.NORMALIZE,
      transition(phase, details = {}) {
        this.phase = phase;
        const event = {
          sequence: ++sequence,
          phase,
          timestamp: new Date().toISOString(),
          ...details
        };
        events.push(event);
        if (typeof onTransition === "function") onTransition({ ...event });
        return event;
      },
      export() {
        return {
          schema: "browserchat.orchestration.v1",
          goal: normalizedGoal,
          safetyPolicy: normalizedSafetyPolicy,
          phase: this.phase,
          events: events.map((event) => ({ ...event }))
        };
      }
    };
    run.transition(PHASES.NORMALIZE, {
      goalChanged: normalizedGoal !== String(goal || "").trim(),
      safetyPolicy: normalizedSafetyPolicy
    });
    return run;
  }

  const api = Object.freeze({
    PHASES,
    DEFAULT_SAFETY_POLICY,
    normalizeGoal,
    normalizeSafetyPolicy,
    validateToolCall,
    classifyConsequentialAction,
    getPlanOutcome,
    isStateChangingTool,
    objectiveActionSatisfied,
    shouldObserveResultingState,
    validateStrategy,
    createRun
  });
  globalThis.BrowserChatOrchestration = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
