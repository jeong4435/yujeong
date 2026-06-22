import React, { useState, useEffect, useCallback } from "react";
import { won, num } from "../api.js";
import { loadHoldings, fetchPrices, deleteHolding } from "../holdings.js";
import TradeForm from "./TradeForm.jsx";

// 내 잔고 화면: 보유 목록(평가손익) + 매수/매도/직접등록 + 삭제.
export default function Holdings({ onPick }) {
  const [rows, setRows] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);   // 등록 폼 토글

  const reload = useCallback(async () => {
    setLoading(true);
    const hs = await loadHoldings();
    setRows(hs);
    setLoading(false);
    const pr = await fetchPrices(hs.map((h) => h.stock_code));
    setPrices(pr);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  function pnl(h) {
    const cur = prices[h.stock_code]?.price;
    const avg = Number(h.avg_price);
    if (cur == null || !avg) return null;
    const pct = ((cur - avg) / avg) * 100;
    const gain = (cur - avg) * Number(h.quantity);
    return { cur, pct, gain };
  }

  return (
    <div>
      <div className="sa-card">
        <h3 style={{ justifyContent: "space-between" }}>
          <span><span className="sa-chip">내 잔고</span> 내 보유 주식</span>
          <button className="sa-btn sa-btn-sm" onClick={() => setOpen((v) => !v)}>
            {open ? "닫기" : "+ 등록"}
          </button>
        </h3>

        {open && <TradeForm onDone={() => { setOpen(false); reload(); }} />}

        {loading ? (
          <div className="sa-load"><div className="sa-spin" /><div className="sa-loadmsg">잔고 불러오는 중…</div></div>
        ) : rows.length === 0 ? (
          <div className="sa-holdings-empty">
            <div className="ico">📥</div>
            <div className="t">아직 등록된 보유 주식이 없어요.<br />위 <b>+ 등록</b>으로 매수·매도나 잔고를 입력해보세요.</div>
          </div>
        ) : (
          <div className="sa-holdings">
            {rows.map((h) => {
              const p = pnl(h);
              const dir = !p ? "flat" : p.pct > 0 ? "up" : p.pct < 0 ? "down" : "flat";
              return (
                <div className="sa-holding" key={h.id}>
                  <button className="sa-holding-main" onClick={() => onPick && onPick(h.stock_name)}>
                    <div className="hl">
                      <div className="nm">{h.stock_name}</div>
                      <div className="sub">{num(h.quantity)}주 · 평단 {won(Math.round(h.avg_price))}</div>
                    </div>
                    <div className={"hr " + dir}>
                      {p ? (p.pct > 0 ? "▲ +" : p.pct < 0 ? "▼ " : "") + Math.abs(p.pct).toFixed(2) + "%" : "—"}
                      <div className="hsub">{p ? won(Math.round(p.cur)) : "현재가 확인중"}</div>
                    </div>
                  </button>
                  <button className="sa-holding-x" title="삭제"
                    onClick={async () => { if (confirm(`${h.stock_name}을(를) 잔고에서 삭제할까요?`)) { await deleteHolding(h.id); reload(); } }}>
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="sa-disc" style={{ marginTop: 14 }}>
          평가손익은 <b>종가 기준</b>이라 장중 실시간과 달라요. 잔고는 본인만 볼 수 있어요.
        </div>
      </div>
    </div>
  );
}

