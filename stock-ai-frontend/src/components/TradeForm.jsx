import React, { useState, useEffect, useRef } from "react";
import { searchStocks, won } from "../api.js";
import { registerTrade, upsertHolding, resolveStock } from "../holdings.js";

// 매수/매도/잔고직접수정 공용 등록 폼.
// 개선: 종목 자동완성 드롭다운 · 선택 시 단가 종가 자동완성 · 매도도 단가 입력 · 수량 빠른입력.
const LABELS = { buy: "매수", sell: "매도", set: "잔고 직접수정" };
const QTY_CHIPS = [1, 5, 10, 100];

export default function TradeForm({ onDone, modes = ["buy", "sell", "set"] }) {
  const [mode, setMode] = useState(modes[0] || "buy");
  const [q, setQ] = useState("");
  const [sug, setSug] = useState([]);          // 자동완성 목록
  const [selected, setSelected] = useState(null); // {code, name}
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [priceAuto, setPriceAuto] = useState(false); // 단가를 종가로 자동완성했는지
  const [priceLoading, setPriceLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const deb = useRef();

  // 종목명 자동완성(디바운스 250ms)
  useEffect(() => {
    const term = q.trim();
    clearTimeout(deb.current);
    if (selected && term === selected.name) { setSug([]); return; } // 방금 고른 것
    if (!term) { setSug([]); return; }
    deb.current = setTimeout(async () => setSug(await searchStocks(term)), 250);
    return () => clearTimeout(deb.current);
  }, [q, selected]);

  async function pick(s) {
    setSelected({ code: s.code, name: s.name });
    setQ(s.name);
    setSug([]);
    setErr("");
    // 단가 자동완성: 종가 (수정 가능)
    setPriceLoading(true);
    const r = await resolveStock(s.code);
    setPriceLoading(false);
    if (!r.error && r.price != null) { setPrice(String(Math.round(r.price))); setPriceAuto(true); }
  }

  function onType(v) { setQ(v); setSelected(null); }
  function addQty(n) { setQty((c) => String((Number(c) || 0) + n)); }

  async function submit() {
    setErr("");
    const nQty = Number(qty), nPrice = Number(price);
    if (!q.trim()) return setErr("종목을 검색해 선택해주세요");
    if (!nQty || nQty <= 0) return setErr("수량을 올바르게 입력해주세요");
    if (!nPrice || nPrice < 0) return setErr((mode === "set" ? "평단" : "단가") + "를 입력해주세요");

    setBusy(true);
    let stock = selected;
    if (!stock) {                       // 드롭다운에서 안 골랐으면 입력값으로 확정
      const s = await resolveStock(q.trim());
      if (s.error) { setBusy(false); return setErr(s.error); }
      stock = { code: s.code, name: s.name };
    }
    let r;
    if (mode === "set") r = await upsertHolding({ code: stock.code, name: stock.name, qty: nQty, avg: nPrice });
    else r = await registerTrade({ code: stock.code, name: stock.name, side: mode, qty: nQty, price: nPrice });
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

      {/* 종목 검색 + 자동완성 드롭다운 */}
      <div className="sa-sug-wrap">
        <input className="sa-input" placeholder="종목 검색 (예: 삼성 / 005930)" value={q} onChange={(e) => onType(e.target.value)} />
        {selected && <span className="sa-sug-ok">✓ {selected.code}</span>}
        {sug.length > 0 && (
          <div className="sa-sug">
            {sug.map((s) => (
              <button key={s.code} className="sa-sug-item" onClick={() => pick(s)}>
                <span className="nm">{s.name}</span><span className="cd">{s.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 수량 + 단가 */}
      <div className="sa-traderow">
        <input className="sa-input" type="number" inputMode="numeric" placeholder="수량(주)" value={qty} onChange={(e) => setQty(e.target.value)} />
        <input className="sa-input" type="number" inputMode="numeric" placeholder={mode === "set" ? "평단(원)" : "단가(원)"}
          value={price} onChange={(e) => { setPrice(e.target.value); setPriceAuto(false); }} />
      </div>
      <div className="sa-qty-chips">
        {QTY_CHIPS.map((n) => <button key={n} className="sa-qty-chip" onClick={() => addQty(n)}>+{n}</button>)}
        {qty && <button className="sa-qty-chip ghost" onClick={() => setQty("")}>지우기</button>}
      </div>

      {priceLoading && <div className="sa-trade-hint">종가 불러오는 중…</div>}
      {priceAuto && !priceLoading && <div className="sa-trade-hint">단가를 <b>종가({won(Number(price))})</b>로 채웠어요 — 실제 체결가로 수정 가능해요.</div>}
      {mode === "set" && <div className="sa-trade-hint">현재 보유를 이 값으로 덮어써요(전체 리셋용).</div>}
      {mode === "sell" && <div className="sa-trade-hint">매도 단가는 수익·수익률 계산에 쓰여요.</div>}
      {err && <div className="sa-err" style={{ marginTop: 8 }}>⚠️ {err}</div>}

      <button className="sa-btn" style={{ width: "100%", padding: "13px", marginTop: 10, opacity: busy ? 0.6 : 1 }}
        disabled={busy} onClick={submit}>
        {busy ? "처리 중…" : mode === "buy" ? "매수 등록" : mode === "sell" ? "매도 등록" : "잔고 저장"}
      </button>
    </div>
  );
}
