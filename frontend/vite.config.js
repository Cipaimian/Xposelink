import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    historyApiFallback: true,
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/xposelink.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: (info) => {
          const name = info.name || "";
          if (name.endsWith(".css")) return "assets/xposelink.css";
          return "assets/[name][extname]";
        },
        manualChunks: {
          // Heavy charting library — only loaded when user visits dashboard
          recharts: ["recharts"],
          // QR code library — only loaded when shorten result shows QR
          qrcode: ["qrcode.react"],
          // React core stays together in a vendor chunk
          react: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
