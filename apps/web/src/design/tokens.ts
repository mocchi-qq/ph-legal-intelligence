// Design tokens for the Philippine Legal Intelligence Platform
// Professional legal research aesthetic: serious, trustworthy, clear, authoritative

export const colors = {
  // Neutral base — warm off-whites and deep inks for print-like readability
  neutral: {
    50: "#fafaf9",
    100: "#f5f5f4",
    200: "#e7e5e4",
    300: "#d6d3d1",
    400: "#a8a29e",
    500: "#78716c",
    600: "#57534e",
    700: "#44403c",
    800: "#3f3833",
    900: "#292524",
    950: "#1c1a17",
  },
  // Brand ink — deep navy/charcoal for seriousness and authority
  ink: {
    light: "#262626",
    DEFAULT: "#0f172a",
    dark: "#020617",
  },
  // Legal authority colors — restrained, professional
  authority: {
    primary: "#0f172a",
    secondary: "#475569",
    accent: "#1e293b",
    gold: "#854d0e",
  },
  // Semantic colors
  success: "#166534",
  warning: "#92400e",
  error: "#991b1b",
  info: "#1e40af",
  // Synthetic/demo colors — clearly distinct from real, muted
  synthetic: {
    bg: "#f0f9ff",
    border: "#bae6fd",
    text: "#0c4a6e",
    badge: "#bfdbfe",
  },
  // Blocked/authorization colors
  blocked: {
    bg: "#fdf2f8",
    border: "#fbcfe8",
    text: "#9d174d",
    badge: "#fce7f3",
  },
  unknown: {
    bg: "#fafafa",
    border: "#e7e5e4",
    text: "#57534e",
    badge: "#e7e5e4",
  },
};

export const typography = {
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  fontSerif:
    '"Playfair Display", "Georgia", serif',
  fontMono:
    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", monospace',
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3rem",
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const spacing = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
};

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
};

export const borderRadius = {
  sm: "0.25rem",
  md: "0.375rem",
  lg: "0.5rem",
  none: "0",
};

export const shadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)",
};

export const zIndex = {
  dropdown: 100,
  modal: 200,
  tooltip: 300,
};
