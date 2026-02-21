import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
  base: "./",
  plugins: [tailwindcss(), solidPlugin()],
  build: {
    outDir: "dist/renderer",
    emptyOutDir: false,
  },
});
