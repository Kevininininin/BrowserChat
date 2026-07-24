BrowserChatSkills.registerDefault({
  id: "mermaid",
  name: "Mermaid",
  description:
    "Create a Mermaid diagram when a workflow, hierarchy, sequence, or relationship benefits from visualization.",
  instructions:
    "When a diagram would make a workflow, hierarchy, sequence, or relationship materially clearer, return a fenced mermaid code block using documented Mermaid 11 syntax. For flowcharts, use standard arrows such as --> and labeled edges such as A -- label --> B or A -->|label| B. Use only documented Mermaid arrow tokens. Let BrowserChat provide diagram styling instead of adding style, classDef, theme, or init directives. Do not use Mermaid for simple prose or ordinary code."
});
