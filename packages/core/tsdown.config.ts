import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/internal.ts"],
  exports: false,
  dts: true,
  sourcemap: true,
});
