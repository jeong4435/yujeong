import React, { useState } from "react";
import Analyzer from "./components/Analyzer.jsx";
import IssueBoard from "./components/IssueBoard.jsx";
import Quiz from "./components/Quiz.jsx";

export default function App() {
  const [tab, setTab] = useState("issue");
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
          <div className="sa-brand">
            <h1 className="sa-wordmark" onClick={() => setTab("issue")}>주식도 <span className="br">AI</span></h1>
          </div>
          <div className="sa-tag">DART·KRX에서 가져온 진짜 데이터를, 쉽게 풀어드려요.</div>
        </div>

        <div className="sa-tabs">
          <button className={"sa-tab" + (tab === "issue" ? " on" : "")} onClick={() => setTab("issue")}>이슈 종목</button>
          <button className={"sa-tab" + (tab === "stock" ? " on" : "")} onClick={() => setTab("stock")}>종목 분석</button>
          <button className={"sa-tab" + (tab === "type" ? " on" : "")} onClick={() => setTab("type")}>내 유형{userType ? " ✓" : ""}</button>
        </div>

        {tab === "issue" && <IssueBoard cache={issueCache} setCache={setIssueCache} onPick={pickStock} />}
        {tab === "stock" && (
          <Analyzer initialQuery={pendingQuery} onConsumed={() => setPendingQuery(null)} />
        )}
        {tab === "type" && <Quiz onResult={setUserType} savedType={userType} />}

        <div className="sa-foot">〈주식도 AI〉 · 투자 권유가 아닌 공부용 도구예요</div>
      </div>
    </div>
  );
}
