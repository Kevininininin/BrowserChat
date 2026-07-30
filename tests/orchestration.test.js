const test = require("node:test");
const assert = require("node:assert/strict");

const orchestration = require("../orchestration/runtime.js");

const schemas = [
  {
    function: {
      name: "click_element",
      parameters: {
        type: "object",
        required: ["elementRef", "expectedState"],
        properties: {
          elementRef: { type: "string" },
          expectedState: { type: "object" }
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
          arguments: {
            elementRef: "e3",
            expectedState: { type: "control_present", value: "Next" }
          }
        }
      },
      schemas
    ).valid,
    true
  );
});

test("verifies the declared click outcome instead of accepting any DOM update", () => {
  const before = {
    page: { url: "https://example.com/current" },
    visibleText: { inViewport: "Create" },
    interactiveElements: [{ label: "Create" }]
  };
  const observation = {
    page: { url: "https://example.com/current" },
    visibleText: { inViewport: "Create Event Task" },
    interactiveElements: [
      { label: "Event", checked: false },
      { label: "Continue", checked: true }
    ]
  };
  assert.equal(
    orchestration.verifyExpectedState(
      { type: "control_present", value: "Add title" },
      observation,
      before
    ).verified,
    false
  );
  assert.equal(
    orchestration.verifyExpectedState(
      { type: "control_present", value: "Event" },
      observation,
      before
    ).verified,
    true
  );
  assert.equal(
    orchestration.verifyExpectedState(
      { type: "control_checked", value: "Continue" },
      observation,
      before
    ).verified,
    true
  );
  assert.equal(
    orchestration.verifyExpectedState(
      { type: "url_contains", value: "/expected" },
      observation,
      before
    ).verified,
    false
  );
  assert.equal(
    orchestration.verifyExpectedState(
      { type: "page_text_contains", value: "Create" },
      observation,
      before
    ).verified,
    false,
    "pre-existing evidence must not prove a click transition"
  );
});

test("does not require approval for in-page controls", () => {
  const observationState = {
    elements: new Map([
      ["e3", { label: "Submit application", name: "", kind: "button" }],
      ["e4", { label: "View details", name: "", kind: "link" }]
    ])
  };
  for (const elementRef of ["e3", "e4"]) {
    assert.equal(
      orchestration.classifyConsequentialAction(
        {
          function: {
            name: "click_element",
            arguments: { elementRef }
          }
        },
        observationState
      ).consequential,
      false
    );
  }
});

test("requires approval before opening any direct URL", () => {
  const result = orchestration.classifyConsequentialAction(
    {
      function: {
        name: "navigate_to_url",
        arguments: { url: "https://example.com/path" }
      }
    },
    { elements: new Map() }
  );
  assert.equal(result.consequential, true);
  assert.equal(result.category, "open_external_url");
  assert.match(result.summary, /new tab/i);
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

test("does not request approval for non-navigation form submission", () => {
  const result = orchestration.classifyConsequentialAction(
    {
      function: {
        name: "fill_field",
        arguments: { elementRef: "e1", text: "send this", submit: true }
      }
    },
    {
      elements: new Map([
        ["e1", { label: "Message", kind: "textbox", inputType: "text" }]
      ])
    }
  );
  assert.equal(result.consequential, false);
});

test("requires a resulting-state observation when an action did not create one", () => {
  assert.equal(orchestration.isStateChangingTool("navigate_to_url"), true);
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

test("accepts direct navigation as action evidence for navigation objectives", () => {
  assert.equal(
    orchestration.objectiveActionSatisfied(
      {
        description: "Navigate to the requested website",
        actionEvidence: null
      },
      "navigate_to_url",
      true
    ),
    true
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

test("requires count evidence for objectives that request multiple outputs", () => {
  const invalid = orchestration.validateStrategy({
    goal: "Return two links",
    objectives: [
      {
        id: "collect-links",
        description: "Find and return two distinct links",
        status: "active",
        predicates: [
          { type: "page_text_contains", value: "Results" }
        ]
      }
    ]
  });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /count-based evidence predicate/);

  const valid = orchestration.validateStrategy({
    goal: "Return two links",
    objectives: [
      {
        id: "collect-links",
        description: "Find and return two distinct links",
        status: "active",
        predicates: [
          { type: "distinct_url_count_at_least", value: 2 }
        ]
      }
    ]
  });
  assert.equal(valid.valid, true);
});

test("rejects invalid count predicate targets", () => {
  const result = orchestration.validateStrategy({
    goal: "Collect results",
    objectives: [
      {
        id: "collect",
        description: "Collect several results",
        status: "active",
        predicates: [
          { type: "evidence_count_at_least", value: 0 }
        ]
      }
    ]
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /without a target/);
});

test("rejects invented UI filters and literal comparative evidence", () => {
  const inventedFilter = orchestration.validateStrategy({
    goal: "Find two suitable options",
    objectives: [
      {
        id: "filter",
        description: "Filter the results under $50",
        status: "active",
        predicates: [
          { type: "page_text_contains", value: "$50" }
        ]
      }
    ]
  });
  assert.equal(inventedFilter.valid, false);
  assert.match(inventedFilter.errors.join(" "), /did not require/);
  assert.match(
    inventedFilter.errors.join(" "),
    /literal page text as proof/
  );
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
