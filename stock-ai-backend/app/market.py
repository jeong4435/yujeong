"""시세·거래량·PER 등 '시장 데이터' 담당.
- FinanceDataReader: 종목 목록(이름↔코드), 일별 OHLCV(종가·거래량·등락률)
- pykrx: PER/PBR/EPS 같은 펀더멘털
한 소스가 실패해도 전체가 죽지 않도록 모두 try/except로 감쌌습니다.
"""
import datetime as dt
from functools import lru_cache

import requests
import FinanceDataReader as fdr

try:
    from pykrx import stock as krx
except Exception:
    krx = None


@lru_cache(maxsize=1)
def _listing():
    """KRX 전체 상장 종목 목록(코드·이름). 한 번 불러 캐시."""
    df = fdr.StockListing("KRX")
    # FDR 버전에 따라 컬럼명이 다를 수 있어 표준화
    cols = {c.lower(): c for c in df.columns}
    code_col = cols.get("code") or cols.get("symbol") or df.columns[0]
    name_col = cols.get("name") or "Name"
    df = df.rename(columns={code_col: "Code", name_col: "Name"})
    df["Code"] = df["Code"].astype(str).str.zfill(6)
    return df[["Code", "Name"]]


def code_to_name(code: str) -> str:
    try:
        df = _listing()
        m = df[df["Code"] == code]
        return str(m.iloc[0]["Name"]) if len(m) else code
    except Exception:
        return code


def resolve(query: str):
    """입력을 (종목코드, 종목명)으로 변환.
    - 6자리 숫자면 코드로 간주
    - 아니면 이름으로 검색(정확히 일치 우선, 없으면 부분일치)
    """
    q = (query or "").strip()
    if q.isdigit() and len(q) == 6:
        return q, code_to_name(q)
    try:
        df = _listing()
        exact = df[df["Name"] == q]
        hit = exact if len(exact) else df[df["Name"].str.contains(q, na=False)]
        if len(hit):
            row = hit.iloc[0]
            return str(row["Code"]).zfill(6), str(row["Name"])
    except Exception:
        pass
    return None, None


def quote(code: str) -> dict:
    """최근 종가·거래량·등락률."""
    try:
        df = fdr.DataReader(code)
        if df is None or len(df) == 0:
            return {}
        last = df.iloc[-1]
        change = last.get("Change", 0)  # FDR의 Change는 비율(0.013 = +1.3%)
        return {
            "price": int(last["Close"]),
            "volume": int(last["Volume"]),
            "change_pct": round(float(change) * 100, 2) if change == change else None,
            "as_of": str(df.index[-1].date()),
        }
    except Exception:
        return {}


def _recent_ohlcv():
    """FinanceDataReader StockListing으로 당일 전체 종목 시세를 가져온다."""
    try:
        df = fdr.StockListing("KRX")
        # 컬럼 표준화
        df = df.rename(columns={
            "Changes": "등락액",
            "ChagesRatio": "등락률",
            "Volume": "거래량",
            "Amount": "거래대금",
            "Close": "종가",
        })
        df = df[df["거래대금"] > 0].copy()
        today = dt.date.today().strftime("%Y-%m-%d")
        return today, df
    except Exception:
        return None, None


def trending(top: int = 5) -> dict:
    """KRX 실데이터 기반 '이슈 종목': 거래대금 상위 / 급등 / 급락."""
    d, df = _recent_ohlcv()
    if df is None or len(df) == 0:
        return {"updated": None, "groups": []}

    def rows(sub):
        out = []
        for _, r in sub.iterrows():
            chg = r.get("등락률")
            out.append({
                "code": str(r.get("Code", "")).zfill(6),
                "name": str(r.get("Name", "")),
                "price": int(r["종가"]) if r["종가"] == r["종가"] else 0,
                "change_pct": round(float(chg), 2) if chg == chg else None,
                "volume": int(r["거래량"]) if r["거래량"] == r["거래량"] else 0,
                "value": int(r["거래대금"]) if r["거래대금"] == r["거래대금"] else None,
            })
        return out

    by_value = df.sort_values("거래대금", ascending=False).head(top)
    gainers = df.sort_values("등락률", ascending=False).head(top)
    losers = df.sort_values("등락률", ascending=True).head(top)
    return {
        "updated": f"{d} 종가 기준",
        "groups": [
            {"label": "💰 거래대금 상위", "desc": "오늘 돈이 가장 많이 몰린 종목", "stocks": rows(by_value)},
            {"label": "🚀 급등 TOP", "desc": "가장 많이 오른 종목", "stocks": rows(gainers)},
            {"label": "📉 급락 TOP", "desc": "가장 많이 내린 종목", "stocks": rows(losers)},
        ],
    }


def _parse_num(x):
    """'27.76배', '12,372원' 같은 문자열에서 숫자만 뽑아 float로."""
    try:
        s = str(x).replace(",", "").strip()
        # 숫자·소수점·음수기호만 남기기 (뒤의 '배'·'원' 등 단위 제거)
        keep = "".join(ch for ch in s if ch.isdigit() or ch in ".-")
        if keep in ("", "-", "."):
            return None
        return round(float(keep), 2)
    except Exception:
        return None


def _fundamentals_naver(code: str) -> dict:
    """네이버 금융 통합 API에서 PER·PBR·EPS. KRX가 막혀도 동작하는 메인 소스."""
    url = f"https://m.stock.naver.com/api/stock/{code}/integration"
    r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
    info = {x.get("code"): x.get("value") for x in (r.json().get("totalInfos") or [])}
    out = {
        "per": _parse_num(info.get("per")),
        "pbr": _parse_num(info.get("pbr")),
        "eps": _parse_num(info.get("eps")),
    }
    # 셋 다 비면 의미 없으니 빈 값 취급
    return out if any(v is not None for v in out.values()) else {}


def _fundamentals_pykrx(code: str) -> dict:
    """폴백: pykrx. (KRX API 변경 시 빈 값 반환 — 그래도 죽지 않음)"""
    if krx is None:
        return {}
    try:
        today = dt.date.today()
        start = (today - dt.timedelta(days=12)).strftime("%Y%m%d")
        end = today.strftime("%Y%m%d")
        df = krx.get_market_fundamental_by_date(start, end, code)
        if df is None or len(df) == 0:
            return {}
        last = df.iloc[-1]
        return {
            "per": _parse_num(last.get("PER")),
            "pbr": _parse_num(last.get("PBR")),
            "eps": _parse_num(last.get("EPS")),
        }
    except Exception:
        return {}


def fundamentals(code: str) -> dict:
    """PER·PBR·EPS. 네이버 금융을 메인으로, 실패하면 pykrx로 폴백."""
    try:
        out = _fundamentals_naver(code)
        if out:
            return out
    except Exception:
        pass
    return _fundamentals_pykrx(code)
