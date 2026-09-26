import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

// Physical-direction utilities break RTL. Use logical ones (ms/me/ps/pe/start/end).
const physicalDirection =
  "(^|[\\s:\"'`])-?(ml|mr|pl|pr|left|right|rounded-l|rounded-r|border-l|border-r|text-left|text-right)-";

export default [
  { ignores: [".next/**", ".open-next/**", "out/**", "node_modules/**", "next-env.d.ts", "src/types/database.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=/${physicalDirection}/]`,
          message: "Use logical utilities (ms/me/ps/pe/start/end/text-start) instead of left/right.",
        },
        {
          selector: `TemplateElement[value.raw=/${physicalDirection}/]`,
          message: "Use logical utilities (ms/me/ps/pe/start/end/text-start) instead of left/right.",
        },
      ],
    },
  },
];
