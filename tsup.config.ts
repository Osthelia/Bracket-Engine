import { defineConfig } from "tsup";

const shared = { format: ["esm" as const], dts: true, sourcemap: true, target: "es2022" as const };

export default defineConfig([
  // Pure engine, safe to import from server code
  { ...shared, entry: { index: "src/index.ts" }, clean: true },
  // Components run on the client only, so a server component must not evaluate them
  {
    ...shared,
    entry: { "react/index": "src/react/index.ts" },
    external: ["react", "react/jsx-runtime", "@xyflow/react"],
    banner: { js: '"use client";' },
  },
]);
