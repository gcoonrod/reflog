import { createTheme } from "@mantine/core";
import type { CSSVariablesResolver } from "@mantine/core";

export const theme = createTheme({
  fontFamilyMonospace: "'Fira Code', 'JetBrains Mono', monospace",
  defaultRadius: "sm",
});

/**
 * Override Mantine's default `--mantine-color-dimmed` in dark mode.
 * The default (#868e96 / dark-2) renders at ~4.0:1 contrast against
 * dark card backgrounds (#242424), which fails WCAG AA (4.5:1).
 * #909090 achieves ~4.5:1 on #242424 and ~5.5:1 on #1a1b1e.
 */
export const cssResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {},
  dark: {
    "--mantine-color-dimmed": "#909090",
  },
});
