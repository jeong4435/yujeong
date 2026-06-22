// 다크/라이트 테마 저장·복원. 앱 전역 설정이라 localStorage에 보관(로그인 불필요).
const LS_KEY = "jusikdo_theme";

// 최초 테마: 저장값 우선 → 없으면 시스템(OS/브라우저) 설정 → 기본 라이트
export function getInitialTheme() {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === "dark" || v === "light") return v;
  } catch { /* 무시 */ }
  try {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  } catch { /* 무시 */ }
  return "light";
}

export function saveTheme(theme) {
  try { localStorage.setItem(LS_KEY, theme); } catch { /* 무시 */ }
}
