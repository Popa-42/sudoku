import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintPluginBetterTailwindcss from "eslint-plugin-better-tailwindcss";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  // Keep this late so it can turn off formatting rules from earlier presets.
  prettierRecommended,

  // Override default ignores of eslint-config-next, plus your project ignores.
  globalIgnores([".next/**", "out/**", "build/**", "dist/**", "coverage/**", "node_modules/**", "next-env.d.ts"]),

  {
    linterOptions: {
      reportUnusedDisableDirectives: "warn",
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
      "better-tailwindcss": {
        entryPoint: "public/assets/styles/globals.css",
        attributes: ["className", "classNames", "classes", "styles", "style", ".*Classes", ".*Variants"],
        callees: ["clsx", "cn", "cva", "tw", ".*Classes", ".*Variants"],
        variables: [
          ".*Classes",
          ".*Variants",
          [
            ".*Classes",
            [
              {
                match: "objectValues",
                pathPattern: "[a-z]+[A-Za-z]*",
              },
            ],
          ],
          [
            ".*Variants",
            [
              {
                match: "objectValues",
                pathPattern: "[a-z]+[A-Za-z]*",
              },
            ],
          ],
        ],
      },
    },
    rules: {
      "prettier/prettier": [
        "error",
        {
          endOfLine: "lf",
        },
      ],
    },
  },

  {
    files: ["**/*.{ts,tsx,cts,mts}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          vars: "all",
          args: "after-used",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  {
    files: ["**/*.{js,cjs,mjs,jsx,ts,cts,mts,tsx}"],
    plugins: {
      "better-tailwindcss": eslintPluginBetterTailwindcss,
    },
    rules: {
      ...eslintPluginBetterTailwindcss.configs["recommended-error"].rules,

      "better-tailwindcss/enforce-consistent-line-wrapping": [
        "warn",
        {
          printWidth: 120,
          lineBreakStyle: "unix",
          preferSingleLine: true,
          group: "newLine",
        },
      ],
      "better-tailwindcss/no-unregistered-classes": "off",
    },
  },

  {
    files: ["src/Types.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);
