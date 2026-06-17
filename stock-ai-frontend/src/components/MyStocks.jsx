import React, { useState } from "react";

// 종목 분석 탭 상단의 "내 보유 주식" 자리.
// ⚠️ 현재는 비로그인 자리만 구현. 로그인(Phase 0/1)+잔고(Phase 2)가 붙으면
//    loggedIn/holdings를 실제 값으로 바꾸고, onPick으로 종목을 눌러 바로 분석한다.
export default function MyStocks({ onPick }) {
  const [soon, setSoon] = useState(false);

  // TODO(Phase 0/1): Supabase 세션으로 교체
  const loggedIn = false;
  // TODO(Phase 2): Supabase holdings 테이블에서 로드 → [{name, code, qty, avg, price, change_pct}]
  const holdings = [];

  return (
    <div className="sa-card">
      <h3><span className="sa-chip">내 보유 주식</span></h3>

      {/* 위: 로그인 버튼 (비로그인일 때만) */}
      {!loggedIn && (
        <button className="sa-btn" style={{ width: "100%", padding: "14px" }}
          onClick={() => setSoon(true)}>
          🔒 로그인하고 내 보유 주식 종목 확인하기
        </button>
      )}

      {soon && !loggedIn && (
        <div className="sa-note" style={{ marginTop: 12 }}>
          <div className="lbl">주식도AI 한마디</div>
          <div className="txt">로그인 기능을 준비 중이에요. 곧 로그인하면 내 보유 주식이 여기에 뜨고, 종목을 눌러 바로 분석할 수 있어요!</div>
        </div>
      )}

      {/* 아래: 로그인 시 보유 주식이 들어갈 공간 */}
      <div className="sa-holdings">
        {loggedIn && holdings.length ? (
          holdings.map((h, i) => {
            const dir = h.change_pct == null ? "flat" : h.change_pct > 0 ? "up" : h.change_pct < 0 ? "down" : "flat";
            return (
              <button className="sa-holding" key={i} onClick={() => onPick && onPick(h.name)}>
                <div className="hl">
                  <div className="nm">{h.name}</div>
                  <div className="sub">{h.qty}주 · 평단 {Number(h.avg).toLocaleString("ko-KR")}원</div>
                </div>
                <div className={"hr " + dir}>
                  {h.change_pct != null ? (h.change_pct > 0 ? "+" : "") + h.change_pct + "%" : "—"}
                </div>
              </button>
            );
          })
        ) : (
          <div className="sa-holdings-empty">
            <div className="ico">📥</div>
            <div className="t">로그인하면 보유 종목이 여기에 표시되고,<br />종목을 눌러 바로 분석할 수 있어요.</div>
          </div>
        )}
      </div>
    </div>
  );
}
