import React, { useState, useEffect, useCallback } from "react";
import { won, num } from "../api.js";
import { loadTransactions, deleteTransaction, resetTransactions } from "../holdings.js";
import TradeForm from "./TradeForm.jsx";
import ConfirmModal from "./ConfirmModal.jsx";

// 매매 기록(거래 일지) + 실현 손익. 매도 시 저장한 평단(avg_at_sale)으로 손익 계산.
function fmt(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d)) return String(ts).slice(0, 10);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

// 매도 1건의 실현손익: (판가 - 그때 평단) × 수량
function sellPnl(t) {
  if (t.side !== "sell" || t.avg_at_sale == null) return null;
  const a = Number(t.avg_at_sale), p = Number(t.price), q = Number(t.quantity);
  if (!a) return null;
  return { realized: (p - a) * q, pct: ((p - a) / a) * 100 };
}

export default function TxHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false); // 리셋 확인 팝업
  const [resetting, setResetting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setRows(await loadTransactions());
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function doReset() {
    setResetting(true);
    const r = await resetTransactions();
    setResetting(false);
    setConfirmReset(false);
    if (r.error) { alert("리셋 실패: " + r.error); return; }
    reload();
  }

  // 실현 손익 합계(매도 기록 중 평단 저장된 것만)
  const sells = rows.filter((t) => t.side === "sell" && t.avg_at_sale != null);
  let totalRealized = 0, totalCost = 0;
  sells.forEach((t) => {
    const a = Number(t.avg_at_sale), p = Number(t.price), q = Number(t.quantity);
    totalRealized += (p - a) * q; totalCost += a * q;
  });
  const realizedPct = totalCost > 0 ? (totalRealized / totalCost) * 100 : null;
  const tdir = totalRealized > 0 ? "up" : totalRealized < 0 ? "down" : "flat";

  return (
    <div>
      {/* 실현 손익 요약 */}
      {sells.length > 0 && (
        <div className="sa-card">
          <h3><span className="sa-chip">실현 손익</span> 지금까지 판 것의 손익</h3>
          <div className="sa-realized">
            <div className={"amt " + tdir}>{totalRealized >= 0 ? "+" : "−"}{won(Math.abs(Math.round(totalRealized)))}</div>
            {realizedPct != null && (
              <div className={"pct " + tdir}>{realizedPct > 0 ? "▲ +" : realizedPct < 0 ? "▼ " : ""}{Math.abs(realizedPct).toFixed(2)}%</div>
            )}
          </div>
          <div className="sa-body" style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>
            매도 {sells.length}건 기준. 아직 안 판 것의 손익(평가손익)은 <b>내 잔고</b>에서 봐요.
          </div>
        </div>
      )}

      <div className="sa-card">
        <h3 style={{ justifyContent: "space-between" }}>
          <span><span className="sa-chip">매매 기록</span> 내 매수·매도 일지</span>
          <span className="sa-h3-actions">
            <button className="sa-btn sa-btn-sm" onClick={() => setOpen((v) => !v)}>{open ? "닫기" : "+ 등록"}</button>
            <button className="sa-btn sa-btn-sm sa-btn-gray" disabled={rows.length === 0}
              title={rows.length === 0 ? "비울 기록이 없어요" : "매매 기록 전체 비우기"}
              onClick={() => setConfirmReset(true)}>리셋</button>
          </span>
        </h3>

        {open && <TradeForm modes={["buy", "sell"]} onDone={() => { setOpen(false); reload(); }} />}

        {loading ? (
          <div className="sa-load"><div className="sa-spin" /><div className="sa-loadmsg">기록 불러오는 중…</div></div>
        ) : rows.length === 0 ? (
          <div className="sa-holdings-empty">
            <div className="ico">🧾</div>
            <div className="t">아직 매매 기록이 없어요.<br />내 잔고에서 매수·매도를 등록하면 여기에 쌓여요.</div>
          </div>
        ) : (
          <div className="sa-txlist">
            {rows.map((t) => {
              const pnl = sellPnl(t);
              const pdir = !pnl ? "" : pnl.pct > 0 ? "up" : pnl.pct < 0 ? "down" : "flat";
              return (
                <div className="sa-tx" key={t.id}>
                  <div className={"sa-tx-side " + t.side}>{t.side === "buy" ? "매수" : "매도"}</div>
                  <div className="sa-tx-main">
                    <div className="nm">{t.stock_name}</div>
                    <div className="sub">{fmt(t.traded_at)} · {num(t.quantity)}주 {t.price ? "· " + won(Math.round(t.price)) : ""}</div>
                  </div>
                  {pnl && (
                    <div className={"sa-tx-pnl " + pdir}>
                      {pnl.realized >= 0 ? "+" : "−"}{won(Math.abs(Math.round(pnl.realized)))}
                      <div className="sub">{pnl.pct > 0 ? "+" : ""}{pnl.pct.toFixed(1)}%</div>
                    </div>
                  )}
                  <button className="sa-holding-x" title="기록 삭제"
                    onClick={async () => { if (confirm("이 기록을 삭제할까요? (잔고는 자동 보정되지 않아요)")) { await deleteTransaction(t.id); reload(); } }}>✕</button>
                </div>
              );
            })}
          </div>
        )}
        <div className="sa-disc" style={{ marginTop: 14 }}>
          매도 손익은 <b>판 시점의 평단</b> 기준이에요. 기록을 지워도 잔고는 자동으로 안 바뀌어요(잔고는 <b>내 잔고</b>에서 직접 수정).
        </div>
      </div>

      <ConfirmModal
        open={confirmReset}
        title="매매 기록을 리셋할까요?"
        body={<>매매 기록 <b>{rows.length}건</b>이 목록에서 모두 사라지고, <b>실현손익 합계도 0으로</b> 초기화돼요.<br />
          기록 내용은 <b>DB에 백업으로 보관</b>되니 데이터가 사라지진 않아요.</>}
        confirmLabel="리셋하기"
        busy={resetting}
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
