// 로그인(구글) + 세션 관리. Supabase Auth 위에 얇게 감싼 것.
// supabase 클라이언트가 없으면(env 미설정) 전부 no-op → 앱 나머지는 그대로 동작.
import { useEffect, useState } from "react";
import { supabase, hasSupabase } from "./supabase";

// 현재 로그인 세션을 구독하는 훅. { session, user, loading } 반환.
export function useSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(hasSupabase);

  useEffect(() => {
    if (!supabase) return; // env 없으면 비로그인 상태로 고정

    // 1) 새로고침 시 저장된 세션 복원
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // 2) 로그인/로그아웃 등 상태 변화 구독
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null, loading };
}

// 구글 OAuth 로그인 시작. 끝나면 현재 주소(origin)로 돌아옴
// (로컬=localhost:5173, 배포=jusikdo-ai.vercel.app — Supabase Redirect URLs에 등록됨).
export async function signInWithGoogle() {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

// 구글 user_metadata에서 표시용 이름/아바타 뽑기.
export function displayName(user) {
  if (!user) return "";
  const m = user.user_metadata || {};
  return m.full_name || m.name || user.email || "사용자";
}
export function avatarUrl(user) {
  const m = user?.user_metadata || {};
  return m.avatar_url || m.picture || null;
}
