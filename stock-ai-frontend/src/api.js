// 백엔드(FastAPI) 호출 헬퍼.
// - 개발: VITE_API_BASE 가 비어 있어 "/api" 상대경로 → vite.config.js proxy 가 8000으로 넘김
// - 배포: 빌드 시 VITE_API_BASE 에 백엔드 주소(예: https://xxx.onrender.com)를 넣으면 그쪽으로 호출
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const api = (path) => API_BASE + path;

export async function getStock(query) {
  const r = await fetch(api("/api/stock/" + encodeURIComponent(query)));
  if (!r.ok) throw new Error("서버 응답 실패 (" + r.status + ")");
  return r.json();
}

// 2차(느린) 데이터: 3개년 재무·공시·뉴스. 가격 카드를 먼저 띄운 뒤 비동기로 채움.
export async function getDetails(query) {
  try {
    const r = await fetch(api("/api/details/" + encodeURIComponent(query)));
    if (!r.ok) return {};
    return r.json();
  } catch {
    return {};
  }
}

// 진짜 숫자를 '고등학생 눈높이'로 풀어주는 설명. 백엔드에 키 없으면 null.
export async function getExplain(query) {
  try {
    const r = await fetch(api("/api/explain/" + encodeURIComponent(query)));
    if (!r.ok) return null;
    const d = await r.json();
    return d.explanation || null;
  } catch {
    return null;
  }
}

export async function getTrending() {
  const r = await fetch(api("/api/trending"));
  if (!r.ok) throw new Error("서버 응답 실패 (" + r.status + ")");
  return r.json();
}

// 오늘의 시장 — 코스피·코스닥·나스닥·다우 지수값+그래프 시계열. 실패 시 빈 객체.
export async function getIndices() {
  try {
    const r = await fetch(api("/api/indices"));
    if (!r.ok) return {};
    return r.json();
  } catch {
    return {};
  }
}

// 오늘의 시장 — 시황·섹터 AI 분석. 백엔드에 키 없으면 null.
export async function getMarketAnalysis() {
  try {
    const r = await fetch(api("/api/market-analysis"));
    if (!r.ok) return null;
    const d = await r.json();
    return d.analysis || null;
  } catch {
    return null;
  }
}

// 종목 분석 예시 칩 = 전일 거래대금 TOP (하루 한 번 갱신). 실패 시 빈 배열 → 프론트 기본 목록 폴백.
export async function getExamples() {
  try {
    const r = await fetch(api("/api/examples"));
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.examples) ? d.examples : [];
  } catch {
    return [];
  }
}

// 숫자 포맷
export const won = (n) => (n == null ? "확인 어려움" : Number(n).toLocaleString("ko-KR") + "원");
export const num = (n) => (n == null ? "확인 어려움" : Number(n).toLocaleString("ko-KR"));
export function eok(n) {
  if (n == null) return "확인 어려움";
  const e = n / 1e8;
  if (Math.abs(e) >= 1) return e.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "억원";
  return (n / 1e4).toLocaleString("ko-KR", { maximumFractionDigits: 0 }) + "만원";
}
