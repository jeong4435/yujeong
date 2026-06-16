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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from . import market, dart, explain

app = FastAPI(title="주식도 AI API", version="1.0")

# 로컬 프론트엔드(React 등)에서 호출할 수 있도록 CORS 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_HERE = os.path.dirname(__file__)


def _collect(query: str) -> dict:
    code, name = market.resolve(query)
    if not code:
        return {"error": f"'{query}' 종목을 찾지 못했어요. 종목명 또는 6자리 코드로 다시 시도해 주세요."}
    data = {"code": code, "name": name}
    data.update(market.quote(code))                 # price, volume, change_pct, as_of
    data["fundamentals"] = market.fundamentals(code)  # per, pbr, eps
    data["financials"] = dart.financials(code)        # year, revenue, operating_profit, net_income
    data["disclosures"] = dart.disclosures(code)      # 최근 공시 목록
    return data


@app.get("/api/stock/{query}")
def stock(query: str):
    return _collect(query)


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


@app.get("/api/trending")
def trending():
    """KRX 실데이터 기반 이슈 종목(거래대금 상위·급등·급락)."""
    return market.trending()


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "dart_key_loaded": bool(os.environ.get("DART_API_KEY")),
        "explain_enabled": bool(os.environ.get("ANTHROPIC_API_KEY")),
    }


# ── 테스트용 정적 화면 ──
app.mount("/static", StaticFiles(directory=os.path.join(_HERE, "static")), name="static")


@app.get("/")
def index():
    return FileResponse(os.path.join(_HERE, "static", "index.html"))
