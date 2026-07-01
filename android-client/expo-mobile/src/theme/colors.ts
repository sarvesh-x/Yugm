export const colors = {
  ink: "#050713",
  ink2: "#0B1024",
  panel: "rgba(255,255,255,0.08)",
  panelStrong: "rgba(255,255,255,0.13)",
  line: "rgba(255,255,255,0.14)",
  text: "#F8FAFC",
  muted: "#A9B1C7",
  gold: "#F6B44B",
  saffron: "#FF8A22",
  pink: "#FF3E93",
  purple: "#8A5CFF",
  cyan: "#27D3FF",
  danger: "#FF5B6E",
  success: "#32D583"
};

export const gradients = {
  screen: [colors.ink, "#080A19", "#101028"] as const,
  fire: [colors.saffron, colors.pink, colors.purple] as const,
  calm: ["#18223A", "#25164C"] as const,
  gold: ["#F6B44B", "#FF8A22"] as const
};

