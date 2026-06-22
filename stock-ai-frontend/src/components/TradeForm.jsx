import React, { useState } from "react";
import { registerTrade, upsertHolding, resolveStock } from "../holdings.js";

// 매수/매도/잔고직접수정 공용 등록 폼.
// modes: 보여줄 모드 배열. 내 잔고=["buy","sell","set"], 매매기록=["buy","sell"].
const LABELS = { buy: "매수", sell: "매도", set: "잔고 직접수정" };

export default function TradeForm({ onDone, modes = ["buy", "sell", "set"] }) {
  const [mode, setMode] = useState(modes[0] || "buy");
  const [q, setQ] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const needPrice = mode !== "sell";   // 매도는 단가 선택(잔고 영향 없음)

  async function submit() {
    setErr("");
    const term = q.trim();
    const nQty = Number(qty);
    const nPrice = Number(price);
    if (!term) return setErr("종목을 입력해주세요");
    if (!nQty || nQty <= 0) return setErr("수량을 올바르게 입력해주세요");
    if (needPrice && (!nPrice || nPrice < 0)) return setErr((mode === "set" ? "평단" : "단가") + "를 입력해주세요");

    setBusy(true);
    const s = await resolveStock(term);
    if (s.error) { setBusy(false); return setErr(s.error); }

    let r;
    if (mode === "set") {
      r = await upsertHolding({ code: s.code, name: s.name, qty: nQty, avg: nPrice });
    } else {
      r = await registerTrade({ code: s.code, name: s.name, side: mode, qty: nQty, price: mode === "sell" ? (nPrice || 0) : nPrice });
    }
    setBusy(false);
    if (r.error) return setErr(r.error);
    onDone();
  }

  return (
    <div className="sa-tradeform">
      <div className="sa-mode">
        {modes.map((m) => (
          <button key={m} className={"sa-mode-b" + (mode === m ? " on" : "")} onClick={() => setMode(m)}>{LABELS[m]}</button>
        ))}
      </div>
      <input className="sa-input" placeholder="종목 (예: 삼성전자 또는 005930)" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="sa-traderow">
        <input className="sa-input" type="number" inputMode="numeric" placeholder="수량(주)" value={qty} onChange={(e) => setQty(e.target.value)} />
        {needPrice && (
          <input className="sa-input" type="number" inputMode="numeric" placeholder={mode === "set" ? "평단(원)" : "단가(원)"} value={price} onChange={(e) => setPrice(e.target.value)} />
        )}
      </div>
      {mode === "set" && <div className="sa-trade-hint">현재 보유를 이 값으로 덮어써요(전체 리셋용).</div>}
      {mode === "sell" && <div className="sa-trade-hint">단가는 기록용(선택). 평단은 매도해도 그대로예요.</div>}
      {err && <div className="sa-err" style={{ marginTop: 8 }}>⚠️ {err}</div>}
      <button className="sa-btn" style={{ width: "100%", padding: "13px", marginTop: 10, opacity: busy ? 0.6 : 1 }}
        disabled={busy} onClick={submit}>
        {busy ? "처리 중…" : mode === "buy" ? "매수 등록" : mode === "sell" ? "매도 등록" : "잔고 저장"}
      </button>
    </div>
  );
}
