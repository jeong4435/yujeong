// 투자 유형 결과 저장/복원.
// 결과는 '점수(0~100)' 하나면 충분 — getType(score)로 유형이 항상 결정됨.
// 저장 위치: localStorage(즉시·새로고침 유지) + 로그인 시 Supabase 계정(user_metadata, 다기기 동기화).
import { supabase } from "./supabase.js";

const LS_KEY = "jusikdo_invest_score";

function toScore(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// localStorage에 저장된 점수만 읽기
export function readLocalScore() {
  try { return toScore(localStorage.getItem(LS_KEY)); } catch { return null; }
}

// 저장된 점수 읽기: 로그인 사용자는 계정(metadata) 우선, 없으면 localStorage.
export function readSavedScore(user) {
  const fromMeta = toScore(user?.user_metadata?.invest_score);
  if (fromMeta != null) return fromMeta;
  return readLocalScore();
}

// 점수 저장: localStorage(즉시) + 로그인 시 계정(다기기 동기화).
export async function saveScore(score, user) {
  try { localStorage.setItem(LS_KEY, String(score)); } catch { /* 무시 */ }
  if (user && supabase) {
    try { await supabase.auth.updateUser({ data: { invest_score: score } }); } catch { /* 무시 */ }
  }
}

// 저장 결과 삭제(다시 진단하기).
export async function clearScore(user) {
  try { localStorage.removeItem(LS_KEY); } catch { /* 무시 */ }
  if (user && supabase) {
    try { await supabase.auth.updateUser({ data: { invest_score: null } }); } catch { /* 무시 */ }
  }
}
