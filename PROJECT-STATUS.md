# 주식도 AI — 프로젝트 현황 & 인수인계 (2026-06-17 기준)

> 이 문서 하나로 다음 세션이 프로젝트 전체를 이해할 수 있게 정리했습니다.
> 원래의 claude.ai 시작 맥락은 `HANDOFF.md`, Claude Code용 작업 지침은 `CLAUDE.md` 참고.
> **앞으로의 계획은 맨 아래 [별첨]** 에 있습니다.

---

## 1. 한 줄 요약
한국 주식을 **고등학생 눈높이**로 풀어주는 학습용 웹앱. DART·네이버·KRX의 **진짜 데이터**를 모아 "이 가격이 싼지 비싼지", "회사가 돈을 잘 버는지(3년 추세)", "최근 공시·뉴스"를 쉽게 보여준다. **이미 무료로 실배포 완료**.

## 2. 배포 현황 (실서비스 운영 중)
| 구성 | 주소 / 위치 | 비고 |
|---|---|---|
| 🌐 앱(프론트) | https://jusikdo-ai.vercel.app | Vercel, Root=`stock-ai-frontend` |
| ⚙️ 백엔드 | https://jusikdo-ai-backend.onrender.com | Render 무료, `render.yaml` Blueprint |
| ⏰ keep-alive | cron-job.org → `/api/health` 매 10분 | 콜드스타트 완화 |
| 📦 깃허브 | https://github.com/jeong4435/yujeong | `main` 브랜치 |
| 💰 비용 | **월 ₩0** | 무료 티어 조합(A안) |

- **업데이트 방법**: 코드 수정 후 `git push` → Vercel·Render가 **자동 재배포**.
- **프론트 환경변수**(Vercel): `VITE_API_BASE = https://jusikdo-ai-backend.onrender.com`
- **백엔드 환경변수**(Render): `DART_API_KEY` (필수), `ANTHROPIC_API_KEY`(선택, 현재 비어있음)
- 배포 절차 상세: `DEPLOY.md`

## 3. 아키텍처
```
[브라우저] → Vercel(정적 React) → fetch(VITE_API_BASE) → Render(FastAPI 백엔드)
                                                              ├─ FinanceDataReader (시세·종목목록)
                                                              ├─ 네이버 금융 API (PER/PBR/EPS/예상PER, 뉴스)
                                                              └─ DART REST API (3년 재무, 공시)
```
- **백엔드는 상태 없음(stateless) + DB 없음.** 요청마다 외부에서 받아 정리해 응답하고 잊는다.
- 유일한 "기억"은 **메모리 TTL 캐시**(서버 재시작 시 사라짐). → 사용자별 저장은 불가. (DB는 향후 Phase 1에서 도입 예정, 별첨 참고)

### 핵심: 점진적 로딩 (체감 속도)
- `GET /api/stock/{q}` = **1차(빠름)**: 시세·거래량·등락률·PER/PBR/EPS·예상PER·`value_analysis`(밸류 해설)
- `GET /api/details/{q}` = **2차(느림)**: 3개년 재무 추세·공시 2건·최근 3개월 뉴스
- 프론트가 1차를 먼저 그리고(가격 카드), 2차를 비동기로 뒤이어 채움(재무·공시·뉴스는 "불러오는 중…" → 자동 채움)

### 캐싱 (`app/cache.py`, 메모리 TTL)
시세 120초 / PER 등 600초 / 뉴스 3600초 / 공시 21600초 / 재무 43200초. 빈 값은 캐싱 안 함(다음에 재시도).
재조회는 사실상 즉시(0.2초). 첫 조회만 외부 호출 시간이 듦.

## 4. 데이터 소스 (어디서 무엇을)
| 데이터 | 소스 | 구현 |
|---|---|---|
| 시세·거래량·등락률, 종목명↔코드, 이슈종목(trending) | **FinanceDataReader** | `app/market.py` |
| PER·PBR·EPS·예상PER(cnsPer) | **네이버 금융** `m.stock.naver.com/api/stock/{code}/integration` | `app/market.py` |
| 3개년 재무(매출·영업이익·순이익), 공시 | **DART REST** (corpCode.xml + fnlttSinglAcntAll.json + list.json) | `app/dart.py` |
| 최근 3개월 종목 뉴스 | **네이버 금융 뉴스** | `app/news.py` |
| (선택) 쉬운 설명 | **Anthropic API** | `app/explain.py` — 키 없어 현재 비활성 |

## 5. 이번 세션에서 한 작업 (히스토리, 순서대로)
1. **실데이터 검증** — 백엔드 띄워 DART·KRX·네이버 실응답 확인. (시세·재무·공시·trending 정상)
2. **PER/PBR/EPS 복구** — 기존 `pykrx`가 KRX API 변경으로 완전히 깨져 있었음 → **네이버 금융**으로 교체.
3. **종목분석 강화** —
   - ① 밸류 해설(`value_analysis`): PER이 싼지 비싼지 + 예상PER·이익추세 반영, 규칙 기반(AI 키 불필요), 5줄 이내
   - ② DART **3개년 재무 추세표**(상승/하락/등락 방향 + 코멘트)
   - ③ 공시 최신 **2건**으로 축소 + **네이버 뉴스 카드**(최근 3개월) 신설
4. **잡정리** — 공시 제목 꼬리공백 `.strip()`, `npm run build` 최초 검증 통과.
5. **GitHub 최초 푸시** — `.gitignore` 작성(`.env`·`node_modules`·`docs_cache` 등 제외), `.env` 안 올라간 것 확인.
6. **임시 공개링크** — cloudflared로 시연 후 종료/정리.
7. **속도 1차** — 스레드 병렬 시도 → **오히려 느려짐(라이브러리 자원경합)** 실측 확인 → 순차 유지. 공시 범위 6→3개월.
8. **속도 2차** — **캐싱(`cache.py`)** + **점진적 로딩(`/api/stock`·`/api/details` 분리)** + **startup prewarm**(KRX 목록·DART 기업코드 맵 미리 적재). 재조회 8~10초 → 0.2초.
9. **pykrx 제거** — 항상 실패하는 죽은 폴백 + "KRX 로그인 실패" 경고 제거, 의존성 정리.
10. **중복 파일 정리** — 저장소 밖 부모폴더의 중복 `CLAUDE.md`·`HANDOFF.md`·`jusikdo-ai.zip`(구버전+.env 포함) 삭제.
11. **실배포(A안)** — Vercel(프론트)+Render(백엔드)+cron(핑). `api.js`를 `VITE_API_BASE`로 환경변수화, `render.yaml`·`DEPLOY.md` 작성.
12. **배포 후 핵심 버그 해결** — 배포된 `/api/details`가 Render 무료(512MB)에서 **메모리 초과(OOM)로 워커가 죽음**. 원인은 **OpenDartReader**(pandas + 전체 기업목록 상주). → **DART를 REST 직접호출로 재작성**(기업코드는 corpCode.xml 스트리밍 파싱 후 작은 dict만 캐시). 해결 확인(연속 호출 200 안정).

## 6. 주요 설계 결정 (왜 이렇게 했나)
- **하이브리드**: 숫자는 실제 API 값, AI/텍스트는 "설명만". 환각으로 가격이 틀릴 가능성 차단.
- **죽지 않는 백엔드**: 모든 외부 호출 try/except → 빈 값. 한 소스 실패해도 전체는 200.
- **점진적 로딩**: 총 시간은 같아도 가격 카드를 먼저 띄워 체감 속도↑.
- **병렬화 안 함**: FDR·DART 등 라이브러리가 스레드에서 자원 경합 → 병렬이 더 느림(실측). 순차 유지.
- **시세는 FDR 유지**: 네이버 가격은 직전 종가(날짜가 하루 다를 수 있음)라 이슈종목 탭(FDR)과 불일치 우려 → 일관성 위해 FDR.
- **DART는 REST 직접호출**: 무료 512MB 메모리 제약. OpenDartReader/pandas는 너무 무거움.

## 7. 알려진 한계 / 주의
- **콜드스타트**: Render 무료는 15분 미사용 시 잠듦 → 첫 조회 50초+ 가능. cron 핑으로 완화. (없애려면 Render Starter $7/월)
- **실시간 아님**: 시세는 종가 기준. 실시간은 KIS 등 증권사 API 연동 필요(별첨 7번).
- **AI 설명 비활성**: `ANTHROPIC_API_KEY` 없음. 넣으면 설명이 자연스러워지지만 *전문 투자조언이 되는 건 아님*(말투·개인화·맥락 연결 용도, 비용 발생).
- **DART 키 노출 이력**: 작업 중 채팅에 키가 노출됨 → 신경 쓰이면 opendart.fss.or.kr에서 **재발급 후 Render 환경변수만 교체**.
- **뉴스 일부**: 종목 뉴스에 시장 전반 기사가 섞여 나올 수 있음(네이버 클러스터 특성).
- **일부 종목**(신규상장·우선주·스팩): DART 재무/공시가 빈 값일 수 있음 — 정상 동작(폴백).

## 8. 로컬 개발 / 운영
```bash
# 백엔드 (Python 3.12)
cd stock-ai-backend && python -m venv .venv
.venv\Scripts\activate            # (mac/linux: source .venv/bin/activate)
pip install -r requirements.txt
uvicorn app.main:app --reload     # :8000

# 프론트 (개발 중엔 VITE_API_BASE 비워두면 vite proxy가 8000으로 넘김)
cd stock-ai-frontend && npm install && npm run dev   # :5173
```
- 의존성(백엔드): `fastapi, uvicorn, finance-datareader, requests, anthropic, python-dotenv` (※ pykrx·opendartreader 제거됨)
- 핵심 파일:
  - 백엔드: `app/main.py`(라우트·`_core`/`_details`/`_collect`·startup prewarm), `app/market.py`(quote·fundamentals·value_analysis·resolve·trending), `app/dart.py`(REST: corp map·financials 3년·disclosures), `app/news.py`, `app/cache.py`, `app/explain.py`
  - 프론트: `src/api.js`(VITE_API_BASE), `src/components/Analyzer.jsx`(점진로딩·추세표·뉴스), `Quiz.jsx`+`quizData.js`(투자유형 5문항→4유형), `IssueBoard.jsx`, `src/styles.css`
  - 배포: `render.yaml`, `DEPLOY.md`, `stock-ai-*/.env.example`

## 9. 제품 원칙 (절대 위반 금지)
1. **투자 권유 아님** — '사라/팔아라' 단정 금지. 데이터·설명·프롬프트 전부.
2. 면책 문구(`.sa-disc`) 데이터 화면마다 유지.
3. 손절·익절 %는 '예시'로만.
4. AI 설명은 받은 숫자를 절대 바꾸지 않도록 프롬프트에 명시(유지).
5. 디자인: 풀빛 배경/Pretendard/노란 메모박스 "주식도AI 한마디"(색·토큰은 `styles.css`).

---

# [별첨] 앞으로의 계획 (로드맵)

> 방침: **작은 것부터 천천히, 우선순위별로.** 한 번에 다 하지 않는다.

## 큰 그림 — 8개 희망 기능과 의존 관계
사용자가 원하는 기능 8가지는 대부분 **"이 사람의 데이터를 저장"** 해야 하므로, **로그인 + 데이터베이스(DB)** 라는 토대가 먼저 필요하다. (현재 앱엔 DB가 없음 — 5번 참고)

| 단계 | 기능 | 의존 | 난이도/리스크 |
|---|---|---|---|
| **0. 토대** | ① 구글 로그인 + DB | — | 중 (셋업이 관건) |
| **1. 첫 성과** | ② 내 유형 저장 → 분석 멘트 개인화 | 0 | 낮음·효과 큼 |
| **2. 잔고** | ③ 보유종목(평단·수량) 입력·저장 → ④ 매매 시 평단·수량 반영 | 0 | 중 |
| **3. 인사이트** | ⑥ 보유 종목 섹터 분석 → ⑤ 개인 맞춤 매수·매도 "참견" | 2 | 중·⑤는 규제 주의 |
| **4. 심화** | ⑦ KIS 실시간 시세·정확도 → ⑧ 증권사 애널리스트 보고서 크롤링 | 0~2 | 높음·리스크 큼 |

### 가로지르는 주의사항 (계속 지킬 것)
- **규제(⑤·⑧)**: 개별 종목 매수/매도 권유는 **투자자문업** 영역. 반드시 *교육·정보 제공*으로 한정 + 면책 유지. AI 키를 넣어도 마찬가지.
- **보안(③~⑦)**: 잔고는 민감정보. 로그인·행단위보안(RLS)·HTTPS 필수. **증권사 비밀번호 절대 저장 금지**(공식 OAuth/앱키만).
- **⑧ 크롤링**: 증권사 보고서는 대개 로그인 뒤 PDF + 약관상 크롤링 금지. 법적·기술적 리스크 큼 → **맨 뒤로**, 또는 허용된 소스로 범위 축소.
- **⑦ KIS**: 나중에 잔고 자동 불러오기로 ③④ 수동입력을 일부 대체 가능(수동으로 시작 → KIS로 자동화가 자연스러운 진화).
- **AI(Anthropic)**: 우선순위 낮음. 규칙 기반으로 Phase 1~3 만든 뒤 "설명 고도화" 단계에서 옵션으로. 비용(토큰) 발생.

## 추천 토대 기술 — Supabase
무료 한 곳에서 **구글 로그인 + Postgres DB + 행단위보안(RLS)** 제공. 현재 배포(Vercel·Render)와 잘 붙고 월 ₩0 유지.
**구조 방침**: Supabase를 "데이터+로그인" 계층으로 두고 **프론트가 직접 통신**. 파이썬 백엔드는 지금처럼 **상태 없는 계산·시세 서버**로 유지(분석 시 "유저 유형"만 파라미터로 받아 멘트 개인화). → 백엔드에 DB·비밀번호를 넣지 않아 단순·저비용 유지.

## Phase 1 상세 계획 (다음 세션에서 여기부터 시작)
**목표**: 구글 로그인 → 내 유형 저장 → 분석 멘트가 내 유형에 맞게 바뀐다.

- **결정 필요(미정)**: 로그인을 "선택"으로 할지 "필수"로 할지. (추천: **선택** — 비로그인도 다 쓰고, 로그인 시 개인화 *추가*)
- **데이터 모델** (Supabase `profiles` 테이블)
  - `id`(=구글 유저), `invest_score`(5~15), `invest_type`(safe/balanced/challenge/highrisk), `updated_at`
  - RLS: 자기 행만 read/write
- **작업 순서**
  1. **0단계 셋업**: Supabase 프로젝트 생성 + 구글 클라우드 OAuth 키 발급 → Supabase에 연결 (사용자가 클릭, 가이드 제공)
  2. **로그인**: `@supabase/supabase-js` 추가, 구글 로그인/로그아웃/세션, 우상단 프로필. 환경변수 `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY`(Vercel + `.env.example`)
  3. **내 유형 저장**: `Quiz.jsx` 완료 시 로그인 상태면 `profiles`에 upsert, 재방문 시 불러오기(비로그인은 기존 로컬 동작 유지)
  4. **멘트 개인화**: 백엔드 `value_analysis(fu, fin, user_type)`로 확장 → 유형별 맞춤 한마디 추가, `api.js`가 `?type=` 전달, 밸류 카드에 "🧭 내 유형에게" 노출
  5. 검증 + `git push`(자동 배포)

## 그 외 소소한 후보 (대화에서 언급됨)
- 영업이익 3개년 추세 **그래프**(현재는 표)
- 이슈 종목에 "왜 올랐나" 뉴스 한 줄
- 뉴스 종목 관련성 필터 강화
