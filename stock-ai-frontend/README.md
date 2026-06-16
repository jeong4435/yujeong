# 주식도 AI — 프론트엔드 (React + Vite)

백엔드(`stock-ai-backend`)가 내려주는 **진짜 데이터**를 받아 보여주는 화면입니다.
- 🔥 이슈 종목 — KRX 실데이터 기준 거래대금 상위·급등·급락 (카드 누르면 분석으로)
- 📈 종목 분석 — 시세·거래량·PER·재무·공시 + (키 있으면) 고등학생 눈높이 설명
- 🧭 내 유형 — 투자 성향 진단(이 탭은 서버 없이 동작)

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
- "선생님 한마디"(쉬운 설명)는 백엔드 `.env` 에 `ANTHROPIC_API_KEY` 가 있을 때만 나옵니다. 없으면 숫자·공시만 표시됩니다.
- 시세는 종가 기준이라 장중 실시간과 다를 수 있습니다.
