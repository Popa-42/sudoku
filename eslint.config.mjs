import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import eslintParserTypeScript from "@typescript-eslint/parser";
import eslintPluginBetterTailwindcss from "eslint-plugin-better-tailwindcss";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.next/**", "**/coverage/**"],
  },
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript", "plugin:prettier/recommended"],
    overrides: [
      {
        files: ["src/Types.ts"],
        rules: {
          "@typescript-eslint/no-unused-vars": "off",
        },
      },
    ],
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
      "@typescript-eslint/no-explicit-any": ["error"],
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
      "better-tailwindcss": {
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
  }),
  {
    files: ["**/*.{ts,tsx,cts,mts}"],
    languageOptions: {
      parser: eslintParserTypeScript,
      parserOptions: {
        project: true,
      },
    },
  },
  {
    files: ["**/*.{jsx,tsx}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "better-tailwindcss": eslintPluginBetterTailwindcss,
    },
    rules: {
      // Readable Tailwind
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
      "better-tailwindcss/no-unregistered-classes": ["off"],

      // Prettier
      ...eslintPluginPrettierRecommended.rules,
      "prettier/prettier": [
        "error",
        {
          endOfLine: "lf",
        },
      ],
    },
    settings: {
      "better-tailwindcss": {
        // tailwindcss 4: the path to the entry file of the css based tailwind config (eg: `src/global.css`)
        entryPoint: "public/assets/styles/globals.css",
      },
    },
  },
];

export default eslintConfig;
