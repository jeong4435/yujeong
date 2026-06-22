import React from "react";
import { signOut, displayName, avatarUrl } from "../auth.js";

// 설정: 프로필 + 로그아웃. (데이터 삭제·공유 동의 등은 추후 추가)
export default function Settings({ user }) {
  return (
    <div className="sa-card">
      <h3><span className="sa-chip">설정</span> 내 계정</h3>

      <div className="sa-profile">
        {avatarUrl(user) ? (
          <img className="sa-avatar" src={avatarUrl(user)} alt="" referrerPolicy="no-referrer" />
        ) : (
          <div className="sa-avatar sa-avatar-fallback">{(displayName(user)[0] || "U").toUpperCase()}</div>
        )}
        <div>
          <div className="sa-profile-name">{displayName(user)}</div>
          <div className="sa-profile-mail">{user?.email}</div>
        </div>
      </div>

      <button className="sa-btn sa-btn-ghost" style={{ width: "100%", padding: "13px", marginTop: 14 }}
        onClick={() => signOut()}>
        로그아웃
      </button>

      <div className="sa-disc" style={{ marginTop: 14 }}>
        보유종목·매매기록은 본인만 볼 수 있어요. 데이터 삭제(탈퇴)·통계 공유 설정은 곧 여기에 추가할게요.
      </div>
    </div>
  );
}
