// 종목 목록을 앱에서 '한 번만' 받아 메모리에 캐시 → 타이핑 시 즉시(로컬) 필터.
// 매 키 입력마다 서버 왕복하던 자동완성을 대체(무료 서버 지연 제거).
import { getStockList } from "./api.js";

let _cache = null;   // [{code, name}]
let _loading = null; // 진행 중 Promise(중복 요청 방지)

// 목록을 한 번 로드(이미 있으면 즉시 반환). 폼 열릴 때 미리 호출 권장.
export function loadStockList() {
  if (_cache) return Promise.resolve(_cache);
  if (_loading) return _loading;
  _loading = getStockList().then((list) => { _cache = list || []; return _cache; });
  return _loading;
}

export function isStockListReady() { return !!_cache; }

// 로컬 즉시 검색: 코드(접두) 또는 이름(접두 우선 → 부분일치). 최대 n개.
export function searchLocal(query, n = 8) {
  const list = _cache;
  if (!list) return [];
  const q = (query || "").trim();
  if (!q) return [];
  if (/^\d+$/.test(q)) return list.filter((s) => s.code.startsWith(q)).slice(0, n);
  const starts = list.filter((s) => s.name.startsWith(q));
  if (starts.length >= n) return starts.slice(0, n);
  const contains = list.filter((s) => s.name.includes(q) && !s.name.startsWith(q));
  return [...starts, ...contains].slice(0, n);
}
