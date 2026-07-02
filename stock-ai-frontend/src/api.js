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

// 동종업계 PER·PBR 비교표(본인+같은 업종 + 중앙값). 종목분석에서 별도 비동기 로드. 실패 시 빈 객체.
export async function getPeers(query) {
  try {
    const r = await fetch(api("/api/peers/" + encodeURIComponent(query)));
    if (!r.ok) return {};
    return r.json();
  } catch {
    return {};
  }
}

// 종목 전체 목록(코드·이름) — 한 번 받아 클라에서 즉시 필터(자동완성). 실패 시 빈 배열.
export async function getStockList() {
  try {
    const r = await fetch(api("/api/stocklist"));
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.stocks) ? d.stocks : [];
  } catch {
    return [];
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

// 내 잔고 + 투자유형 → Gemini 포트폴리오 AI 코칭. 키 없으면 null.
export async function getPortfolioCoach(holdings, investType) {
  try {
    const r = await fetch(api("/api/portfolio-coach"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdings, invest_type: investType || "" }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.coaching || null;
  } catch {
    return null;
  }
}

// 숫자 포맷
export const won = (n) => (n == null ? "확인 어려움" : Number(n).toLocaleString("ko-KR") + "원");
export const num = (n) => (n == null ? "확인 어려움" : Number(n).toLocaleString("ko-KR"));
export function eok(n) {
  if (n == null) return "확인 어려움";
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toLocaleString("ko-KR", { maximumFractionDigits: 1 }) + "조원";  // 1조↑는 조 단위(짧고 읽기 쉽게)
  if (abs >= 1e8) return Math.round(n / 1e8).toLocaleString("ko-KR") + "억원";
  return Math.round(n / 1e4).toLocaleString("ko-KR") + "만원";
}
