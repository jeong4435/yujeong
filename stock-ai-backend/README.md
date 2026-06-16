# 주식도 AI — 백엔드 (Python / FastAPI)

DART(전자공시)·KRX·야후에서 **진짜 주식 데이터**를 가져와 JSON으로 돌려주는 백엔드입니다.
프론트엔드는 이 서버만 호출하면 되고, API 키와 외부 호출은 전부 서버가 처리합니다.

## 가져오는 데이터
- **시세·거래량·등락률** — FinanceDataReader (KRX/네이버/야후)
- **PER·PBR·EPS** — pykrx
- **재무제표(매출·영업이익·순이익)·최근 공시** — OpenDART (`OpenDartReader`)
- (선택) **고등학생 눈높이 설명** — Anthropic API. `ANTHROPIC_API_KEY`가 있을 때만 작동

## 실행 방법

```bash
# 1) (권장) 가상환경
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# 2) 설치
pip install -r requirements.txt

# 3) 키 확인 — .env 에 DART_API_KEY 가 들어 있습니다.
#    (설명 기능을 쓰려면 .env 에 ANTHROPIC_API_KEY 도 채우세요)

# 4) 실행
uvicorn app.main:app --reload
```

브라우저에서 **http://localhost:8000** → 종목명/코드 입력해 테스트.

## 엔드포인트
| 경로 | 설명 |
|---|---|
| `GET /api/stock/삼성전자` 또는 `/api/stock/005930` | 진짜 데이터 JSON |
| `GET /api/analyze/삼성전자` | 위 + (키 있으면) 쉬운 설명 |
| `GET /api/health` | 키 로드 상태 확인 |

예시:
```bash
curl http://localhost:8000/api/stock/005930
```

## 보안
- `.env` 는 `.gitignore` 로 빠져 있습니다. **절대 깃에 올리지 마세요.**
- DART 키가 외부에 노출됐다면 opendart.fss.or.kr 에서 재발급하세요.

## 알아두기 (한계)
- 시세는 보통 **종가 기준**이라 장중 실시간이 아닙니다. 실시간이 필요하면 증권사 API(한국투자 KIS·키움)를 붙여야 합니다.
- 야후/네이버 소스는 비공식이라 가끔 지연·오류가 날 수 있습니다. DART는 공식 API입니다.
- 첫 조회는 KRX 전체 종목목록을 받느라 몇 초 걸릴 수 있고, 이후엔 캐시되어 빨라집니다.
