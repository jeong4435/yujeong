// 잔고(holdings) + 매매기록(transactions) 데이터 계층.
// 원칙: 잔고는 직접 등록/수정/삭제 가능 + 매수/매도 등록 시 잔고 자동 갱신.
import { supabase } from "./supabase.js";
import { getStock } from "./api.js";

async function uid() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

// 내 보유 잔고 목록 (RLS로 본인 것만)
export async function loadHoldings() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("holdings").select("*").order("updated_at", { ascending: false });
  if (error) { console.warn("loadHoldings", error.message); return []; }
  return data || [];
}

// 내 매매기록 (최신순)
export async function loadTransactions(limit = 100) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("transactions").select("*").order("traded_at", { ascending: false }).limit(limit);
  if (error) { console.warn("loadTransactions", error.message); return []; }
  return data || [];
}

// 잔고 직접 등록/수정 (종목·수량·평단을 그대로 set). 매매기록과 무관.
export async function upsertHolding({ code, name, qty, avg }) {
  if (!supabase) return { error: "no supabase" };
  const user_id = await uid();
  if (!user_id) return { error: "로그인이 필요해요" };
  const { error } = await supabase.from("holdings").upsert(
    { user_id, stock_code: code, stock_name: name, quantity: qty, avg_price: avg, updated_at: new Date().toISOString() },
    { onConflict: "user_id,stock_code" }
  );
  return error ? { error: error.message } : { ok: true };
}

export async function deleteHolding(id) {
  if (!supabase) return { error: "no supabase" };
  const { error } = await supabase.from("holdings").delete().eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

export async function deleteTransaction(id) {
  if (!supabase) return { error: "no supabase" };
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  return error ? { error: error.message } : { ok: true };
}

// 매수/매도 등록 → transactions 기록 + holdings 자동 갱신(항상 반영).
// 매수: 평단 가중평균. 매도: 수량 차감(0 이하면 잔고 삭제), 평단 유지.
export async function registerTrade({ code, name, side, qty, price }) {
  if (!supabase) return { error: "no supabase" };
  const user_id = await uid();
  if (!user_id) return { error: "로그인이 필요해요" };

  // 현재 보유 읽기
  const { data: rows } = await supabase
    .from("holdings").select("*").eq("stock_code", code).limit(1);
  const cur = rows && rows[0];

  if (side === "sell") {
    const held = cur ? Number(cur.quantity) : 0;
    if (held < qty) return { error: `보유 수량(${held}주)보다 많이 팔 수 없어요` };
  }

  // 1) 거래 기록
  const { error: txErr } = await supabase.from("transactions").insert({
    user_id, stock_code: code, stock_name: name, side, quantity: qty, price,
  });
  if (txErr) return { error: txErr.message };

  // 2) 잔고 갱신 (실패 시 에러 반환 — 조용히 넘어가지 않게)
  let hErr = null;
  if (side === "buy") {
    if (cur) {
      const newQty = Number(cur.quantity) + qty;
      const newAvg = (Number(cur.quantity) * Number(cur.avg_price) + qty * price) / newQty;
      ({ error: hErr } = await supabase.from("holdings").update(
        { quantity: newQty, avg_price: newAvg, stock_name: name, updated_at: new Date().toISOString() }
      ).eq("id", cur.id));
    } else {
      ({ error: hErr } = await supabase.from("holdings").insert(
        { user_id, stock_code: code, stock_name: name, quantity: qty, avg_price: price }
      ));
    }
  } else { // sell
    const newQty = Number(cur.quantity) - qty;
    if (newQty <= 0) {
      ({ error: hErr } = await supabase.from("holdings").delete().eq("id", cur.id));
    } else {
      ({ error: hErr } = await supabase.from("holdings").update(
        { quantity: newQty, updated_at: new Date().toISOString() }
      ).eq("id", cur.id));
    }
  }
  if (hErr) return { error: "거래는 기록됐지만 잔고 갱신에 실패했어요: " + hErr.message };
  return { ok: true };
}

// 종목 입력(이름/코드) → 현재가·코드·이름 확정. 잔고/거래 등록 전 resolve용.
export async function resolveStock(query) {
  try {
    const d = await getStock(query);
    if (d.error) return { error: d.error };
    return { code: d.code, name: d.name, price: d.price, change_pct: d.change_pct };
  } catch {
    return { error: "종목을 찾지 못했어요" };
  }
}

// 보유 종목들의 현재가 일괄 조회 → { code: {price, change_pct} }
export async function fetchPrices(codes) {
  const out = {};
  await Promise.all((codes || []).map(async (code) => {
    try {
      const d = await getStock(code);
      if (!d.error) out[code] = { price: d.price, change_pct: d.change_pct };
    } catch { /* skip */ }
  }));
  return out;
}
