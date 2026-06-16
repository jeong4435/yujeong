import React, { useState, useEffect } from "react";
import { getTrending, won } from "../api.js";

export default function IssueBoard({ cache, setCache, onPick }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (loading) return;
    setLoading(true); setError("");
    try {
      const d = await getTrending();
      setCache(d);
    } catch (e) {
      setError("이슈 종목을 불러오지 못했어요. 백엔드(uvicorn)가 켜져 있는지 확인하세요.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!cache && !loading) load();
    // eslint-disable-next-line
  }, []);

  return (
    <div>
      <div className="sa-card">
        <div className="sa-hero" style={{ fontSize: 22 }}>
          지금 <span className="hl">시끄러운</span> 종목들
        </div>
        <div className="sa-herosub">KRX 실데이터 기준 거래대금 상위·급등·급락이에요. 카드를 누르면 전체 분석으로 넘어가요.</div>
        {cache?.updated && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>🕒 {cache.updated}</span>
            <button className="sa-ex" onClick={load} disabled={loading}>↻ 새로고침</button>
          </div>
        )}
      </div>

      {loading && (
        <div className="sa-card">
          <div className="sa-load">
            <div className="sa-spin" />
            <div className="sa-loadmsg">KRX에서 오늘의 종목 모으는 중…</div>
            <div className="sa-loadsub">전 종목 시세를 받아 정렬하고 있어요</div>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="sa-card">
          <div className="sa-err">⚠️ {error}</div>
          <button className="sa-retry" onClick={load}>다시 시도</button>
        </div>
      )}

      {cache?.groups?.map((g, gi) => (
        <div key={gi}>
          <div className="sa-group-h">
            <div className="gl">{g.label}</div>
            <div className="gd">{g.desc}</div>
          </div>
          {g.stocks.map((s, i) => {
            const dir = s.change_pct == null ? "flat" : s.change_pct > 0 ? "up" : s.change_pct < 0 ? "down" : "flat";
            const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "·";
            return (
              <button className="sa-issuecard" key={i} onClick={() => onPick(s.name)}>
                <div className="sa-ic-top">
                  <div className="sa-ic-name">
                    <span className="sa-ic-rank">{i + 1}</span>{s.name}
                    <span className="sa-ic-ticker">{s.code}</span>
                  </div>
                  <div className={"sa-ic-change " + dir}>{arrow} {s.change_pct != null ? s.change_pct + "%" : "—"}</div>
                </div>
                <div className="sa-ic-price">{won(s.price)}</div>
                <div className="sa-ic-foot">
                  <span className="sa-ic-vol">📊 거래량 {Number(s.volume).toLocaleString("ko-KR")}주</span>
                  <span className="sa-ic-go">자세히 분석 →</span>
                </div>
              </button>
            );
          })}
        </div>
      ))}

      {cache?.groups?.length ? (
        <div className="sa-disc">
          <b>참고용 안내.</b> '거래대금·등락률'은 화제성·변동성 기준이지 추천이 아니에요.
          시끄럽다고 좋은 종목인 건 아니고, 종가 기준이라 장중과 다를 수 있어요.
        </div>
      ) : null}
    </div>
  );
}
