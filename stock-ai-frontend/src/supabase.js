// Supabase 클라이언트 (로그인 + 내 데이터 저장용).
// 환경변수(VITE_SUPABASE_URL·VITE_SUPABASE_ANON_KEY)가 있을 때만 생성.
// 없으면 supabase=null → 로그인/잔고 기능만 비활성, 나머지 앱은 그대로 동작.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
export const hasSupabase = !!supabase;
