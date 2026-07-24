BrowserChatTools.define((register) => {
  register({
    schema: {
      type: "function",
      function: {
        name: "calculate",
        description:
          "Perform one arithmetic operation on two numbers. Independent calculations may be requested as multiple parallel calls.",
        parameters: {
          type: "object",
          required: ["operation", "a", "b"],
          properties: {
            operation: {
              type: "string",
              enum: ["add", "subtract", "multiply", "divide"],
              description: "The arithmetic operation to perform."
            },
            a: {
              type: "number",
              description: "The first number."
            },
            b: {
              type: "number",
              description: "The second number."
            }
          }
        }
      }
    },
    execute({ operation, a, b }) {
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        throw new TypeError("Both a and b must be finite numbers.");
      }

      switch (operation) {
        case "add":
          return a + b;
        case "subtract":
          return a - b;
        case "multiply":
          return a * b;
        case "divide":
          if (b === 0) throw new RangeError("Division by zero is undefined.");
          return a / b;
        default:
          throw new RangeError(`Unsupported operation: ${operation}`);
      }
    }
  });
});
