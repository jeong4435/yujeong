import React from "react";
import { hasSupabase } from "../supabase.js";
import { useSession, signInWithGoogle } from "../auth.js";

// 종목 분석 탭 상단의 "내 보유 주식" 자리.
// ✅ Phase 1-1(로그인): 실제 구글 세션과 연동됨.
// ⏳ Phase 1-2(잔고): 로그인 후 holdings 입력·표시는 다음 단계에서 붙임.
export default function MyStocks({ onPick }) {
  const { user, loading } = useSession();
  const loggedIn = !!user;

  // TODO(Phase 1-2): Supabase holdings 테이블에서 로드 → [{name, code, qty, avg, price, change_pct}]
  const holdings = [];

  return (
    <div className="sa-card">
      <h3><span className="sa-chip">내 보유 주식</span></h3>

      {/* 로그인 전: 구글 로그인 버튼 */}
      {!loggedIn && (
        <>
          <button
            className="sa-btn"
            style={{ width: "100%", padding: "14px" }}
            disabled={!hasSupabase || loading}
            onClick={() => signInWithGoogle()}
          >
            🔒 구글로 로그인하고 내 보유 주식 확인하기
          </button>
          {!hasSupabase && (
            <div className="sa-note" style={{ marginTop: 12 }}>
              <div className="lbl">주식도AI 한마디</div>
              <div className="txt">로그인 기능을 준비 중이에요. 곧 로그인하면 내 보유 주식이 여기에 떠요!</div>
            </div>
          )}
        </>
      )}

      {/* 로그인 후: 보유 주식 목록(현재는 입력 기능 준비 중) */}
      {loggedIn && (
        <div className="sa-holdings">
          {holdings.length ? (
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
              <div className="ico">✅</div>
              <div className="t">로그인 완료! 보유 주식을 직접 입력하는 기능을<br />곧 여기에 추가할게요. (다음 단계)</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
