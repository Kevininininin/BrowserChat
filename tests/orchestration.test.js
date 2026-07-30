const test = require("node:test");
const assert = require("node:assert/strict");

const orchestration = require("../orchestration/runtime.js");

const schemas = [
  {
    function: {
      name: "click_element",
      parameters: {
        type: "object",
        required: ["elementRef"],
        properties: {
          elementRef: { type: "string" }
        }
      }
    }
  },
  {
    function: {
      name: "scroll_page",
      parameters: {
        type: "object",
        required: ["direction"],
        properties: {
          direction: { type: "string", enum: ["up", "down"] },
          amount: { type: "number", minimum: 1, maximum: 5000 }
        }
      }
    }
  }
];

test("normalizes user goals before orchestration", () => {
  assert.equal(
    orchestration.normalizeGoal("  Apply\u0000  to   the job \n"),
    "Apply to the job"
  );
});

test("normalizes a non-editable single-action safety policy", () => {
  const policy = orchestration.normalizeSafetyPolicy({
    approvalScope: "session",
    blockPasswordFields: false
  });
  assert.equal(policy.approvalScope, "single_action");
  assert.equal(policy.blockPasswordFields, true);
  assert.equal(policy.requireApprovalForConsequentialActions, true);
});

test("validates tool arguments against the registered schema", () => {
  assert.deepEqual(
    orchestration.validateToolCall(
      {
        function: {
          name: "scroll_page",
          arguments: { direction: "sideways", amount: 7000, extra: true }
        }
      },
      schemas
    ),
    {
      valid: false,
      errors: [
        "direction must be one of: up, down.",
        "amount must be at most 5000.",
        "Unexpected argument: extra"
      ]
    }
  );
  assert.equal(
    orchestration.validateToolCall(
      {
        function: {
          name: "click_element",
          arguments: { elementRef: "e3" }
        }
      },
      schemas
    ).valid,
    true
  );
});

test("requires approval for consequential controls", () => {
  const observationState = {
    elements: new Map([
      ["e3", { label: "Submit application", name: "", kind: "button" }],
      ["e4", { label: "View details", name: "", kind: "link" }]
    ])
  };
  assert.equal(
    orchestration.classifyConsequentialAction(
      {
        function: {
          name: "click_element",
          arguments: { elementRef: "e3" }
        }
      },
      observationState
    ).consequential,
    true
  );
  assert.equal(
    orchestration.classifyConsequentialAction(
      {
        function: {
          name: "click_element",
          arguments: { elementRef: "e4" }
        }
      },
      observationState
    ).consequential,
    false
  );
});

test("allows recognized searches without a consequential-action pause", () => {
  const observationState = {
    elements: new Map([
      [
        "e1",
        {
          label: "Search jobs",
          name: "q",
          kind: "searchbox",
          inputType: "search"
        }
      ]
    ])
  };
  const result = orchestration.classifyConsequentialAction(
    {
      function: {
        name: "fill_field",
        arguments: { elementRef: "e1", text: "designer", submit: true }
      }
    },
    observationState
  );
  assert.equal(result.consequential, false);
});

test("requires a resulting-state observation when an action did not create one", () => {
  assert.equal(orchestration.isStateChangingTool("select_option"), true);
  assert.equal(orchestration.isStateChangingTool("calculate"), false);
  assert.equal(
    orchestration.shouldObserveResultingState({
      toolName: "select_option",
      previousObservationId: "o1",
      currentObservationId: "o1",
      executionSucceeded: true
    }),
    true
  );
  assert.equal(
    orchestration.shouldObserveResultingState({
      toolName: "click_element",
      previousObservationId: "o1",
      currentObservationId: "o2",
      executionSucceeded: true
    }),
    false
  );
  assert.equal(
    orchestration.shouldObserveResultingState({
      toolName: "calculate",
      previousObservationId: "o1",
      currentObservationId: "o1",
      executionSucceeded: true
    }),
    false
  );
});

test("does not complete action objectives from observation alone", () => {
  const objective = {
    description: "Identify and click all in-progress tickets",
    actionEvidence: null
  };
  assert.equal(
    orchestration.objectiveActionSatisfied(
      objective,
      "observe_page",
      true
    ),
    false
  );
  assert.equal(
    orchestration.objectiveActionSatisfied(
      objective,
      "click_element",
      true
    ),
    true
  );
});

test("maps objective state to completion, progress, replan, and blocked outcomes", () => {
  const plan = (...statuses) => ({
    objectives: statuses.map((status) => ({ status }))
  });
  assert.equal(orchestration.getPlanOutcome(plan("completed")), "complete");
  assert.equal(
    orchestration.getPlanOutcome(plan("completed", "active")),
    "progressing"
  );
  assert.equal(
    orchestration.getPlanOutcome(plan("completed", "pending")),
    "strategy_invalid"
  );
  assert.equal(orchestration.getPlanOutcome(plan("blocked")), "blocked");
});

test("rejects strategies without deterministic completion evidence", () => {
  const result = orchestration.validateStrategy({
    goal: "Apply to a role",
    objectives: [
      {
        id: "open-role",
        description: "Open the role",
        status: "active",
        predicates: []
      }
    ]
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /deterministic completion predicates/);
});

test("records explicit orchestration phase transitions", () => {
  const run = orchestration.createRun("  Find a role  ");
  run.transition(orchestration.PHASES.STRATEGIZE, { planned: true });
  run.transition(orchestration.PHASES.OBSERVE, { observationId: "o1" });
  run.transition(orchestration.PHASES.COMPLETE, { evidenceCount: 2 });
  const trace = run.export();
  assert.equal(trace.goal, "Find a role");
  assert.equal(trace.safetyPolicy.approvalScope, "single_action");
  assert.equal(trace.phase, orchestration.PHASES.COMPLETE);
  assert.deepEqual(
    trace.events.map((event) => event.phase),
    ["normalize_goal", "create_strategy", "observe_state", "complete"]
  );
});
