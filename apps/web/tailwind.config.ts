import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
      colors: {
        canvas: "#0a0a0b",
        surface: "#111113",
        border: "#232326",
        ink: "#e6e6e8",
        muted: "#8a8a92",
        accent: "#ff4500",
        positive: "#3fb950",
        negative: "#f85149",
        neutral: "#d29922",
      },
    },
  },
  plugins: [],
};

export default config;
