# 주식도 AI — 프론트엔드 (React + Vite)

백엔드(`stock-ai-backend`)가 내려주는 **진짜 데이터**를 받아 보여주는 화면입니다. 탭 4개:
- 오늘의 시장(홈) — 코스피·코스닥·나스닥·다우 지수+그래프 + 시황·섹터 AI 분석
- 이슈 종목 — KRX 실데이터 기준 거래대금 상위·급등·급락 (카드 누르면 분석으로)
- 종목 분석 — 시세·PER·재무·공시·뉴스 + 동종업계 PER 비교 + 증권가 컨센서스 + AI 5섹션 분석
- 투자 유형 테스트 — KOFIA 표준 5등급 진단(이 탭은 서버 없이 동작)

## 먼저 백엔드를 켜세요
다른 터미널에서:
```bash
cd ../stock-ai-backend
uvicorn app.main:app --reload     # → http://localhost:8000
```

## 프론트엔드 실행
```bash
npm install
npm run dev                        # → http://localhost:5173
```

`vite.config.js` 가 `/api` 요청을 `localhost:8000` 으로 넘겨주므로(proxy) CORS 설정이 따로 필요 없습니다.
브라우저에서 **http://localhost:5173** 을 열면 됩니다.

## 참고
- AI 분석(종목 5섹션·시황·섹터)은 백엔드 `.env`(또는 Render 환경변수)에 `GEMINI_API_KEY` 가 있을 때만 나옵니다. 없으면 숫자·공시 등 데이터만 표시됩니다.
- 시세는 종가 기준이라 장중 실시간과 다를 수 있습니다.
