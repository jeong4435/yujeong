import React, { useState, useEffect } from "react";
import { getIndices, getMarketAnalysis, num } from "../api.js";

// ▌로 구분된 AI 분석 텍스트 → [{label, text}]
function parseAnalysis(text) {
  if (!text) return [];
  return text.split(/▌/).filter(Boolean).map((part) => {
    const nl = part.indexOf("\n");
    return nl === -1
      ? { label: part.trim(), text: "" }
      : { label: part.slice(0, nl).trim(), text: part.slice(nl).trim() };
  });
}

// 종가 시계열 → 미니 그래프(SVG). 상승=빨강 / 하락=파랑 (한국 증시 관례)
// ※ 추후 증권사 실시간 API로 데이터만 교체하면 그대로 동작
function Sparkline({ series, up }) {
  if (!series || series.length < 2) return null;
  const W = 100, H = 32, pad = 2;
  const min = Math.min(...series), max = Math.max(...series);
  const span = max - min || 1;
  const stepX = (W - pad * 2) / (series.length - 1);
  const pts = series.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (H - pad * 2) * (1 - (v - min) / span);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color = up == null ? "var(--muted)" : up ? "var(--up)" : "var(--down)";
  const areaColor = up == null ? "var(--soft)" : up ? "var(--up-soft)" : "var(--down-soft)";
  return (
    <svg className="sa-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polygon points={`${pad},${H} ${pts.join(" ")} ${W - pad},${H}`} fill={areaColor} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.6"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function MarketToday() {
  const [indices, setIndices] = useState(null);
  const [idxLoading, setIdxLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [anLoading, setAnLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getIndices().then((d) => {
      if (!alive) return;
      setIndices(d?.indices || []);
      setIdxLoading(false);
    });
    getMarketAnalysis().then((t) => {
      if (!alive) return;
      setAnalysis(t);
      setAnLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const fmtIdx = (n) => (n == null ? "—" : Number(n).toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  return (
    <div>
      <div className="sa-card">
        <div className="sa-hero" style={{ fontSize: 22 }}>오늘의 <span className="hl">시장</span></div>
        <div className="sa-herosub">주요 지수와 오늘의 시황·섹터 흐름을 한눈에.</div>
      </div>

      {/* 지수 카드 (코스피·코스닥·나스닥·다우) */}
      {idxLoading ? (
        <div className="sa-card">
          <div className="sa-load">
            <div className="sa-spin" />
            <div className="sa-loadmsg">주요 지수 불러오는 중…</div>
          </div>
        </div>
      ) : indices && indices.length ? (
        <div className="sa-index-grid">
          {indices.map((x) => {
            const cp = x.change_pct;
            const dir = cp == null ? null : cp > 0 ? "up" : cp < 0 ? "down" : "flat";
            const cls = dir === "up" ? "v-over" : dir === "down" ? "v-under" : "v-hold";
            const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "·";
            return (
              <div className="sa-index" key={x.key}>
                <div className="sa-index-h">
                  <span className="nm">{x.name}</span>
                  {cp != null && <span className={"cp " + cls}>{arrow} {Math.abs(cp).toFixed(2)}%</span>}
                </div>
                <div className="sa-index-v">{fmtIdx(x.price)}</div>
                <Sparkline series={x.series} up={dir === "up" ? true : dir === "down" ? false : null} />
                <div className="sa-index-d">{x.as_of} 기준</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="sa-card">
          <div className="sa-body" style={{ color: "var(--muted)" }}>지수 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>
        </div>
      )}

      <div className="sa-index-note">
        📈 그래프는 최근 25거래일 종가 기준이에요. 추후 증권사 실시간 시세 연동 예정.
      </div>

      {/* 시황·섹터 AI 분석 */}
      {anLoading ? (
        <div className="sa-card">
          <div className="sa-analysis-loading">
            <div className="sa-spin" />
            <span>오늘의 시황·섹터 분석 작성 중…</span>
          </div>
        </div>
      ) : analysis ? (
        <div className="sa-card">
          <h3><span className="sa-chip">AI 분석</span> 오늘의 시황 · 섹터</h3>
          <div className="sa-analysis">
            {parseAnalysis(analysis).map((sec, i) => (
              <div key={i} className="sa-analysis-section">
                {i > 0 && <div className="sa-analysis-divider" />}
                <div className="sa-analysis-label">{sec.label}</div>
                <div className="sa-analysis-text">{sec.text}</div>
              </div>
            ))}
          </div>
          <div className="sa-disc" style={{ marginTop: 14 }}>
            AI 분석은 공개 데이터(지수·거래대금·등락) 기반 참고 정보예요. 투자 권유가 아니에요.
          </div>
        </div>
      ) : (
        <div className="sa-card">
          <div className="sa-body" style={{ color: "var(--muted)" }}>
            시황·섹터 분석을 불러오지 못했어요. (AI 분석 기능이 꺼져 있거나 일시적 오류)
          </div>
        </div>
      )}
    </div>
  );
}
