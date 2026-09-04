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
        canvas: "#f7f7f5",
        surface: "#ffffff",
        subtle: "#efefec",
        border: "#deded8",
        ink: "#191917",
        muted: "#686860",
        accent: "#ff4500",
        positive: "#16833a",
        negative: "#c9382f",
        neutral: "#946200",
      },
    },
  },
  plugins: [],
};

export default config;
