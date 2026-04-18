import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "dist/**",
      "node_modules/**",
      "playwright-report/**",
      "src/components/ui/sidebar.tsx",
      "test-results/**",
    ],
  },
];

export default config;
