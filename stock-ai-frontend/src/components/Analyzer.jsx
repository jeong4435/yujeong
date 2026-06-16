import React, { useState, useEffect } from "react";
import { getStock, getExplain, won, num, eok } from "../api.js";

export default function Analyzer({ initialQuery, onConsumed }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [explLoading, setExplLoading] = useState(false);
  const [error, setError] = useState("");
  const [last, setLast] = useState("");

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
      const d = await getStock(term);
      if (d.error) { setError(d.error); return; }
      setData(d);
      // 설명은 따로(느릴 수 있어 숫자 먼저 보여주고 뒤이어 채움)
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
        <div className="sa-card">
          <div className="sa-hero">
            진짜 데이터로, <span className="hl">쉽게</span><br />뜯어봐요
          </div>
          <div className="sa-herosub">DART·KRX에서 시세·거래량·PER·재무·공시를 직접 가져와요.</div>
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
            {["삼성전자", "SK하이닉스", "카카오", "현대차", "005930"].map((x) => (
              <button key={x} className="sa-ex" onClick={() => { setQuery(x); run(x); }}>{x}</button>
            ))}
          </div>
        </div>
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
            <div className="sa-kv"><span className="k">PER (주가수익비율)</span><span className="v">{fu.per ?? "확인 어려움"}</span></div>
            <div className="sa-kv"><span className="k">PBR (주가순자산비율)</span><span className="v">{fu.pbr ?? "확인 어려움"}</span></div>
            <div className="sa-kv"><span className="k">EPS (주당순이익)</span><span className="v">{fu.eps != null ? num(fu.eps) + "원" : "확인 어려움"}</span></div>
            <div className="sa-body" style={{ marginTop: 10 }}>
              PER은 '주가 ÷ 주당순이익'이에요. 숫자가 낮을수록 버는 돈에 비해 주가가 싼 편, 높을수록 기대가 많이 반영된 편이에요. 같은 업종끼리 비교해야 의미가 있어요.
            </div>
          </div>

          <div className="sa-card">
            <h3><span className="sa-chip">재무</span> 회사가 장사로 돈을 잘 버나? <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 12 }}>DART {f.year || ""}</span></h3>
            <div className="sa-kv"><span className="k">매출액</span><span className="v">{eok(f.revenue)}</span></div>
            <div className="sa-kv"><span className="k">영업이익</span><span className="v">{eok(f.operating_profit)}</span></div>
            <div className="sa-kv"><span className="k">당기순이익</span><span className="v">{eok(f.net_income)}</span></div>
          </div>

          <div className="sa-card">
            <h3><span className="sa-chip">공시</span> 최근 무슨 일이 있었나? <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: 12 }}>DART</span></h3>
            {data.disclosures?.length ? data.disclosures.map((d, i) => (
              <div className="sa-issue" key={i}>
                <div className="d" style={{ fontSize: 12, color: "var(--muted)" }}>{d.date}</div>
                <div className="t">{d.title}</div>
              </div>
            )) : <div className="sa-body" style={{ color: "var(--muted)" }}>최근 6개월 공시를 찾지 못했어요.</div>}
          </div>

          <button className="sa-btn" style={{ width: "100%", padding: "15px" }}
            onClick={() => { setData(null); setQuery(""); setExplanation(null); }}>
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
