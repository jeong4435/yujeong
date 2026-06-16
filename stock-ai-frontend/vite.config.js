import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 개발 중 프론트(5173)에서 /api 호출을 백엔드(8000)로 넘겨줍니다 → CORS 걱정 없음
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
