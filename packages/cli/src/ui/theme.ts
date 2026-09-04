import pc from "picocolors";

export const theme = {
  brand: (s: string) => pc.bold(pc.cyan(s)),
  dim: pc.dim,
  bold: pc.bold,
  green: pc.green,
  red: pc.red,
  yellow: pc.yellow,
  cyan: pc.cyan,
  magenta: pc.magenta,
  gray: pc.gray,
  underline: pc.underline,
};

export function sentimentColor(label: string, text: string): string {
  switch (label) {
    case "very_positive":
    case "positive":
      return theme.green(text);
    case "very_negative":
    case "negative":
      return theme.red(text);
    default:
      return theme.yellow(text);
  }
}

export const RULE = "─".repeat(44);

/** Prints real status lines as stages actually complete — never a fake percentage. */
export class StatusReporter {
  constructor(private enabled: boolean) {}

  step(message: string): void {
    if (!this.enabled) return;
    process.stdout.write(`${theme.dim("›")} ${message}\n`);
  }

  done(message: string): void {
    if (!this.enabled) return;
    process.stdout.write(`${theme.green("✓")} ${message}\n`);
  }

  warn(message: string): void {
    if (!this.enabled) return;
    process.stdout.write(`${theme.yellow("!")} ${message}\n`);
  }
}
