import React, { useState, useEffect, useCallback } from "react";
import { won, num } from "../api.js";
import { loadTransactions, deleteTransaction } from "../holdings.js";

// 매매 기록(거래 일지) 목록. 삭제 가능(※잔고는 자동 보정 안 됨 — 기록만 지움).
function fmt(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d)) return String(ts).slice(0, 10);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

export default function TxHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setRows(await loadTransactions());
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="sa-card">
      <h3><span className="sa-chip">매매 기록</span> 내 매수·매도 일지</h3>

      {loading ? (
        <div className="sa-load"><div className="sa-spin" /><div className="sa-loadmsg">기록 불러오는 중…</div></div>
      ) : rows.length === 0 ? (
        <div className="sa-holdings-empty">
          <div className="ico">🧾</div>
          <div className="t">아직 매매 기록이 없어요.<br />내 잔고에서 매수·매도를 등록하면 여기에 쌓여요.</div>
        </div>
      ) : (
        <div className="sa-txlist">
          {rows.map((t) => (
            <div className="sa-tx" key={t.id}>
              <div className={"sa-tx-side " + t.side}>{t.side === "buy" ? "매수" : "매도"}</div>
              <div className="sa-tx-main">
                <div className="nm">{t.stock_name}</div>
                <div className="sub">{fmt(t.traded_at)} · {num(t.quantity)}주 {t.price ? "· " + won(Math.round(t.price)) : ""}</div>
              </div>
              <button className="sa-holding-x" title="기록 삭제"
                onClick={async () => { if (confirm("이 기록을 삭제할까요? (잔고는 자동 보정되지 않아요)")) { await deleteTransaction(t.id); reload(); } }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div className="sa-disc" style={{ marginTop: 14 }}>
        기록을 지워도 잔고는 자동으로 바뀌지 않아요. 잔고는 <b>내 잔고</b> 탭에서 직접 수정하세요.
      </div>
    </div>
  );
}
