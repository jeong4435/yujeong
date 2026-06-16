"""종목 관련 최신 뉴스(네이버 금융 종목 뉴스).
- recent_news(): 최근 N개월 기사 제목·날짜·언론사·링크
키/네트워크 실패 시 빈 리스트를 돌려주어 앱이 죽지 않게 합니다.
"""
import datetime as dt
import html

import requests

from .cache import ttl_cache

_H = {"User-Agent": "Mozilla/5.0"}


def _parse_dt(s: str):
    """'202606161343' → date. 실패하면 None."""
    try:
        return dt.datetime.strptime(str(s)[:8], "%Y%m%d").date()
    except Exception:
        return None


@ttl_cache(3600)  # 뉴스는 1시간 캐시
def recent_news(code: str, months: int = 3, limit: int = 5) -> list:
    """해당 종목의 최근 months개월 이내 기사 최신 limit건."""
    try:
        url = f"https://m.stock.naver.com/api/news/stock/{code}"
        r = requests.get(url, headers=_H, params={"pageSize": 20, "page": 1}, timeout=10)
        clusters = r.json()
        if not isinstance(clusters, list):
            return []

        cutoff = dt.date.today() - dt.timedelta(days=months * 31)
        seen, out = set(), []
        for cl in clusters:
            for it in (cl.get("items") or []):
                d = _parse_dt(it.get("datetime", ""))
                if d is None or d < cutoff:
                    continue
                office_id = it.get("officeId", "")
                article_id = it.get("articleId", "")
                key = (office_id, article_id)
                if key in seen:
                    continue
                seen.add(key)
                link = it.get("mobileNewsUrl") or (
                    f"https://n.news.naver.com/mnews/article/{office_id}/{article_id}"
                )
                out.append({
                    "date": d.isoformat(),
                    "title": html.unescape(str(it.get("title", "")).strip()),
                    "source": str(it.get("officeName", "")).strip(),
                    "url": link,
                })
        out.sort(key=lambda x: x["date"], reverse=True)
        return out[:limit]
    except Exception:
        return []
