import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 개발 중 프론트(5173)에서 /api 호출을 백엔드(8000)로 넘겨줍니다 → CORS 걱정 없음
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,                 // 외부(터널)에서 접속 허용
    allowedHosts: true,         // 임시 공개 링크(cloudflared 등) 호스트 허용
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
