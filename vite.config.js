import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // progress.js pakai top-level await (untuk memilih implementasi
    // cloud/local secara dinamis) — target esnext memastikan itu didukung.
    target: "esnext",
  },
  esbuild: {
    target: "esnext",
  },
});
