const tabs = document.querySelectorAll(".settings-tab");
const panels = document.querySelectorAll(".settings-panel");

for (const tab of tabs) {
  tab.addEventListener("click", () => {
    for (const item of tabs) {
      const active = item === tab;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    }
    for (const panel of panels) {
      panel.hidden = panel.id !== tab.dataset.panel;
    }
  });
}

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  theme: "base",
  fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  flowchart: {
    curve: "basis",
    htmlLabels: false,
    useMaxWidth: true
  },
  themeVariables: {
    background: "#ffffff",
    lineColor: "#8d8d87",
    fontSize: "13px",
    edgeLabelBackground: "#ffffff"
  }
});

void mermaid.run({ querySelector: ".mermaid" }).catch((error) => {
  console.error("Could not render the agent architecture diagram.", error);
});
