import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "./",
  plugins: [vue(), tailwindcss()],
  root: "frontend",
  build: {
    outDir: "../dist-frontend",
    emptyOutDir: true,
  },
});
