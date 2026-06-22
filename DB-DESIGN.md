# 주식도 AI — Supabase DB 설계 (확정 2026-06-22)

> 전체 스키마 **설계 확정본**. 실제 적용은 기능 Phase별로 `supabase/migrations/*.sql`(DDL)로 작성·실행.
> 현황: 로그인(구글 OAuth)·`holdings` 표는 **이미 적용됨**. 나머지는 설계만 됨(미적용).
> 데이터 모델 요약은 `PROJECT-STATUS.md`, 본 문서가 상세 정본.

## 목표 (3가지를 한 설계로)
1. **사용자 효용** — 내 잔고·손익·매매 추적, 목표주가 추이, 섹터 분산 진단.
2. **배포 매력** — "다른 사람들은 어떤 종목을 얼마나 담았나"(익명 통계).
3. **운영자 인사이트** — 인기종목·섹터 쏠림·투자유형별 보유·목표주가 상향 종목 등.

## 핵심 설계 원칙 (프라이버시·법 — 개인정보보호법)
- **사용자끼리 원시 잔고 비공개**: 모든 소유 테이블 RLS = 본인 행만 read/write.
- **"남의 잔고 보기"는 익명 집계 RPC로만**: `security definer` 함수가 전체를 읽되 **개인 식별 없는 합계만** 반환 + **최소표본 k≥5**(보유자 5명 미만 종목은 결과에서 제외 → 역추적 차단).
- **운영자 = 집계 우선(2026-06-22 확정)**: 인사이트는 **집계(익명) 대시보드 중심**으로 본다. 개인 단위 데이터는 보관하되 운영자 상시 열람은 안 하고 **예외적(지원·디버깅) 접근만**(처리방침 고지·접근 최소화). → 사용자 거부감·법적 노출 동시 최소화, 인사이트는 집계로 동일 확보. service_role 키는 프론트에 **절대 미포함**(현재 anon 키만 — 올바름).
- **잔고 익명 집계 참여 = 기본 ON(opt-out)**: `profiles.share_aggregate bool default true`. 끄면 집계 RPC에서 그 사용자 제외. 집계엔 **금액(원) 미노출, 주식수·비율만**.
- 컨센서스·섹터는 **공개 시장정보**(개인정보 아님) → 저장·표시 자유, 출처표기+면책 유지.
- 회원 탈퇴 시 `on delete cascade`로 개인 데이터 전부 자동 삭제. **출시 전 개인정보처리방침 + 가입 동의 화면 필수**(금융데이터라 가능하면 전문가 확인).

## 테이블 (7개) — 공통: `id uuid default gen_random_uuid()`, RLS enable

### 소유 데이터 (RLS = `auth.uid() = user_id`, select/insert/update/delete 4종 모두)
| 표 | 핵심 컬럼 | 비고 |
|---|---|---|
| **`holdings`** ✅적용됨 | user_id, stock_code, stock_name, quantity, avg_price, updated_at, **unique(user_id,stock_code)** | 기준선(변경 없음). 집계용 `idx_holdings_stock_code` 추가 권고 |
| **`transactions`** | user_id, stock_code, stock_name, side`check(buy/sell)`, quantity, price, fee(기본0), traded_at, note | 매매 원장(진실원천). holdings는 이로부터 파생. 인덱스:(user_id,traded_at desc),(stock_code) |
| **`favorites`** | user_id, stock_code, stock_name, created_at, **unique(user_id,stock_code)** | 찜. 가볍고 "관심≠보유" 신호 → 포함 권장 |

### 프로필 (RLS = `auth.uid() = id`, 본인만)
| 표 | 핵심 컬럼 | 비고 |
|---|---|---|
| **`profiles`** | id(=auth.users PK·FK), invest_type`check(KOFIA5등급)`, invest_score`check(0~100)`, **share_aggregate bool default true**(익명집계 참여·opt-out), **share_portfolio bool default false**(식별형 공개·MVP제외), display_handle(unique·익명핸들), consent_version, consent_at, updated_at | 가입 시 `handle_new_user()` 트리거로 빈 행 자동생성 |

### 참조 마스터 (RLS: select=authenticated 허용 / insert·update·delete 정책 미생성 → service_role만 쓰기)
| 표 | 핵심 컬럼 | 비고 |
|---|---|---|
| **`sectors`** | **stock_code PK**, stock_name, industry_code, sector_name, source, updated_at | 종목→업종. 소스=네이버 industryCode(FDR엔 업종 컬럼 없음). 섹터 분산·쏠림 분석 기반 |
| **`consensus_history`** | stock_code, stock_name, snapshot_date, target_price, recomm_mean(3,2), recomm_label, current_price, **unique(stock_code,snapshot_date)** | 일별 스냅샷(멱등). **이중목적**: 사용자=목표주가 추이 / 운영자=상향 종목. 인덱스:(snapshot_date),(stock_code,snapshot_date desc) |

### 보류 — `search_logs`(검색 활동)
규제(행태정보 고지·동의)·용량 폭증 대비 인사이트 가치 낮음 → **초기 제외**. 필요 시 익명 집계만(user_id 미저장).

## "다른 사람 잔고 보기" = 익명 집계 RPC
`security definer` + `set search_path=public` + `grant execute … to authenticated`:
- **`popular_holdings(min_holders int default 5)`** → `[{stock_code, stock_name, holder_count, avg_qty, median_qty, avg_avg_price}]`. **참여자만 집계**(holdings ⋈ profiles where `share_aggregate=true`). `having count(distinct user_id) >= greatest(min_holders,5)`. **개별 user_id·정확 잔고·min/max 미반환**.
- **`holding_distribution(p_stock_code)`** → 특정 종목 `{holder_count, avg_qty, median_qty}`. 종목분석 화면 "이 종목, 이용자 N명이 평균 X주 보유" 한 줄(= 사용자 요구 직격).
- (선택) `popular_by_invest_type(p_type)` — type×stock 교차 그룹도 k≥5 적용.
- 확장: 사용자 수천 명 넘으면 동일 임계로 cron 집계 테이블(`popular_holdings_daily`)로 전환.

## 운영자 인사이트 카탈로그 (service_role/관리자 콘솔로 실행)
1. 인기 보유종목 TOP — holdings group by stock_code, count(distinct user_id)
2. 종목별 평균 수량·평단 분포
3. **섹터 쏠림** — holdings⋈sectors, sum(quantity·avg_price) by sector
4. **투자유형별 보유 성향** — holdings⋈profiles by invest_type
5. **목표주가 상향 종목** — consensus_history 자기조인(오늘>과거)
6. 상승여력 큰 종목 — (target_price−current_price)/current_price
7. 관심↔보유 갭 — favorites − holdings
8. 투자의견 개선 종목 — recomm_mean 시계열 상승
9. 최근 매수세 집중 — transactions(buy, 최근7일) by stock_code

> 3·5·6·8은 `sectors`/`consensus_history`가 있어야 성립 → 이중목적 실현 지점.

## 프라이버시·동의 설계
- **가입(또는 첫 잔고 입력) 시 고지**: "보유종목·평단·거래는 본인만 보며, 타 이용자에겐 익명 통계로만 집계. 운영자는 운영 목적 열람 가능." + 보존기간·문의처 → `consent_version`/`consent_at` 기록.
- **share_portfolio**: 기본 false(완전 비공개, 단 익명 집계엔 항상 포함—고지 명시). true+핸들 시에만 식별형 공개 가능. **단, 핸들 단위 개인 포트폴리오 공개(소셜 기능)는 MVP 제외**(집계만) — 법적 안전·배포 우선.
- 운영자 분석은 service_role 또는 `is_admin()` 가드 RPC로만(일반 사용자 RPC와 분리).

## 구축 순서 (holdings 완료 → 다음)
1. `profiles` + `handle_new_user()` 자동생성 트리거 (+ 가입 고지/동의 UI는 코드 단계)
2. `favorites` (가볍고 즉시 가치, 인사이트 조기 축적)
3. `sectors` + 백엔드 lazy upsert(종목 조회 시 채움)
4. 집계 RPC(`popular_holdings` 등, k≥5) — holdings/favorites 축적 후 "남의 잔고(익명) 보기" 출시
5. `transactions` + holdings 재계산(프론트 JS 1차 → 트리거 견고화)
6. `consensus_history` + **백엔드 cron 일별 스냅샷**(cron-job.org가 이미 핑 중 → `/internal/snapshot-consensus` 추가, `analyst_info()` 결과 service_role upsert)

## 열린 결정 2개 (구현 단계 전 확정, 권장값)
- **매도로 수량 0 도달 시 holdings 행**: 권장=**삭제**(깔끔). 대안=0 유지(거래이력 흔적).
- **핸들 단위 개인 포트폴리오 공개**: 권장=**MVP 제외**(집계만, 추후 opt-in). 소셜 기능 원하면 그때 `shared_portfolios` 뷰 추가.

## 데이터를 누가 채우나
- `sectors` = 사용자 조회 시 lazy upsert(+주기 보강). `consensus_history` = **cron 일별 스냅샷**(시계열 무결성). 둘 다 쓰기는 백엔드(service_role)만.
- 용량: consensus_history가 유일 대량원(컨센서스 있는 ~수백~1천 종목×365 ≈ 연 수십만 행, 무료 500MB 내). 2년 후 월별 압축 보존정책 권고.

## 데이터 원천 (백엔드 함수 — 이미 존재)
- `consensus_history` ← `app/market.py` `analyst_info()`의 `consensus.{target_price, recomm_mean, recomm_label}`
- `sectors` ← `app/market.py` `industryCompareInfo`/`industryCode` (peer 코드는 `itemCode`)
- 새 백엔드 라우트: `app/main.py`에 `/internal/snapshot-consensus`(cron 트리거) 신설 예정

## 구현 후 검증법
1. SQL Editor에서 DDL 실행 → Table Editor에 표 생성 확인.
2. **RLS 격리**: 사용자 A로 B의 holdings `select` → 0건(못 봄).
3. **집계 RPC**: `rpc('popular_holdings')` → 익명 합계만, holder_count<5 미포함, 개별 user_id/정확 잔고 미반환.
4. **transactions→holdings**: 매수 2건(가중평균)·매도 1건(수량차감) 후 평단·수량 정확.
5. **consensus cron**: 1회 실행 → 당일 행 1개/종목, 재실행 멱등(중복 없음).
6. **탈퇴 cascade**: 테스트 유저 삭제 → holdings/transactions/favorites/profiles 동반 삭제.
