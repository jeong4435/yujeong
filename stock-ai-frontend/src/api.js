// 백엔드(FastAPI) 호출 헬퍼. vite.config.js 의 proxy 덕분에 /api 로만 부르면 됩니다.

export async function getStock(query) {
  const r = await fetch("/api/stock/" + encodeURIComponent(query));
  if (!r.ok) throw new Error("서버 응답 실패 (" + r.status + ")");
  return r.json();
}

// 진짜 숫자를 '고등학생 눈높이'로 풀어주는 설명. 백엔드에 키 없으면 null.
export async function getExplain(query) {
  try {
    const r = await fetch("/api/explain/" + encodeURIComponent(query));
    if (!r.ok) return null;
    const d = await r.json();
    return d.explanation || null;
  } catch {
    return null;
  }
}

export async function getTrending() {
  const r = await fetch("/api/trending");
  if (!r.ok) throw new Error("서버 응답 실패 (" + r.status + ")");
  return r.json();
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
