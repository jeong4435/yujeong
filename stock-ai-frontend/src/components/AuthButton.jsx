import React, { useState } from "react";
import { hasSupabase } from "../supabase.js";
import { useSession, signInWithGoogle, signOut, displayName, avatarUrl } from "../auth.js";

// 구글 G 로고 (4색)
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
      <path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
      <path fill="#EA4335" d="M24 9.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 3.18 29.93 1 24 1 15.4 1 7.96 5.93 4.34 13.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
    </svg>
  );
}

// 우상단 헤더에 들어가는 로그인/프로필 컨트롤.
// 비로그인 → "구글로 로그인" 버튼 / 로그인 → 아바타+이름 + 로그아웃.
export default function AuthButton() {
  const { user, loading } = useSession();
  const [busy, setBusy] = useState(false);

  // env 미설정(배포 환경변수 등록 전)이면 아무것도 안 보임 → 앱은 그대로 동작
  if (!hasSupabase) return null;
  if (loading) return <div className="sa-auth-skel" aria-hidden="true" />;

  if (!user) {
    return (
      <button
        className="sa-login-btn"
        disabled={busy}
        onClick={async () => { setBusy(true); try { await signInWithGoogle(); } catch { setBusy(false); } }}
      >
        <GoogleIcon />
        <span>구글로 로그인</span>
      </button>
    );
  }

  const name = displayName(user);
  const avatar = avatarUrl(user);
  return (
    <div className="sa-profile">
      {avatar
        ? <img className="sa-avatar" src={avatar} alt="" referrerPolicy="no-referrer" />
        : <div className="sa-avatar sa-avatar-fallback">{name.slice(0, 1)}</div>}
      <span className="sa-profile-name" title={name}>{name}</span>
      <button className="sa-logout" onClick={() => signOut()}>로그아웃</button>
    </div>
  );
}
