import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals.map(config => {
    // Downgrade React Compiler rules from errors to warnings
    if (config.rules) {
      const newRules = { ...config.rules };
      for (const [key, value] of Object.entries(newRules)) {
        // If it's a React hooks rule and is an error, downgrade to warn
        if (key.startsWith('react-hooks/') && value === 'error') {
          newRules[key] = 'warn';
        }
      }
      return { ...config, rules: newRules };
    }
    return config;
  }),
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated files (Prisma, etc.)
    "src/generated/**",
  ]),
  // Custom rule overrides
  {
    rules: {
      // Keep core hook rules
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Downgrade strict React patterns to warnings
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);

export default eslintConfig;
