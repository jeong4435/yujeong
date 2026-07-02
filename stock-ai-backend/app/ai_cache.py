"""Supabase 기반 AI 분석 결과 캐시.

캐시 기간:
  시황(market_analysis_cache): 장전(pre) / 장후(post) 하루 2회
  종목(stock_analysis_cache): 하루 1회

SUPABASE_URL / SUPABASE_ANON_KEY 환경변수 없으면 전부 no-op(캐시 건너뜀).
"""
import os
from datetime import datetime, timezone, timedelta

try:
    from supabase import create_client
except Exception:
    create_client = None

KST = timezone(timedelta(hours=9))
_client = None


def _sb():
    global _client
    if _client is not None:
        return _client
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key or create_client is None:
        return None
    try:
        _client = create_client(url, key)
    except Exception:
        pass
    return _client


def _today() -> str:
    return datetime.now(KST).date().isoformat()


def _session() -> str:
    """KST 기준 시황 세션.
    15:30 이후 → 'post' / 그 이전(장전·장중) → 'pre'.
    장중엔 장전 캐시를 재사용해서 Gemini 재호출 없음.
    """
    now = datetime.now(KST)
    if now.hour * 60 + now.minute >= 15 * 60 + 30:
        return "post"
    return "pre"


# ── 시황 캐시 ──────────────────────────────────────────────────────────────

def get_market_cache() -> str | None:
    sb = _sb()
    if not sb:
        return None
    try:
        res = (
            sb.table("market_analysis_cache")
            .select("content")
            .eq("cache_date", _today())
            .eq("session", _session())
            .maybe_single()
            .execute()
        )
        return (res.data or {}).get("content")
    except Exception:
        return None


def set_market_cache(content: str):
    sb = _sb()
    if not sb or not content:
        return
    try:
        sb.table("market_analysis_cache").upsert(
            {"cache_date": _today(), "session": _session(), "content": content},
            on_conflict="cache_date,session",
        ).execute()
    except Exception:
        pass


# ── 종목 캐시 ──────────────────────────────────────────────────────────────

def get_stock_cache(code: str) -> str | None:
    sb = _sb()
    if not sb:
        return None
    try:
        res = (
            sb.table("stock_analysis_cache")
            .select("content")
            .eq("stock_code", code)
            .eq("cache_date", _today())
            .maybe_single()
            .execute()
        )
        return (res.data or {}).get("content")
    except Exception:
        return None


def set_stock_cache(code: str, content: str):
    sb = _sb()
    if not sb or not content:
        return
    try:
        sb.table("stock_analysis_cache").upsert(
            {"stock_code": code, "cache_date": _today(), "content": content},
            on_conflict="stock_code,cache_date",
        ).execute()
    except Exception:
        pass
