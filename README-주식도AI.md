# 주식도 AI — 테스트 가이드

## 🚀 가장 빠른 테스트 (5분, Node 없이도 OK)

백엔드만 켜도 내장 테스트 화면으로 **진짜 데이터**를 바로 볼 수 있어요.

1. `stock-ai-backend` 폴더에서 실행:
   - **Windows**: `start-backend.bat` 더블클릭
   - **macOS/Linux**: 터미널에서 `bash start-backend.sh`
2. 처음엔 라이브러리 설치로 몇 분 걸려요. "Uvicorn running" 이 뜨면 준비 끝.
3. 브라우저에서 **http://localhost:8000** → 종목명(삼성전자) 입력 → 진짜 시세·PER·재무·공시 확인!

✔ 확인 포인트: `http://localhost:8000/api/health` 에서 `"dart_key_loaded": true` 면 DART 키 정상.

## 🎨 전체 앱 테스트 (예쁜 화면, Node.js 필요)

백엔드를 켠 상태에서, `stock-ai-frontend` 폴더에서:
- **Windows**: `start-frontend.bat` 더블클릭
- **macOS/Linux**: `bash start-frontend.sh`

브라우저에서 **http://localhost:5173** → 🔥 이슈 종목 / 📈 종목 분석 / 🧭 내 유형 탭 테스트.

## 자주 겪는 문제

| 증상 | 해결 |
|---|---|
| 화면에 "서버에 연결하지 못했어요" | 백엔드 창이 켜져 있는지 확인 (둘 다 켜야 해요) |
| 첫 조회가 5~10초 느림 | 정상이에요. KRX 종목목록을 처음 받느라 그래요. 두 번째부터 빨라요 |
| 재무/공시가 비어 나옴 | 일부 종목(신규상장·우선주 등)은 DART 자료가 없을 수 있어요 |
| 이슈 종목 로딩이 오래 걸림 | 전 종목 시세를 받아 정렬해서 그래요 (10~20초 정도) |
| `pip`/`npm` 없다고 나옴 | Python(python.org) / Node.js(nodejs.org LTS) 설치 후 재실행 |

## (선택) "주식도AI 한마디" 켜기
`stock-ai-backend/.env` 에 `ANTHROPIC_API_KEY=sk-ant-...` 를 추가하면
진짜 숫자를 고등학생 눈높이로 풀어주는 한마디가 화면에 나타나요. (console.anthropic.com에서 키 발급)

## 보안
`.env` 의 DART 키는 깃·공개 장소에 올리지 마세요. 노출됐다면 opendart.fss.or.kr 에서 재발급.
