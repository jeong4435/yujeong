"""주식도 AI — 백엔드 (FastAPI)

엔드포인트
  GET /api/stock/{query}    : 진짜 데이터(시세·거래량·PER·재무·공시) JSON
  GET /api/analyze/{query}  : 위 데이터 + (키 있으면) 고등학생 눈높이 설명
  GET /                     : 간단한 테스트 화면

실행
  pip install -r requirements.txt
  uvicorn app.main:app --reload
  → http://localhost:8000
"""
import os
from dotenv import load_dotenv

load_dotenv()  # .env 의 DART_API_KEY 등을 환경변수로 로드

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from . import market, dart, explain, news

app = FastAPI(title="주식도 AI API", version="1.0")

# 로컬 프론트엔드(React 등)에서 호출할 수 있도록 CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_HERE = os.path.dirname(__file__)


@app.on_event("startup")
def _prewarm():
    """서버가 켜질 때 KRX 종목목록을 백그라운드로 미리 로딩.
    첫 사용자가 '목록 받느라 느린' 콜드 스타트를 겪지 않게 한다. (부팅은 막지 않음)"""
    import threading

    def warm():
        try:
            market.resolve("005930")   # KRX 종목목록 lru_cache 채우기
        except Exception:
            pass
        try:
            dart._corp_map()           # DART 기업코드 맵(코드↔고유번호) 미리 적재
        except Exception:
            pass

    threading.Thread(target=warm, daemon=True).start()


def _resolve(query: str):
    """질의 → (code, name) 또는 (None, 에러dict)."""
    code, name = market.resolve(query)
    if not code:
        return None, {"error": f"'{query}' 종목을 찾지 못했어요. 종목명 또는 6자리 코드로 다시 시도해 주세요."}
    return code, name


def _core(query: str) -> dict:
    """빠른 1차 데이터: 시세·PER·밸류해설. (가격 카드를 먼저 띄우기 위함)"""
    code, name = _resolve(query)
    if code is None:
        return name  # 에러 dict
    data = {"code": code, "name": name}
    data.update(market.quote(code))                   # price, volume, change_pct, as_of
    data["fundamentals"] = market.fundamentals(code)  # per, pbr, eps, forward_per
    data["value_analysis"] = market.value_analysis(data["fundamentals"], {})
    return data


def _details(query: str) -> dict:
    """느린 2차 데이터: 3개년 재무·공시·뉴스. (1차 화면 뒤에 채워 넣음)"""
    code, name = _resolve(query)
    if code is None:
        return name  # 에러 dict
    fin = dart.financials(code)                        # 3개년 추세 포함
    return {
        "financials": fin,
        "disclosures": dart.disclosures(code),         # 최근 공시 2건
        "news": news.recent_news(code),                # 최근 3개월 기사
        "analyst": market.analyst_info(code),          # 증권가 컨센서스·리포트·동종업계
        # 재무 추세까지 반영한 더 풍부한 밸류 해설로 업그레이드
        "value_analysis": market.value_analysis(market.fundamentals(code), fin),
    }


def _collect(query: str) -> dict:
    """1차+2차 전체 (analyze·explain 용)."""
    data = _core(query)
    if data.get("error"):
        return data
    data.update(_details(query))
    return data


@app.get("/api/stock/{query}")
def stock(query: str):
    """1차(빠름): 시세·PER·밸류해설."""
    return _core(query)


@app.get("/api/details/{query}")
def details(query: str):
    """2차(느림): 3개년 재무·공시·뉴스."""
    return _details(query)


@app.get("/api/analyze/{query}")
def analyze(query: str):
    data = _collect(query)
    if data.get("error"):
        return data
    data["explanation"] = explain.explain(data)  # 키 없으면 None
    return data


@app.get("/api/explain/{query}")
def explain_query(query: str):
    """진짜 데이터를 받아 '고등학생 눈높이' 설명만 반환. 키 없으면 explanation=null."""
    data = _collect(query)
    if data.get("error"):
        return data
    return {"explanation": explain.explain(data)}


@app.get("/api/peers/{query}")
def peers(query: str):
    """동종업계 PER·PBR 비교표(본인+같은 업종 최대 4 + 업종평균). 종목분석 별도 로드용."""
    code, name = _resolve(query)
    if code is None:
        return name  # 에러 dict
    return market.peer_valuation(code)


@app.get("/api/stocklist")
def stocklist():
    """종목 전체 목록(코드·이름). 프론트가 한 번 받아 클라에서 즉시 필터(자동완성)."""
    return {"stocks": market.stock_list()}


@app.get("/api/trending")
def trending():
    """KRX 실데이터 기반 이슈 종목(거래대금 상위·급등·급락)."""
    return market.trending()


@app.get("/api/indices")
def indices():
    """오늘의 시장 — 코스피·코스닥·나스닥·다우 지수값+등락률+그래프용 시계열. (빠름)"""
    return market.indices()


@app.get("/api/market-analysis")
def market_analysis():
    """오늘의 시장 — 시황·섹터 AI 분석. (느림, 키 없으면 analysis=null)"""
    return {"analysis": explain.market_overview(market.indices(), market.trending())}


@app.post("/api/portfolio-coach")
async def portfolio_coach_api(req: Request):
    """잔고 목록 + 투자유형 → Gemini 포트폴리오 AI 코칭 (3섹션)."""
    body = await req.json()
    holdings = body.get("holdings", [])
    invest_type = body.get("invest_type", "") or ""
    return {"coaching": explain.portfolio_coach(holdings, invest_type)}


@app.get("/api/examples")
def examples():
    """종목 분석 검색창 아래 예시 칩 = 전일 거래대금 TOP (하루 한 번 갱신)."""
    return market.example_tickers()


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "dart_key_loaded": bool(os.environ.get("DART_API_KEY")),
        "explain_enabled": bool(os.environ.get("GEMINI_API_KEY")),
    }


# ── 테스트용 정적 화면 ──
app.mount("/static", StaticFiles(directory=os.path.join(_HERE, "static")), name="static")


@app.get("/")
def index():
    return FileResponse(os.path.join(_HERE, "static", "index.html"))
