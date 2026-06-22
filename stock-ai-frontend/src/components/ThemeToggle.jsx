import React from "react";

// 다크/라이트 토글 버튼. 현재 다크면 ☀️(라이트로), 라이트면 🌙(다크로).
export default function ThemeToggle({ theme, onToggle }) {
  const dark = theme === "dark";
  return (
    <button className="sa-theme-btn" onClick={onToggle}
      title={dark ? "라이트 모드로" : "다크 모드로"}
      aria-label={dark ? "라이트 모드로 전환" : "다크 모드로 전환"}>
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
