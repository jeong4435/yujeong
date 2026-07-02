import React, { useState, useEffect, useRef } from "react";
import { getIndices, getMarketAnalysis, getMarketTrend, num } from "../api.js";

// ▌로 구분. 머리줄 "제목 :: 한 줄 요약" → {label, summary}. 첫 ▌ 이전(인사말)은 인트로.
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

// 섹터 분석에서 강조할 섹터·테마 이름(긴 단어 우선 정렬로 부분매칭 방지)
const SECTORS = [
  "2차전지", "우주항공", "전기전자", "엔터테인먼트", "석유화학", "헬스케어", "의료기기",
  "반도체", "디스플레이", "배터리", "바이오", "제약", "자동차", "철강", "조선", "건설",
  "화학", "정유", "금융", "은행", "증권", "보험", "엔터", "게임", "인터넷", "통신",
  "유통", "식음료", "식품", "화장품", "항공", "해운", "방산", "원자력", "로봇", "풍력",
  "태양광", "신재생", "전력", "미디어", "콘텐츠", "패션", "의류", "가구", "에너지",
  "여행", "제지", "시멘트", "비철금속", "조선", "농업", "방위산업",
].sort((a, b) => b.length - a.length);
const SECTOR_RE = new RegExp("(" + SECTORS.join("|") + ")", "g");

// 텍스트 내 섹터 이름을 <mark>로 감싸 형광펜 강조 (React 노드 배열 반환)
function highlightSectors(text) {
  if (!text) return text;
  return text.split(SECTOR_RE).map((p, i) =>
    SECTORS.includes(p) ? <mark key={i} className="sa-sector-hl">{p}</mark> : p
  );
}

// 종가 시계열 → 미니 그래프(SVG). 상승=빨강 / 하락=파랑 (한국 증시 관례)
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

// 기간별 지수 표시 데이터 계산
function getPeriodData(x, period) {
  const series = x.series || [];
  if (period === "today") {
    return { series, changePct: x.change_pct, asOf: x.as_of + " 기준" };
  }
  const n = period === "week" ? 5 : series.length;
  const sl = series.length >= n ? series.slice(-n) : series;
  const changePct = sl.length >= 2
    ? (sl[sl.length - 1] - sl[0]) / sl[0] * 100
    : null;
  return {
    series: sl,
    changePct,
    asOf: period === "week" ? "최근 5거래일 기준" : "최근 25거래일 기준",
  };
}

const ANALYSIS_TITLE = {
  today: "오늘의 시황 · 섹터",
  week: "1주 시황 · 섹터",
  month: "한달 시황 · 섹터",
};

const INDEX_NOTE = {
  today: "📈 그래프는 최근 25거래일 종가 기준이에요. 추후 증권사 실시간 시세 연동 예정.",
  week: "📈 최근 5거래일(1주) 종가 기준 등락률이에요.",
  month: "📈 최근 25거래일(한달) 종가 기준 등락률이에요.",
};

export default function MarketToday() {
  const [indices, setIndices] = useState(null);
  const [idxLoading, setIdxLoading] = useState(true);
  const [period, setPeriod] = useState("today");
  const [analyses, setAnalyses] = useState({});
  const fetchedRef = useRef(new Set(["today"])); // 마운트 시 today 즉시 fetch

  // 최초 마운트: 지수 + 당일 AI 분석 로드
  useEffect(() => {
    let alive = true;
    getIndices().then((d) => {
      if (!alive) return;
      setIndices(d?.indices || []);
      setIdxLoading(false);
    });
    getMarketAnalysis().then((t) => {
      if (!alive) return;
      setAnalyses((prev) => ({ ...prev, today: t }));
    });
    return () => { alive = false; };
  }, []);

  // 기간 변경 시 해당 기간 AI 분석 lazy 로드 (한 번만)
  useEffect(() => {
    if (period === "today" || fetchedRef.current.has(period)) return;
    fetchedRef.current.add(period);
    let alive = true;
    getMarketTrend(period).then((t) => {
      if (!alive) return;
      setAnalyses((prev) => ({ ...prev, [period]: t }));
    });
    return () => { alive = false; };
  }, [period]);

  const analysis = analyses[period];
  const anLoading = !(period in analyses);

  const fmtIdx = (n) => (n == null ? "—" : Number(n).toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

  return (
    <div>
      {/* 히어로 카드 + 기간 드롭다운 (A안) */}
      <div className="sa-card">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div className="sa-hero" style={{ fontSize: 22 }}>오늘의 <span className="hl">시장</span></div>
            <div className="sa-herosub">주요 지수와 시황·섹터 흐름을 한눈에.</div>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{
              fontSize: 13,
              padding: "5px 10px",
              borderRadius: 8,
              border: "1.5px solid var(--line)",
              background: "var(--soft)",
              color: "var(--ink)",
              cursor: "pointer",
              marginTop: 4,
              outline: "none",
            }}
          >
            <option value="today">당일</option>
            <option value="week">1주</option>
            <option value="month">한달</option>
          </select>
        </div>
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
            const { series: sl, changePct: cp, asOf } = getPeriodData(x, period);
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
                <Sparkline series={sl} up={dir === "up" ? true : dir === "down" ? false : null} />
                <div className="sa-index-d">{asOf}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="sa-card">
          <div className="sa-body" style={{ color: "var(--muted)" }}>지수 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</div>
        </div>
      )}

      <div className="sa-index-note">{INDEX_NOTE[period]}</div>

      {/* 시황·섹터 AI 분석 */}
      {anLoading ? (
        <div className="sa-card">
          <div className="sa-analysis-loading">
            <div className="sa-spin" />
            <span>
              {period === "today" ? "오늘의 시황·섹터 분석 작성 중…"
                : period === "week" ? "1주 흐름 분석 중…"
                : "한달 흐름 분석 중…"}
            </span>
          </div>
        </div>
      ) : analysis ? (
        <div className="sa-card">
          <h3><span className="sa-chip">AI 분석</span> {ANALYSIS_TITLE[period]}</h3>
          <div className="sa-analysis">
            {parseAnalysis(analysis).map((sec, i) => (
              <div key={i} className="sa-analysis-section">
                {i > 0 && sec.label && <div className="sa-analysis-divider" />}
                {sec.label && (
                  <div className="sa-analysis-head">
                    <span className="sa-analysis-label">{sec.label}</span>
                    {sec.summary && <span className="sa-analysis-sum">{sec.summary}</span>}
                  </div>
                )}
                <div className={sec.label ? "sa-analysis-text" : "sa-analysis-intro"}>
                  {sec.label && sec.label.includes("섹터") ? highlightSectors(sec.text) : sec.text}
                </div>
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
