import React, { useState } from "react";
import MarketToday from "./components/MarketToday.jsx";
import Analyzer from "./components/Analyzer.jsx";
import IssueBoard from "./components/IssueBoard.jsx";
import MyPage from "./components/MyPage.jsx";
import AuthButton from "./components/AuthButton.jsx";

export default function App() {
  const [tab, setTab] = useState("market");
  const [userType, setUserType] = useState(null);
  const [issueCache, setIssueCache] = useState(null);
  const [pendingQuery, setPendingQuery] = useState(null);

  function pickStock(name) {
    setPendingQuery(name);
    setTab("stock");
  }

  return (
    <div className="sa-root">
      <div className="sa-wrap">
        <div className="sa-top">
          <div className="sa-topbar">
            <div className="sa-brand">
              <h1 className="sa-wordmark" onClick={() => setTab("market")}>주식도 <span className="br">AI</span></h1>
            </div>
            <AuthButton />
          </div>
          <div className="sa-tag">DART·KRX에서 가져온 진짜 데이터를, 쉽게 풀어드려요.</div>
        </div>

        <div className="sa-tabs">
          {[
            ["market", "📊", "오늘의 시장"],
            ["issue", "🔥", "이슈 종목"],
            ["stock", "🔍", "종목 분석"],
            ["my", "💼", "나의 주식"],
          ].map(([key, ic, label]) => (
            <button key={key} className={"sa-tab" + (tab === key ? " on" : "")} onClick={() => setTab(key)}>
              <span className="sa-tab-ic">{ic}</span>
              <span className="sa-tab-tx">{label}</span>
            </button>
          ))}
        </div>

        {tab === "market" && <MarketToday />}
        {tab === "issue" && <IssueBoard cache={issueCache} setCache={setIssueCache} onPick={pickStock} />}
        {tab === "stock" && (
          <Analyzer initialQuery={pendingQuery} onConsumed={() => setPendingQuery(null)} />
        )}
        {tab === "my" && <MyPage onPick={pickStock} userType={userType} setUserType={setUserType} />}

        <div className="sa-foot">〈주식도 AI〉 · 투자 권유가 아닌 공부용 도구예요</div>
      </div>
    </div>
  );
}
