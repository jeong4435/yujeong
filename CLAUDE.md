# 주식도 AI (jusikdo-ai)

한국 주식을 **고등학생 눈높이**로 풀어주는 학습 도우미 웹앱. claude.ai 대화에서 바이브코딩으로 시작된 프로젝트이며, 전체 맥락은 `HANDOFF.md` 참고.

## 구조
```
stock-ai-backend/    FastAPI. DART·KRX에서 진짜 데이터 수집 → JSON API
stock-ai-frontend/   React(Vite). 화면. /api 를 백엔드(8000)로 프록시
```

## 실행
```bash
# 터미널 A
cd stock-ai-backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload          # :8000 (내장 테스트 페이지 포함)

# 터미널 B
cd stock-ai-frontend && npm install && npm run dev   # :5173
```
원클릭 스크립트: `start-backend.{bat,sh}`, `start-frontend.{bat,sh}`

## 백엔드 (Python 3.10+)
- `app/main.py` — 엔드포인트: `/api/stock/{query}`(종목 데이터), `/api/analyze/{query}`(+설명), `/api/explain/{query}`(설명만), `/api/trending`(KRX 거래대금 상위·급등·급락), `/api/health`
- `app/market.py` — FinanceDataReader(시세·거래량·등락률·종목명↔코드), pykrx(PER/PBR/EPS, trending). KRX 종목목록은 `lru_cache`.
- `app/dart.py` — OpenDartReader. 최근 6개월 공시, 사업보고서 재무(연결 CFS 우선, 당해 없으면 전년도 폴백).
- `app/explain.py` — (선택) Anthropic API로 진짜 숫자를 쉬운 말로 설명. `ANTHROPIC_API_KEY` 없으면 None 반환.
- **원칙: 모든 외부 호출은 try/except로 감싸 빈 값 반환. 절대 500으로 죽지 않게.**
- `.env` 에 `DART_API_KEY` (gitignore 처리됨). 커밋 금지.

## 프론트엔드 (React 18 + Vite)
- `src/App.jsx` — 탭 3개: 🔥이슈종목 / 📈종목분석 / 🧭내유형
- `src/components/Analyzer.jsx` — 숫자 먼저 렌더, 설명(`/api/explain`)은 비동기로 뒤에 채움
- `src/components/IssueBoard.jsx` — trending 카드. 클릭 → 분석 탭으로 종목 전달(`pendingQuery`)
- `src/components/Quiz.jsx` + `src/quizData.js` — 투자유형 진단(서버 불필요). 5문항 합산 5~15점 → 4유형
- `src/styles.css` — 디자인 토큰. 변경 시 여기만 수정

## 디자인 시스템 (반드시 유지)
- 색: 풀빛 배경 `#EBF0E8`, 종이 `#FBFCFA`, 잉크 `#1C2B26`, teal `#0F8B7A`, coral `#DD5A42`, amber `#FFD66B`
- 폰트: Pretendard 단일 (손글씨 Gaegu는 제거됨 — 다시 넣지 말 것)
- 시그니처: 노란 메모 박스 `.sa-note` + 라벨 **"주식도AI 한마디"** (구명 '선생님 한마디'에서 변경됨)
- 어조: 모든 사용자 노출 텍스트는 고등학생 눈높이. 전문용어는 첫 등장 시 괄호 풀이

## 제품 원칙 (절대 위반 금지)
1. **투자 권유 아님** — '사라/팔아라' 단정 표현 금지. 데이터 카드·설명·프롬프트 전부 해당
2. 면책 문구(`.sa-disc`)는 데이터 화면마다 유지 (종가 기준 안내, DART·증권사 확인 권고)
3. 손절·익절 % 는 '예시'로만 표기
4. AI 설명(`explain.py`)은 받은 숫자를 절대 바꾸지 않도록 프롬프트에 명시되어 있음 — 유지할 것

## 알려진 한계 / 주의
- 시세는 종가 기준(실시간 아님). 실시간이 필요하면 증권사 API(KIS·키움) 별도 연동 필요
- 첫 조회 5~10초(KRX 종목목록 로딩), `/api/trending` 10~20초(전 종목 수집·정렬)
- 일부 종목(신규상장·우선주·스팩)은 DART 재무/공시가 빈 값일 수 있음 — 정상 동작
- yfinance/네이버 계열 소스는 비공식이라 간헐적 실패 가능 — 빈 값 폴백이 설계 의도
- frontend는 `npm run build` 전체 빌드가 아직 한 번도 실행 안 됨(이전 환경 제약). 첫 빌드 시 오류 나오면 우선 수정 대상

## 다음 후보 작업 (대화에서 논의됨)
- 영업이익 3개년 추세 그래프
- 이슈 종목에 "왜 올랐나" 뉴스 한 줄
- 실시간 시세(증권사 API) 연동
