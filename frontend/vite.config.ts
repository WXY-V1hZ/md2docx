import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  root: "frontend",
  build: {
    outDir: "../dist-frontend",
    emptyOutDir: true,
  },
});
