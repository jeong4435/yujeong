"""OpenDART(전자공시) 담당 — REST API를 직접 호출(가벼움).
- disclosures(): 최근 공시 목록
- financials(): 사업보고서 재무제표에서 매출액/영업이익/당기순이익(3개년)

무거운 OpenDartReader(+pandas, 전체 기업목록 DataFrame) 대신 requests로 직접 호출해
메모리 사용을 크게 줄였습니다(무료 호스팅 512MB에서도 동작). 키/네트워크 실패 시 빈 값 반환.
"""
import os
import io
import zipfile
import datetime as dt
import xml.etree.ElementTree as ET
from functools import lru_cache

import requests

from .cache import ttl_cache

_BASE = "https://opendart.fss.or.kr/api"


def _key():
    return os.environ.get("DART_API_KEY")


@lru_cache(maxsize=1)
def _corp_map() -> dict:
    """DART 기업코드 매핑 { 종목코드(6자리): 고유번호(8자리) }.
    corpCode.zip 을 한 번만 받아 스트리밍 파싱 → 상장사만 작은 딕셔너리로 보관.
    (OpenDartReader처럼 전체를 pandas로 들고 있지 않아 메모리가 가볍다.)"""
    key = _key()
    if not key:
        return {}
    try:
        r = requests.get(f"{_BASE}/corpCode.xml", params={"crtfc_key": key}, timeout=30)
        z = zipfile.ZipFile(io.BytesIO(r.content))
        xml = z.read(z.namelist()[0])
        out = {}
        # iterparse + clear 로 메모리 피크를 낮춤
        for _, el in ET.iterparse(io.BytesIO(xml)):
            if el.tag == "list":
                sc = (el.findtext("stock_code") or "").strip()
                if sc:  # 상장사만 (종목코드 있는 것)
                    out[sc] = (el.findtext("corp_code") or "").strip()
                el.clear()
        return out
    except Exception:
        return {}


def _corp_code(code: str):
    return _corp_map().get(str(code).zfill(6))


@ttl_cache(21600)  # 공시는 6시간 캐시 (자주 안 바뀜)
def disclosures(code: str, limit: int = 2) -> list:
    """최근 3개월 공시 중 최신 limit건."""
    key = _key()
    corp = _corp_code(code)
    if not key or not corp:
        return []
    try:
        start = (dt.date.today() - dt.timedelta(days=90)).strftime("%Y%m%d")
        r = requests.get(f"{_BASE}/list.json", params={
            "crtfc_key": key, "corp_code": corp, "bgn_de": start,
            "page_count": 10, "page_no": 1,
        }, timeout=15)
        data = r.json()
        if data.get("status") != "000":
            return []
        out = []
        for it in (data.get("list") or [])[:limit]:
            out.append({
                "date": str(it.get("rcept_dt", "")).strip(),
                "title": str(it.get("report_nm", "")).strip(),
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


def _fetch_accounts(corp: str, year: int) -> list:
    """사업보고서(11011) 전체 계정. 연결(CFS) 우선, 없으면 별도(OFS)."""
    key = _key()
    for fs_div in ("CFS", "OFS"):
        try:
            r = requests.get(f"{_BASE}/fnlttSinglAcntAll.json", params={
                "crtfc_key": key, "corp_code": corp, "bsns_year": str(year),
                "reprt_code": "11011", "fs_div": fs_div,
            }, timeout=15)
            data = r.json()
            if data.get("status") == "000" and data.get("list"):
                return data["list"]
        except Exception:
            continue
    return []


@ttl_cache(43200)  # 재무제표는 분기에 한 번 갱신 → 12시간 캐시
def financials(code: str) -> dict:
    """최근 사업보고서에서 매출액·영업이익·당기순이익을 3개년(전전기·전기·당기)으로.
    fnlttSinglAcntAll 한 건에 당기/전기/전전기 금액이 모두 들어있어 한 번에 추세를 만든다."""
    corp = _corp_code(code)
    if not _key() or not corp:
        return {}
    last_year = dt.date.today().year - 1
    for year in (last_year, last_year - 1):  # 올해치 미공시면 전년도 보고서로
        items = _fetch_accounts(corp, year)
        if not items:
            continue

        def row(account_name):
            # account_nm 정확히 일치 우선(없으면 포함). 손익/포괄손익에 중복 있어도 값은 동일.
            hit = [it for it in items if str(it.get("account_nm", "")).strip() == account_name]
            if not hit:
                hit = [it for it in items if account_name in str(it.get("account_nm", ""))]
            if not hit:
                return [None, None, None]
            it = hit[0]
            # [전전기, 전기, 당기] 순서(오래된 → 최신)
            return [
                _to_int(it.get("bfefrmtrm_amount")),
                _to_int(it.get("frmtrm_amount")),
                _to_int(it.get("thstrm_amount")),
            ]

        rev = row("매출액")
        op = row("영업이익")
        net = row("당기순이익")
        years = [year - 2, year - 1, year]

        # 셋 다 비면 이 보고서는 의미 없음 → 다음 후보 연도로
        if all(v is None for v in rev + op + net):
            continue

        return {
            "year": year,                          # 최신 연도(기존 호환)
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
