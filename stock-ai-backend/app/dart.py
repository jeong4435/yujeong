"""OpenDART(전자공시) 담당.
- disclosures(): 최근 공시 목록
- financials(): 사업보고서 재무제표에서 매출액/영업이익/당기순이익
키가 없거나 라이브러리 미설치면 빈 값을 돌려주어 앱이 죽지 않게 합니다.
"""
import os
import datetime as dt

from .cache import ttl_cache

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


@ttl_cache(21600)  # 공시는 6시간 캐시 (자주 안 바뀜)
def disclosures(code: str, limit: int = 2) -> list:
    """최근 3개월 공시 중 최신 limit건."""
    d = _client()
    if d is None:
        return []
    try:
        start = (dt.date.today() - dt.timedelta(days=90)).strftime("%Y-%m-%d")
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


def _to_int(raw) -> int:
    """DART 금액 문자열('1,234' 또는 '-1,234')을 정수로. 실패하면 None."""
    try:
        s = str(raw).replace(",", "").strip()
        if s in ("", "-"):
            return None
        return int(float(s))
    except Exception:
        return None


def _trend_dir(vals):
    """3개년 값 리스트 → 'up'(상승)/'down'(하락)/'mixed'(혼조)/None."""
    xs = [v for v in vals if v is not None]
    if len(xs) < 2:
        return None
    ups = sum(1 for a, b in zip(xs, xs[1:]) if b > a)
    downs = sum(1 for a, b in zip(xs, xs[1:]) if b < a)
    if ups and not downs:
        return "up"
    if downs and not ups:
        return "down"
    # 등락 섞임 → 처음 대비 끝으로 큰 방향만 판정
    if xs[-1] > xs[0]:
        return "mixed_up"
    if xs[-1] < xs[0]:
        return "mixed_down"
    return "mixed"


@ttl_cache(43200)  # 재무제표는 분기에 한 번 갱신 → 12시간 캐시
def financials(code: str) -> dict:
    """최근 사업보고서에서 매출액·영업이익·당기순이익을 3개년(전전기·전기·당기)으로.
    DART finstate 한 건에 당기/전기/전전기 금액이 모두 들어있어 한 번에 추세를 만든다."""
    d = _client()
    if d is None:
        return {}
    last_year = dt.date.today().year - 1
    for year in (last_year, last_year - 1):  # 올해치 미공시면 전년도 보고서로
        try:
            df = d.finstate(code, year)  # 사업보고서(11011) 주요계정
        except Exception:
            df = None
        if df is None or len(df) == 0:
            continue

        def row(account_name):
            sub = df[df["account_nm"].astype(str).str.fullmatch(account_name, na=False)]
            if len(sub) == 0:  # 정확히 일치 없으면 부분일치
                sub = df[df["account_nm"].astype(str).str.contains(account_name, na=False)]
            if "fs_div" in sub.columns:  # CFS=연결, OFS=별도 → 연결 우선
                cfs = sub[sub["fs_div"] == "CFS"]
                if len(cfs):
                    sub = cfs
            if len(sub) == 0:
                return [None, None, None]
            r = sub.iloc[0]
            # [전전기, 전기, 당기] 순서(오래된 → 최신)
            return [
                _to_int(r.get("bfefrmtrm_amount")),
                _to_int(r.get("frmtrm_amount")),
                _to_int(r.get("thstrm_amount")),
            ]

        rev = row("매출액")
        op = row("영업이익")
        net = row("당기순이익")
        years = [year - 2, year - 1, year]

        # 셋 다 비면 이 보고서는 의미 없음 → 다음 후보 연도로
        if all(v is None for v in rev + op + net):
            continue

        return {
            "year": year,                         # 최신 연도(기존 호환)
            "revenue": rev[-1],                    # 최신값(기존 호환)
            "operating_profit": op[-1],
            "net_income": net[-1],
            "trend": {
                "years": years,
                "revenue": rev,
                "operating_profit": op,
                "net_income": net,
                "revenue_dir": _trend_dir(rev),
                "operating_profit_dir": _trend_dir(op),
                "net_income_dir": _trend_dir(net),
            },
        }
    return {}
