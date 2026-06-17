"""시세·거래량·PER 등 '시장 데이터' 담당.
- FinanceDataReader: 종목 목록(이름↔코드), 일별 OHLCV(종가·거래량·등락률)
- 네이버 금융: PER/PBR/EPS 같은 펀더멘털
한 소스가 실패해도 전체가 죽지 않도록 모두 try/except로 감쌌습니다.
"""
import datetime as dt
from functools import lru_cache

import requests
import FinanceDataReader as fdr

from .cache import ttl_cache


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


@ttl_cache(120)  # 시세는 자주 바뀌니 2분만 캐시
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


@ttl_cache(43200)  # 전일 거래대금 TOP — 종가 데이터는 하루 한 번 갱신 → 12시간 캐시
def example_tickers(n: int = 5) -> dict:
    """종목 분석 검색창 아래 '예시 칩' = 전일 거래대금 상위 n개 종목명."""
    d, df = _recent_ohlcv()
    if df is None or len(df) == 0:
        return {}  # 빈 값은 캐싱 안 됨(다음에 재시도) → 프론트는 기본 목록으로 폴백
    top = df.sort_values("거래대금", ascending=False).head(n)
    names = [str(r.get("Name", "")) for _, r in top.iterrows() if str(r.get("Name", ""))]
    if not names:
        return {}
    return {"updated": f"{d} 종가 기준", "examples": names}


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
    """네이버 금융 통합 API에서 PER·PBR·EPS·예상PER. KRX가 막혀도 동작하는 메인 소스."""
    url = f"https://m.stock.naver.com/api/stock/{code}/integration"
    r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
    info = {x.get("code"): x.get("value") for x in (r.json().get("totalInfos") or [])}
    out = {
        "per": _parse_num(info.get("per")),
        "pbr": _parse_num(info.get("pbr")),
        "eps": _parse_num(info.get("eps")),
        "forward_per": _parse_num(info.get("cnsPer")),  # 증권사 예상이익 기준 PER
    }
    # per/pbr/eps 모두 비면 의미 없으니 빈 값 취급
    return out if any(out.get(k) is not None for k in ("per", "pbr", "eps")) else {}


@ttl_cache(600)  # PER/PBR 등은 10분 캐시
def fundamentals(code: str) -> dict:
    """PER·PBR·EPS·예상PER. 네이버 금융에서. 실패하면 빈 값."""
    try:
        return _fundamentals_naver(code)
    except Exception:
        return {}


def value_analysis(fu: dict, fin: dict) -> str:
    """PER을 중심으로 '지금 가격이 싼지 비싼지'를 고등학생 눈높이로 5줄 이내 설명.
    AI 키 없이도 동작하는 규칙 기반 텍스트. (단정적 매수·매도 표현 금지)"""
    fu = fu or {}
    per = fu.get("per")
    pbr = fu.get("pbr")
    fwd = fu.get("forward_per")
    net_dir = ((fin or {}).get("trend") or {}).get("net_income_dir")

    lines = []

    # 1) 적자/PER 없음
    if per is None or per <= 0:
        lines.append("이 회사는 최근 이익이 없거나 적자라서, '이익 대비 주가'인 PER로는 비싼지 싼지를 따지기 어려워요.")
        if pbr is not None:
            lines.append(f"대신 PBR(주가÷순자산)이 {pbr}배인데, 1배보다 낮으면 가진 자산보다 주가가 낮게 평가된 편이에요.")
        lines.append("이익이 흑자로 돌아서면 그때 PER로 다시 따져보는 게 좋아요.")
        return " ".join(lines[:5])

    # 2) PER 밴드 해석 (시장 평균 대략 10~15배 기준)
    if per < 10:
        band = f"PER이 {per}배예요. 회사가 버는 이익에 비하면 주가가 낮은 편(저평가 쪽)으로 볼 수 있어요."
    elif per < 15:
        band = f"PER이 {per}배로, 우리 시장 평균(보통 10~15배)과 비슷한 수준이에요."
    elif per < 25:
        band = f"PER이 {per}배예요. 시장 평균보다 조금 높아서, 앞으로 더 잘 벌 거란 기대가 어느 정도 들어가 있어요."
    elif per < 40:
        band = f"PER이 {per}배로 꽤 높은 편이에요. 그만큼 성장 기대가 주가에 많이 반영돼 있다는 뜻이에요."
    else:
        band = f"PER이 {per}배로 매우 높아요. 지금 이익만 보면 비싼 편이고, 큰 성장을 미리 기대한 가격이에요."
    lines.append(band)

    # 3) 예상 PER(미래이익 기준) 비교
    if fwd is not None and fwd > 0:
        if fwd < per * 0.8:
            lines.append(f"다만 증권사 예상이익 기준 PER은 {fwd}배로 더 낮아져요. 앞으로 이익이 늘 거란 기대가 깔려 있다는 신호예요.")
        elif fwd > per * 1.2:
            lines.append(f"반대로 예상이익 기준 PER은 {fwd}배로 더 높아져요. 앞으로 이익이 줄 수도 있다는 전망이 섞여 있어요.")
        else:
            lines.append(f"예상이익 기준 PER도 {fwd}배로 비슷해서, 이익 흐름이 안정적이라는 뜻이에요.")

    # 4) 이익 추세로 보강
    if net_dir in ("up", "mixed_up"):
        lines.append("최근 순이익이 늘어나는 흐름이라, 높은 PER이 어느 정도 설명돼요.")
    elif net_dir in ("down", "mixed_down"):
        lines.append("최근 순이익이 줄어드는 흐름이라, PER 숫자만 믿기보단 이익이 다시 늘지 같이 봐야 해요.")

    # 5) 마무리 — 비교의 중요성
    lines.append("PER은 같은 업종끼리 비교해야 의미가 커요. 한 숫자만으로 싸다·비싸다 단정하긴 어렵습니다.")
    return " ".join(lines[:5])
