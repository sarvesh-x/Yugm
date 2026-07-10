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
  success: "#32D583",
  warning: "#FDB022",
  scrim: "rgba(5,7,19,0.72)",
  surface: "#11162A",
  surfaceElevated: "#171D35"
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radii = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const type = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: "900" as const },
  title: { fontSize: 21, lineHeight: 27, fontWeight: "900" as const },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "600" as const },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "800" as const }
};

export const gradients = {
  screen: [colors.ink, "#080A19", "#101028"] as const,
  fire: [colors.saffron, colors.pink, colors.purple] as const,
  calm: ["#18223A", "#25164C"] as const,
  gold: ["#F6B44B", "#FF8A22"] as const
};
