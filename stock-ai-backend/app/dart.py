"""OpenDART(전자공시) 담당.
- disclosures(): 최근 공시 목록
- financials(): 사업보고서 재무제표에서 매출액/영업이익/당기순이익
키가 없거나 라이브러리 미설치면 빈 값을 돌려주어 앱이 죽지 않게 합니다.
"""
import os
import datetime as dt

try:
    import OpenDartReader
except Exception:
    OpenDartReader = None

_client_cache = None


def _client():
    global _client_cache
    if _client_cache is not None:
        return _client_cache
    key = os.environ.get("DART_API_KEY")
    if not key or OpenDartReader is None:
        return None
    try:
        _client_cache = OpenDartReader(key)
    except Exception:
        _client_cache = None
    return _client_cache


def disclosures(code: str, limit: int = 5) -> list:
    """최근 6개월 공시 중 최신 limit건."""
    d = _client()
    if d is None:
        return []
    try:
        start = (dt.date.today() - dt.timedelta(days=180)).strftime("%Y-%m-%d")
        df = d.list(code, start=start)
        if df is None or len(df) == 0:
            return []
        out = []
        for _, r in df.head(limit).iterrows():
            out.append({
                "date": str(r.get("rcept_dt", "")).strip(),
                "title": str(r.get("report_nm", "")).strip(),
            })
        return out
    except Exception:
        return []


def financials(code: str) -> dict:
    """가장 최근 사업보고서의 매출액·영업이익·당기순이익(연결 우선)."""
    d = _client()
    if d is None:
        return {}
    last_year = dt.date.today().year - 1
    for year in (last_year, last_year - 1):  # 올해치 미공시면 전년도로
        try:
            df = d.finstate(code, year)  # 사업보고서(11011) 재무제표 주요계정
        except Exception:
            df = None
        if df is None or len(df) == 0:
            continue

        def pick(account_name):
            sub = df[df["account_nm"].astype(str).str.contains(account_name, na=False)]
            if "fs_div" in sub.columns:  # CFS=연결, OFS=별도 → 연결 우선
                cfs = sub[sub["fs_div"] == "CFS"]
                if len(cfs):
                    sub = cfs
            if len(sub) == 0:
                return None
            raw = str(sub.iloc[0].get("thstrm_amount", "")).replace(",", "").strip()
            try:
                return int(raw)
            except Exception:
                return None

        return {
            "year": year,
            "revenue": pick("매출액"),
            "operating_profit": pick("영업이익"),
            "net_income": pick("당기순이익"),
        }
    return {}
