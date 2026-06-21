# 주식도 AI (jusikdo-ai)

한국 주식을 **고등학생 눈높이**로 풀어주는 학습 도우미 웹앱.

> **📌 먼저 `PROJECT-STATUS.md`를 읽으세요.** 현재 배포 상태·아키텍처·세션 히스토리·앞으로의 계획(로드맵)이 모두 거기 정리돼 있습니다. (`HANDOFF.md`는 최초 claude.ai 시작 맥락)
>
> **이미 무료로 실배포됨**: 앱 https://jusikdo-ai.vercel.app · 백엔드 https://jusikdo-ai-backend.onrender.com · 깃허브 https://github.com/jeong4435/yujeong · 업데이트는 `git push`로 자동 재배포.

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

## 백엔드 (Python 3.12)
- `app/main.py` — 엔드포인트: `/api/stock/{q}`(**1차 빠름**: 시세·PER·밸류해설), `/api/details/{q}`(**2차 느림**: 3년재무·공시·뉴스·애널리스트), `/api/peers/{q}`(동종업계 PER 비교, 별도로드), `/api/analyze`(+설명), `/api/explain`(설명만), `/api/trending`, `/api/indices`(오늘의 시장 지수), `/api/market-analysis`(시황·섹터 AI), `/api/examples`, `/api/health`. startup에서 KRX목록·DART기업코드 prewarm.
- `app/market.py` — FinanceDataReader(시세·등락률·종목명↔코드·trending·**지수**), **네이버 금융**(PER/PBR/EPS/예상PER + **애널리스트 정보**), `value_analysis`(밸류 해설). KRX 목록은 `lru_cache`. ※ pykrx 제거됨
  - `indices()` — 오늘의 시장: 코스피(KS11)·코스닥(KQ11)·나스닥(IXIC)·다우(DJI) 최신값+등락률+스파크라인용 종가 25개. 미국지수는 Change 없어 종가차로 계산. 캐시 300s. ※그래프는 추후 증권사 실시간 API로 교체 예정.
  - `_integration_raw(code)` — 네이버 통합API 원본(캐시 600s). 펀더멘털·애널리스트가 한 응답 → 1회 호출 공용.
  - `analyst_info(code)` — **증권가 컨센서스**(목표주가 평균·투자의견 1~5→한글라벨) + **최근 증권사 리포트**(증권사·제목·날짜·**원문링크** 5건, url=`finance.naver.com/research/company_read.naver?nid={id}` 네이버 리서치 상세→PDF) + **동종업계**(종목명·당일등락 5개). `consensusInfo`/`researches`/`industryCompareInfo`에서 추출.
  - `peer_valuation(code)` — **동종업계 PER·PBR 비교표**(본인+같은 업종 4 + **중앙값**). peer코드는 `industryCompareInfo`의 itemCode, peer별 PER은 `fundamentals(peer)` 재사용. **평균 대신 중앙값**(적자·저이익 종목의 초고PER 이상치 방어). 캐시 1800s.
- `app/dart.py` — **DART REST 직접호출**(corpCode.xml→기업코드 dict, fnlttSinglAcntAll.json→3년재무, list.json→공시). ※ OpenDartReader 제거됨(메모리 문제로 교체)
- `app/news.py` — 네이버 종목 뉴스(최근 3개월).
- `app/cache.py` — 메모리 TTL 캐시(시세120s/PER600s/뉴스3600s/공시21600s/재무43200s, 빈값 미캐시).
- `app/explain.py` — **Gemini 분석**(`GEMINI_API_KEY` 있을 때만, 없으면 None). 모델 `MODEL_CANDIDATES` 자동 폴백(현재 `gemini-2.5-flash`, 1.5 시리즈는 2025년 은퇴). 공통 호출은 `_generate(prompt)`.
  - `explain(data)` — **개별 종목 5섹션**(`▌`): 밸류·펀더멘털·최근이슈·**증권가 시각**·종합. 재무·공시·뉴스 + 애널리스트 컨센서스·리포트·동종업계 통합.
  - `market_overview(indices, trending)` — **오늘의 시장 2섹션**(`▌`): **시황**(국내외 지수 종합)·**섹터**(거래대금/급등/급락 종목으로 업종 추론).
  - **직접 매수/매도 권유 금지**(증권가 목표주가는 '인용'하되 우리 권유로 표현 안 함).
- **원칙: 모든 외부 호출 try/except → 빈 값. 절대 500으로 죽지 않게.** 스레드 병렬화는 라이브러리 경합으로 역효과(순차 유지).
- `.env` 에 `DART_API_KEY` (gitignore). 커밋 금지. 배포 환경변수는 Render에 등록됨.

## 프론트엔드 (React 18 + Vite)
- `src/App.jsx` — 탭 4개(왼→오): **오늘의 시장**(기본·홈) / 이슈 종목 / 종목 분석 / 투자 유형 테스트. 워드마크 클릭=오늘의 시장.
- `src/components/MarketToday.jsx` — **오늘의 시장**: `/api/indices`로 코스피·코스닥·나스닥·다우 카드(값·등락률·**스파크라인 SVG**, 상승빨강/하락파랑) + `/api/market-analysis`로 시황·섹터 AI(`▌`2섹션). **섹터 섹션은 섹터·테마명(`SECTORS` 목록)을 형광펜 강조**(`highlightSectors`→`.sa-sector-hl` 바이올렛 마커). 그래프는 종가 시계열(추후 증권사 실시간 교체).
- `src/components/Analyzer.jsx` — 점진적 로딩: `/api/stock`(가격·PER) 먼저 렌더 → `/api/details`·`/api/explain`·`/api/peers`는 각각 비동기로 뒤에 채움. 카드: AI 분석(`sa-analysis`, `▌`5섹션) + **동종업계 PER 비교표**(`sa-peer`, 중앙값보다 낮으면 파랑/높으면 빨강) + **증권가 카드**(목표주가·**상승여력 게이지** `sa-target-gauge`·투자의견·리포트). ※목표주가 '날짜별 추이'는 무료 시계열이 없어 미구현 → DB(Supabase) 도입 시 매일 스냅샷으로 구현 예정.
- `src/api.js` — `VITE_API_BASE`로 백엔드 주소 분리(개발은 비워두면 vite proxy)
- `src/components/IssueBoard.jsx` — trending 카드. 클릭 → 분석 탭으로 종목 전달(`pendingQuery`)
- `src/components/Quiz.jsx` + `src/quizData.js` — 투자유형 테스트(서버 불필요). **KOFIA 표준 체계**: 7문항(위험감내·기간·연령·경험·투자자금비중·목적·집중도) **가중치 적용 가중평균 0~100점** → 표준 컷오프(20/40/60/80) → **5등급**(안정형·안정추구형·위험중립형·적극투자형·공격투자형). ※ 등급·구간은 KOFIA 표준, 세부 배점은 표준 틀 기반 대표값(교육용). `computeScore()`·`getType()`
- `src/styles.css` — 디자인 토큰. 변경 시 여기만 수정

## 디자인 시스템 (2026-06 새 디자인 — 토스증권 톤 참고)
> ※ 구 디자인(풀빛 초록 배경 `#EBF0E8`·teal·노란 메모박스)은 **폐기**됨. 다시 넣지 말 것.
- **색(토큰은 `styles.css` `:root`)**: 흰 배경 `#FFFFFF`, 잉크 `#191F28`/`#333D4B`, 회색 `#8B95A1`, 라인 `#EFF1F4`, 연회색 면 `#F4F6F8`, 밝은회색 버튼 `#F2F4F6`
- **포인트색 = 바이올렛** `--accent #6C5CE7`(진하게 `#5B4BD6`, 연하게 `#F0EEFF`). 버튼·CTA·활성탭·포커스·`.sa-chip`·하이라이트에 사용. (토스블루 안 씀 — 가격색과 구분)
- **가격 등락 = 상승 빨강 `#F04452` / 하락 파랑 `#3182F6`** (한국 증시 관례). 클래스: 상승 `.v-over`/`.up`, 하락 `.v-under`/`.down`. 재무 추세도 증가=빨강·감소=파랑.
- 폰트: Pretendard 단일 (손글씨 Gaegu는 제거됨 — 다시 넣지 말 것)
- 시그니처: 메모 박스 `.sa-note` + 라벨 **"주식도AI 한마디"** — **무채색(연회색)** 으로 변경(노란 박스 폐기). 텍스트 정체성은 유지.
- 헤더: 로고 심볼(`株`) 제거 → **텍스트 워드마크 `.sa-wordmark`**("주식도 AI", AI만 보라). 누르면 홈(이슈 탭).
- 톤: 흰 바탕·넓은 여백·큰 숫자·플랫(얇은 회색 테두리 카드). 강조색은 바이올렛/빨강/파랑 3색만, 나머지는 흰·회색.
- 어조: 모든 사용자 노출 텍스트는 고등학생 눈높이. 전문용어는 첫 등장 시 괄호 풀이
- **시안 파일**: `jusikdo-ai/mockup-design.html`(최종 톤), `mockup-nav.html`(내비 구조) — 디자인 참고용 정적 HTML.

## 제품 원칙 (절대 위반 금지)
1. **투자 권유 아님** — '사라/팔아라' 단정 표현 금지. 데이터 카드·설명·프롬프트 전부 해당
2. 면책 문구(`.sa-disc`)는 데이터 화면마다 유지 (종가 기준 안내, DART·증권사 확인 권고)
3. 손절·익절 % 는 '예시'로만 표기
4. AI 설명(`explain.py`)은 받은 숫자를 절대 바꾸지 않도록 프롬프트에 명시되어 있음 — 유지할 것

## 알려진 한계 / 주의
- **Render 무료 콜드스타트**: 15분 미사용 시 잠듦 → 첫 조회 50초+. cron-job.org가 10분마다 `/api/health` 핑으로 완화.
- 시세는 종가 기준(실시간 아님). 실시간은 KIS 등 증권사 API 별도 연동(로드맵 ⑦).
- 캐시 후 재조회는 즉시(0.2초). 첫 조회만 외부 호출 시간.
- 일부 종목(신규상장·우선주·스팩)은 DART 재무/공시 빈 값 가능 — 정상(폴백).
- 네이버 계열 소스는 비공식 — 간헐적 실패 시 빈 값 폴백(설계 의도).
- DART 키가 작업 중 채팅에 노출된 이력 → 신경 쓰이면 재발급 후 Render 환경변수 교체.
- ※ `npm run build`·메모리(OOM)·pykrx/OpenDartReader 이슈는 모두 해결됨(`PROJECT-STATUS.md` 5번 참고).

## 앱의 핵심 3요소 (사용자가 "꼭 기억" 강조 — 2026-06-17)
1. **종목 정보 취합** — 시세·PER·재무·공시·뉴스 (현재 잘 되고 있음)
2. **AI 분석·조언** — 시장·섹터·개별종목 분석. ← **가장 중요한 차별점.** Gemini 연결 완료(`explain.py`), 계속 고도화 대상.
3. **로그인 시 개인 포트폴리오** — 보유종목·매매기록·AI 조언 (천천히 개발)

→ **우선순위 재조정(2026-06-17)**: 기존 "인프라(로그인·DB) 먼저" → **"핵심 가치(2번 AI 분석) 먼저"** 로 변경. AI 분석이 좋아져야 로그인할 동기가 생김. Supabase/로그인은 그 다음.

## 앞으로의 계획
**`PROJECT-STATUS.md`의 [별첨] 로드맵 참고.** 요약: ① **AI 분석 고도화(최우선, 진행중)** → ② 공개 리포트 소스 조사 → ③ Supabase(로그인+DB) → ④ 개인 포트폴리오. "작은 것부터, 우선순위별로."
- **AI = Gemini**(`gemini-2.5-flash`, 무료 티어). 모델명은 `MODEL_CANDIDATES` 자동 폴백. `GEMINI_API_KEY`는 Render 환경변수. (Anthropic은 비용 때문에 미채택)
