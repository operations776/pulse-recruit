import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Vendored agent tooling, installed by `npx impeccable install` and
    // committed so the whole team gets the same skills. It is somebody else's
    // source: linting it produced 302 warnings from files we do not maintain,
    // which is exactly how a warning list stops being read.
    ".claude/skills/impeccable/**",
    ".github/skills/**",
    ".github/agents/**",
    ".github/hooks/**",
  ]),
]);

export default eslintConfig;
