/**
 * ScrapLoop design tokens.
 *
 * Grounding: this is a street-economy app — kraft paper, corrugated cardboard,
 * galvanized steel scale-pans, jute sacks, hand-painted market signage.
 * The palette pulls from those materials rather than generic app-cream/SaaS-card
 * defaults. Household and Collector roles get distinct accent colors so the two
 * halves of the app are visually legible as different modes, not just different labels.
 */

export const colors = {
  canvas: "#F1ECDE", // warm paper background
  ink: "#25211A", // near-black warm ink — body text
  inkMuted: "#6B6355", // secondary text, on canvas

  kraft: "#C9A66B", // cardboard/kraft — dividers, card backgrounds
  kraftDark: "#A9855076",

  marigold: "#E4A22F", // primary CTA — street-signage marigold, not SaaS-blue or terracotta
  marigoldDark: "#B87F1E",

  moss: "#4F6B4F", // Household role accent (paper/eco)
  mossLight: "#DCE6D6",

  steel: "#3F545C", // Collector role accent (galvanized scale-pan blue-grey)
  steelLight: "#D9E2E4",

  success: "#3E7A4E",
  danger: "#A8412F",
  border: "#DACBAA",
  white: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
};

export const type = {
  display: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.3 },
  title: { fontSize: 20, fontWeight: "700" as const },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 21 },
  bodyBold: { fontSize: 15, fontWeight: "600" as const },
  label: { fontSize: 13, fontWeight: "500" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
};

export const roleAccent = (role: "household" | "collector") =>
  role === "household" ? colors.moss : colors.steel;

export const roleAccentLight = (role: "household" | "collector") =>
  role === "household" ? colors.mossLight : colors.steelLight;
