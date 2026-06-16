"""아주 단순한 메모리 TTL 캐시.
- 같은 종목을 다시 조회하면 외부 호출 없이 즉시 응답.
- 데이터 성격마다 유효기간(TTL)을 다르게 줌: 재무·공시는 길게, 시세는 짧게.
- 실패해서 빈 값(빈 dict/list)이 나오면 캐싱하지 않아 다음에 다시 시도함.
주의: 프로세스 메모리에만 저장 → 서버 재시작 시 비워짐(의도된 단순 구현).
"""
import time

_store = {}  # key -> (저장시각, 값)


def ttl_cache(seconds: int):
    """함수 결과를 인자 기준으로 seconds초 동안 재사용. 빈 값은 저장하지 않음."""
    def deco(fn):
        def wrap(*args):
            key = (fn.__name__, args)
            now = time.time()
            hit = _store.get(key)
            if hit is not None and now - hit[0] < seconds:
                return hit[1]
            val = fn(*args)
            if val:  # 빈 dict/list/None 은 캐싱하지 않음(다음에 재시도)
                _store[key] = (now, val)
            return val
        wrap.__name__ = getattr(fn, "__name__", "wrapped")
        return wrap
    return deco
