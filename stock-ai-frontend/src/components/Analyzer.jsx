import React, { useState, useEffect } from "react";
import { getStock, getDetails, getExplain, getExamples, won, num, eok } from "../api.js";
import MyStocks from "./MyStocks.jsx";

// 거래대금 TOP을 못 받아왔을 때 보여줄 기본 예시
const FALLBACK_EXAMPLES = ["삼성전자", "SK하이닉스", "카카오", "현대차", "005930"];

// 추세 방향 → 라벨/색/문장
function trendLabel(dir) {
  if (dir === "up") return "▲ 상승";
  if (dir === "down") return "▼ 하락";
  if (dir === "mixed_up") return "↗ 등락(상승)";
  if (dir === "mixed_down") return "↘ 등락(하락)";
  if (dir === "mixed") return "↔ 보합";
  return "·";
}
function trendClass(dir) {
  if (dir === "up" || dir === "mixed_up") return "v-over";
  if (dir === "down" || dir === "mixed_down") return "v-under";
  return "v-hold";
}
function trendComment(t) {
  if (!t) return "";
  const name = { up: "꾸준히 늘었어요", mixed_up: "오르내림은 있지만 늘어난 편이에요", down: "꾸준히 줄었어요", mixed_down: "오르내림은 있지만 줄어든 편이에요", mixed: "큰 변화 없이 비슷해요" };
  const op = t.operating_profit_dir;
  const head = op ? `최근 3년 영업이익이 ${name[op] || "흐름을 판단하기 어려워요"}.` : "";
  let tail = "";
  if (op === "up" || op === "mixed_up") tail = " 장사로 버는 힘이 좋아지는 모습이에요.";
  else if (op === "down" || op === "mixed_down") tail = " 버는 힘이 약해지고 있어, 왜 그런지 같이 봐야 해요.";
  return (head + tail).trim();
}
// 'YYYYMMDD' 또는 'YYYY-MM-DD' → 'YYYY.MM.DD'
function fmtDate(s) {
  if (!s) return "";
  const d = String(s).replace(/-/g, "");
  if (d.length === 8) return `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}`;
  return String(s);
}

export default function Analyzer({ initialQuery, onConsumed }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [explLoading, setExplLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState("");
  const [examples, setExamples] = useState(FALLBACK_EXAMPLES);

  // 예시 칩 = 전일 거래대금 TOP (실패하면 기본 목록 유지)
  useEffect(() => {
    getExamples().then((list) => { if (list && list.length) setExamples(list); });
  }, []);

  // 이슈 종목 탭에서 넘어온 종목 자동 분석
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      run(initialQuery);
      onConsumed && onConsumed();
    }
    // eslint-disable-next-line
  }, [initialQuery]);

  async function run(q) {
    const term = (q ?? query).trim();
    if (!term || loading) return;
    setLast(term);
    setLoading(true); setError(""); setData(null); setExplanation(null);
    try {
      const d = await getStock(term);   // 1차: 시세·PER·밸류해설 (빠름)
      if (d.error) { setError(d.error); return; }
      setData(d);
      // 2차: 3개년 재무·공시·뉴스는 따로 불러 뒤이어 채움 (느릴 수 있음)
      setDetailsLoading(true);
      getDetails(term).then((det) => {
        setData((prev) => (prev ? { ...prev, ...det } : prev));
        setDetailsLoading(false);
      });
      // 설명은 따로(키 있을 때만, 숫자 먼저 보여주고 뒤이어 채움)
      setExplLoading(true);
      getExplain(term).then((ex) => { setExplanation(ex); setExplLoading(false); });
    } catch (e) {
      setError("서버에 연결하지 못했어요. 백엔드(uvicorn)가 켜져 있는지 확인하세요.");
    } finally {
      setLoading(false);
    }
  }

  const f = data?.financials || {};
  const fu = data?.fundamentals || {};
  const dir = data?.change_pct == null ? "flat" : data.change_pct > 0 ? "up" : data.change_pct < 0 ? "down" : "flat";
  const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "·";
  const changeClass = dir === "up" ? "v-over" : dir === "down" ? "v-under" : "v-hold";

  return (
    <div>
      {!data && !loading && (
        <>
          <div className="sa-card">
            <div className="sa-hero">
              진짜 데이터로, <span className="hl">쉽게</span><br />뜯어봐요
            </div>
            <div className="sa-herosub">원하는 종목을 검색해주세요</div>
            <div className="sa-searchrow">
              <input
                className="sa-input"
                placeholder="예: 삼성전자  또는  005930"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
              />
              <button className="sa-btn" onClick={() => run()} disabled={!query.trim()}>분석</button>
            </div>
            <div className="sa-examples">
              {examples.map((x) => (
                <button key={x} className="sa-ex" onClick={() => { setQuery(x); run(x); }}>{x}</button>
              ))}
            </div>
          </div>

          <MyStocks onPick={(name) => run(name)} />
        </>
      )}

      {loading && (
        <div className="sa-card">
          <div className="sa-load">
            <div className="sa-spin" />
            <div className="sa-loadmsg">DART·KRX에서 진짜 데이터 가져오는 중…</div>
            <div className="sa-loadsub">첫 조회는 종목목록 받느라 조금 걸려요</div>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="sa-card">
          <div className="sa-err">⚠️ {error}</div>
          <button className="sa-retry" onClick={() => run(last)}>다시 시도</button>
        </div>
      )}

      {data && !loading && (
        <>
          <div className="sa-card">
            <div className="sa-verdict">
              <span className="sa-price">{won(data.price)}</span>
              {data.change_pct != null && (
                <span className={"sa-badge " + changeClass}>{arrow} {data.change_pct}%</span>
              )}
            </div>
            <div className="sa-body" style={{ marginTop: 8 }}>
              <b>{data.name}</b> <span style={{ color: "var(--muted)" }}>{data.code}</span>
              {data.as_of && <span style={{ color: "var(--muted)" }}> · 🕒 {data.as_of} 종가</span>}
            </div>

            {explLoading && <div className="sa-explain-off">🧑‍🏫 쉬운 설명 만드는 중…</div>}
            {explanation && (
              <div className="sa-note">
                <div className="lbl">주식도AI 한마디</div>
                <div className="txt">{explanation}</div>
              </div>
            )}
          </div>

          <div className="sa-card">
            <h3><span className="sa-chip">밸류</span> 지금 가격, 비싼 걸까 싼 걸까?</h3>
            <div className="sa-kv"><span className="k">PER (주가수익비율)</span><span className="v">{fu.per != null ? fu.per + "배" : "확인 어려움"}</span></div>
            <div className="sa-kv"><span className="k">PBR (주가순자산비율)</span><span className="v">{fu.pbr != null ? fu.pbr + "배" : "확인 어려움"}</span></div>
            <div className="sa-kv"><span className="k">EPS (주당순이익)</span><span className="v">{fu.eps != null ? num(fu.eps) + "원" : "확인 어려움"}</span></div>
            {fu.forward_per != null && (
              <div className="sa-kv"><span className="k">예상 PER <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 11 }}>(증권사 예상이익 기준)</span></span><span className="v">{fu.forward_per}배</span></div>
            )}
            {data.value_analysis && (
              <div className="sa-note" style={{ marginTop: 12 }}>
                <div className="lbl">이 가격, 싼 편일까 비싼 편일까</div>
                <div className="txt">{data.value_analysis}</div>
              </div>
            )}
          </div>

          <div className="sa-card">
            <h3><span className="sa-chip">재무</span> 회사가 장사로 돈을 잘 버나? <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 12 }}>DART 3개년</span></h3>
            {f.trend?.years?.length ? (
              <>
                <table className="sa-trend">
                  <thead>
                    <tr>
                      <th></th>
                      {f.trend.years.map((y) => <th key={y}>{y}</th>)}
                      <th>흐름</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["매출액", f.trend.revenue, f.trend.revenue_dir],
                      ["영업이익", f.trend.operating_profit, f.trend.operating_profit_dir],
                      ["당기순이익", f.trend.net_income, f.trend.net_income_dir],
                    ].map(([label, vals, dir]) => (
                      <tr key={label}>
                        <td className="rl">{label}</td>
                        {vals.map((v, i) => <td key={i} className="rv">{eok(v)}</td>)}
                        <td className={"rt " + trendClass(dir)}>{trendLabel(dir)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="sa-body" style={{ marginTop: 10 }}>{trendComment(f.trend)}</div>
              </>
            ) : detailsLoading ? (
              <div className="sa-explain-off">📊 3개년 재무 불러오는 중…</div>
            ) : (
              <div className="sa-body" style={{ color: "var(--muted)" }}>3개년 추세 데이터를 찾지 못했어요.</div>
            )}
          </div>

          <div className="sa-card">
            <h3><span className="sa-chip">공시</span> 회사가 공식 발표한 일 <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 12 }}>DART 최신</span></h3>
            {data.disclosures?.length ? data.disclosures.map((d, i) => (
              <div className="sa-issue" key={i}>
                <div className="d" style={{ fontSize: 12, color: "var(--muted)" }}>{fmtDate(d.date)}</div>
                <div className="t">{d.title}</div>
              </div>
            )) : detailsLoading
              ? <div className="sa-explain-off">📑 공시 불러오는 중…</div>
              : <div className="sa-body" style={{ color: "var(--muted)" }}>최근 3개월 공시를 찾지 못했어요.</div>}
          </div>

          <div className="sa-card">
            <h3><span className="sa-chip">뉴스</span> 요즘 이 종목, 무슨 얘기가 나왔나? <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 12 }}>최근 3개월</span></h3>
            {data.news?.length ? data.news.map((n, i) => (
              <a className="sa-news" key={i} href={n.url} target="_blank" rel="noopener noreferrer">
                <div className="d" style={{ fontSize: 12, color: "var(--muted)" }}>{n.date} · {n.source}</div>
                <div className="t">{n.title} <span className="sa-newslink">↗</span></div>
              </a>
            )) : detailsLoading
              ? <div className="sa-explain-off">📰 최근 뉴스 불러오는 중…</div>
              : <div className="sa-body" style={{ color: "var(--muted)" }}>최근 3개월 관련 기사를 찾지 못했어요.</div>}
            <div className="sa-body" style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
              기사는 네이버 뉴스에서 모은 거예요. 제목만으로 호재·악재를 단정하지 말고 원문을 꼭 확인하세요.
            </div>
          </div>

          <button className="sa-btn" style={{ width: "100%", padding: "15px" }}
            onClick={() => { setData(null); setQuery(""); setExplanation(null); setDetailsLoading(false); }}>
            🔍 다른 종목 분석하기
          </button>

          <div className="sa-disc">
            <b>꼭 읽어주세요.</b> 시세·거래량은 <b>종가 기준</b>이라 장중 실시간과 다를 수 있어요.
            이 화면은 투자 권유가 아닌 정보 정리용이며, 실제 투자 전엔 <b>DART 원문·증권사 앱</b>으로 직접 확인하세요.
          </div>
        </>
      )}
    </div>
  );
}
