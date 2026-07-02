import React, { useState, useRef } from "react";
import { extractHoldings, won } from "../api.js";
import { upsertHolding, resolveStock } from "../holdings.js";

// 이미지 → Canvas 압축 → base64 (최대 1280px, JPEG 0.8)
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1280;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.8
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

// props:
//   existingNames: 현재 잔고 종목명 배열 (중복 표시용)
//   onDone: 저장 완료 후 콜백
//   onCancel: 취소 콜백
export default function ImportCapture({ existingNames = [], onDone, onCancel }) {
  const [step, setStep] = useState("upload"); // upload | loading | review
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  async function handleFile(file) {
    if (!file || !file.type.startsWith("image/")) {
      setErr("이미지 파일만 올려주세요.");
      return;
    }
    setErr("");
    setStep("loading");
    try {
      const b64 = await compressImage(file);
      const result = await extractHoldings(b64);
      const extracted = result.holdings || [];
      if (!extracted.length) {
        setErr("종목을 찾지 못했어요. 더 선명한 캡처를 올려주세요.");
        setStep("upload");
        return;
      }
      setRows(
        extracted.map((h) => ({
          name: h.name || "",
          quantity: h.quantity != null ? String(h.quantity) : "",
          avg_price: h.avg_price != null ? String(h.avg_price) : "",
        }))
      );
      setStep("review");
    } catch {
      setErr("처리 중 오류가 생겼어요. 다시 시도해주세요.");
      setStep("upload");
    }
  }

  function onDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function updateRow(i, key, val) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));
  }

  function removeRow(i) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setErr("");
    for (const r of rows) {
      if (!r.name.trim()) return setErr("종목명이 비어 있는 항목이 있어요.");
      if (!r.quantity || Number(r.quantity) <= 0) return setErr(`'${r.name}'의 수량을 입력해주세요.`);
      if (r.avg_price === "" || r.avg_price === null) return setErr(`'${r.name}'의 평균단가를 입력해주세요.`);
    }
    setSaving(true);
    const resolved = [];
    for (const r of rows) {
      const s = await resolveStock(r.name.trim());
      if (s.error) {
        setSaving(false);
        return setErr(`'${r.name}' 종목을 찾지 못했어요. 종목명을 정확히 수정해주세요.`);
      }
      resolved.push({ code: s.code, name: s.name, qty: Number(r.quantity), avg: Number(r.avg_price) });
    }
    for (const item of resolved) {
      const r = await upsertHolding(item);
      if (r.error) {
        setSaving(false);
        return setErr(`'${item.name}' 저장에 실패했어요: ${r.error}`);
      }
    }
    setSaving(false);
    onDone();
  }

  return (
    <div className="sa-import-capture">
      {step === "upload" && (
        <>
          <div className="sa-disc" style={{ marginBottom: 10 }}>
            다크모드나 흐릿한 화면은 인식하지 못해요. PC나 모바일에서 직접 캡처한 이미지를 활용해주세요. (카메라 사진 촬영 지양)
          </div>
          <div
            className="sa-capture-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
            <div>클릭하거나 이미지를 드래그해주세요</div>
            <div style={{ fontSize: 12, marginTop: 4, color: "var(--muted)" }}>PNG · JPG · 스크린샷 모두 가능</div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {err && <div className="sa-err" style={{ marginTop: 8 }}>⚠️ {err}</div>}
          <button className="sa-btn sa-btn-sm sa-btn-gray" style={{ marginTop: 10 }} onClick={onCancel}>
            취소
          </button>
        </>
      )}

      {step === "loading" && (
        <div className="sa-analysis-loading">
          <div className="sa-spin" />
          <span>이미지에서 종목 읽는 중…</span>
        </div>
      )}

      {step === "review" && (
        <>
          <div style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 10 }}>
            <b>{rows.length}개</b> 종목을 찾았어요. 내용 확인 후 추가해주세요.
          </div>

          <div className="sa-import-table">
            <div className="sa-import-head">
              <span>종목명</span>
              <span>수량</span>
              <span>평균단가(원)</span>
              <span />
            </div>
            {rows.map((r, i) => {
              const isDup = existingNames.includes(r.name);
              const noQty = r.quantity === "" || r.quantity === null;
              const noPrice = r.avg_price === "" || r.avg_price === null;
              return (
                <div key={i} className="sa-import-row">
                  <div style={{ position: "relative" }}>
                    <input
                      className={"sa-input" + (isDup ? " sa-input-warn" : "")}
                      value={r.name}
                      onChange={(e) => updateRow(i, "name", e.target.value)}
                      placeholder="종목명"
                    />
                    {isDup && (
                      <span className="sa-import-dup-badge">덮어쓰기</span>
                    )}
                  </div>
                  <input
                    className={"sa-input" + (noQty ? " sa-input-err" : "")}
                    type="number"
                    inputMode="numeric"
                    value={r.quantity}
                    onChange={(e) => updateRow(i, "quantity", e.target.value)}
                    placeholder="수량"
                  />
                  <input
                    className={"sa-input" + (noPrice ? " sa-input-err" : "")}
                    type="number"
                    inputMode="numeric"
                    value={r.avg_price}
                    onChange={(e) => updateRow(i, "avg_price", e.target.value)}
                    placeholder="평균단가"
                  />
                  <button className="sa-holding-x" title="이 항목 제외" onClick={() => removeRow(i)}>
                    ✕
                  </button>
                </div>
              );
            })}
          </div>

          {err && <div className="sa-err" style={{ marginTop: 8 }}>⚠️ {err}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="sa-btn sa-btn-sm sa-btn-gray" onClick={onCancel}>
              취소
            </button>
            <button
              className="sa-btn"
              style={{ flex: 1, padding: "11px", opacity: saving ? 0.6 : 1 }}
              disabled={saving || !rows.length}
              onClick={save}
            >
              {saving ? "등록 중…" : `${rows.length}개 잔고에 추가`}
            </button>
          </div>
          <div className="sa-disc" style={{ marginTop: 10 }}>
            이미 잔고에 있는 종목은 이 값으로 덮어써요.
          </div>
        </>
      )}
    </div>
  );
}
