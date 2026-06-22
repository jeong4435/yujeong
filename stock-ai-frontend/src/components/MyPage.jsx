import React, { useState, useEffect } from "react";
import { useSession, signInWithGoogle } from "../auth.js";
import { hasSupabase } from "../supabase.js";
import { readSavedScore, readLocalScore, saveScore, clearScore } from "../investType.js";
import Holdings from "./Holdings.jsx";
import TxHistory from "./TxHistory.jsx";
import Settings from "./Settings.jsx";
import Quiz from "./Quiz.jsx";

// 마이페이지 허브: 내 잔고 / 매매 기록 / 투자 유형 / 설정.
// 투자 유형은 비로그인도 가능, 나머지는 로그인 필요(로그인 유도).
const SUBS = [
  { key: "holdings", label: "내 잔고", login: true },
  { key: "tx", label: "매매 기록", login: true },
  { key: "type", label: "투자 유형", login: false },
  { key: "settings", label: "설정", login: true },
];

export default function MyPage({ onPick }) {
  const { user, loading } = useSession();
  const [sub, setSub] = useState("holdings");
  const loggedIn = !!user;

  const active = SUBS.find((s) => s.key === sub) || SUBS[0];
  const needLogin = active.login && !loggedIn;

  // 저장된 투자유형 점수(로그인=계정 우선, 아니면 localStorage)
  const savedScore = readSavedScore(user);

  // 비로그인 때 본 결과(localStorage)를 로그인하면 계정에 한 번 동기화 → 다른 기기에서도 유지
  useEffect(() => {
    if (!user) return;
    if (user.user_metadata?.invest_score != null) return; // 이미 계정에 있음
    const local = readLocalScore();
    if (local != null) saveScore(local, user);
  }, [user]);

  return (
    <div>
      <div className="sa-subnav">
        {SUBS.map((s) => (
          <button key={s.key} className={"sa-subnav-b" + (sub === s.key ? " on" : "")} onClick={() => setSub(s.key)}>
            {s.label}
          </button>
        ))}
      </div>

      {needLogin ? (
        <div className="sa-card">
          <div className="sa-holdings-empty">
            <div className="ico">🔒</div>
            <div className="t">로그인하면 <b>{active.label}</b>을(를) 쓸 수 있어요.<br />보유종목·매매기록은 본인만 볼 수 있어요.</div>
          </div>
          <button className="sa-btn" style={{ width: "100%", padding: "14px", marginTop: 12 }}
            disabled={!hasSupabase || loading} onClick={() => signInWithGoogle()}>
            🔒 구글로 로그인하기
          </button>
        </div>
      ) : (
        <>
          {sub === "holdings" && <Holdings onPick={onPick} />}
          {sub === "tx" && <TxHistory />}
          {sub === "type" && (
            <Quiz savedScore={savedScore} onSave={(s) => saveScore(s, user)} onClear={() => clearScore(user)} />
          )}
          {sub === "settings" && <Settings user={user} />}
        </>
      )}
    </div>
  );
}
