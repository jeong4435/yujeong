import React, { useState } from "react";
import { getPortfolioCoach } from "../api.js";

function parseAnalysis(text) {
  if (!text) return [];
  const out = [];
  text.split("▌").forEach((part, i) => {
    const seg = part.trim();
    if (!seg) return;
    if (i === 0) { out.push({ label: "", summary: "", text: seg }); return; }
    const nl = seg.indexOf("\n");
    const head = (nl === -1 ? seg : seg.slice(0, nl)).trim();
    const body = nl === -1 ? "" : seg.slice(nl + 1).trim();
    const di = head.indexOf("::");
    out.push({
      label: (di === -1 ? head : head.slice(0, di)).trim(),
      summary: di === -1 ? "" : head.slice(di + 2).trim(),
      text: body,
    });
  });
  return out;
}

export default function PortfolioCoach({ holdings, prices, investType }) {
  const [coaching, setCoaching] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!holdings || holdings.length === 0) return null;

  async function run() {
    setLoading(true);
    const data = holdings.map((h) => {
      const cur = prices[h.stock_code]?.price ?? null;
      const avg = Number(h.avg_price);
      const qty = Number(h.quantity);
      const evalAmt = cur != null ? cur * qty : null;
      const pnlPct = cur != null && avg ? Math.round(((cur - avg) / avg) * 1000) / 10 : null;
      return {
        name: h.stock_name,
        quantity: qty,
        avg_price: avg,
        current_price: cur,
        eval_amount: evalAmt,
        pnl_pct: pnlPct,
      };
    });
    const result = await getPortfolioCoach(data, investType || "");
    setCoaching(result);
    setDone(true);
    setLoading(false);
  }

  return (
    <div className="sa-card">
      <h3><span className="sa-chip">AI 코칭</span> 내 포트폴리오 AI 진단</h3>

      {!done && !loading && (
        <>
          <div className="sa-body" style={{ color: "var(--ink2)", marginBottom: 14 }}>
            보유 종목 <b>{holdings.length}개</b>를 AI가 분석해 드려요.
            {investType && <> · <b>{investType}</b> 유형 기준</>}
          </div>
          <button className="sa-btn" style={{ width: "100%", padding: "13px" }} onClick={run}>
            ✨ AI 포트폴리오 진단 받기
          </button>
        </>
      )}

      {loading && (
        <div className="sa-analysis-loading">
          <div className="sa-spin" />
          <span>Gemini가 내 포트폴리오 분석 중…</span>
        </div>
      )}

      {coaching && (
        <>
          <div className="sa-analysis">
            {parseAnalysis(coaching).map((sec, i) => (
              <div key={i} className="sa-analysis-section">
                {i > 0 && sec.label && <div className="sa-analysis-divider" />}
                {sec.label && (
                  <div className="sa-analysis-head">
                    <span className="sa-analysis-label">{sec.label}</span>
                    {sec.summary && <span className="sa-analysis-sum">{sec.summary}</span>}
                  </div>
                )}
                <div className={sec.label ? "sa-analysis-text" : "sa-analysis-intro"}>{sec.text}</div>
              </div>
            ))}
          </div>
          <button className="sa-btn sa-btn-sm sa-btn-gray" style={{ marginTop: 14 }}
            onClick={() => { setCoaching(null); setDone(false); }}>
            다시 진단받기
          </button>
          <div className="sa-disc" style={{ marginTop: 12 }}>
            AI 진단은 공개 데이터 기반 참고 정보예요. 투자 결정은 본인이 직접 판단하세요.
          </div>
        </>
      )}

      {done && !coaching && (
        <div className="sa-body" style={{ color: "var(--muted)", marginTop: 8 }}>
          분석에 실패했어요. 잠시 후 다시 시도해주세요.
        </div>
      )}
    </div>
  );
}
