import React from "react";

// 공용 확인 팝업(모달). 리셋처럼 되돌리기 어려운 동작 전에 한 번 더 확인받는다.
// open=false면 아무것도 안 그림. 배경(딤) 클릭=취소, 처리 중(busy)엔 닫기 잠금.
export default function ConfirmModal({
  open, title, body, confirmLabel = "확인", cancelLabel = "취소",
  onConfirm, onCancel, busy,
}) {
  if (!open) return null;
  return (
    <div className="sa-modal-bg" onClick={busy ? undefined : onCancel}>
      <div className="sa-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sa-modal-title">{title}</div>
        <div className="sa-modal-body">{body}</div>
        <div className="sa-modal-actions">
          <button className="sa-btn sa-btn-sm sa-btn-ghost" onClick={onCancel} disabled={busy}>{cancelLabel}</button>
          <button className="sa-btn sa-btn-sm" onClick={onConfirm} disabled={busy}>
            {busy ? "처리 중…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
