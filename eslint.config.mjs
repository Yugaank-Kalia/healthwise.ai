import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import importPlugin from "eslint-plugin-import-x";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { "import-x": importPlugin },
    rules: {
      "import-x/no-unused-modules": [
        "warn",
        {
          unusedExports: true,
          ignoreExports: [
            // Next.js entrypoints that don't need to be imported elsewhere
            "app/**/*.tsx",
            "app/**/*.ts",
            "next.config.*",
            "tailwind.config.*",
            "drizzle.config.*",
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
