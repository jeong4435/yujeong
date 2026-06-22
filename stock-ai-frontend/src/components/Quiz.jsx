import React, { useState, useEffect } from "react";
import { QUIZ, getType, computeScore } from "../quizData.js";

// savedScore: 저장된 점수(0~100) 또는 null. 있으면 바로 결과 화면을 보여줌.
// onSave(score): 완료 시 저장. onClear(): '다시 진단하기' 시 저장 결과 삭제.
export default function Quiz({ savedScore, onSave, onClear }) {
  const [answers, setAnswers] = useState(Array(QUIZ.length).fill(null));
  const [resultScore, setResultScore] = useState(savedScore ?? null);

  // 로그인 세션이 늦게 도착해 savedScore가 나중에 들어오는 경우에도 결과를 반영
  useEffect(() => {
    if (savedScore != null) setResultScore(savedScore);
  }, [savedScore]);

  const allAnswered = answers.every((a) => a !== null);

  function pick(qi, val) {
    const next = [...answers];
    next[qi] = val;
    setAnswers(next);
  }
  function finish() {
    const s = computeScore(answers);   // 가중평균 0~100
    setResultScore(s);
    onSave && onSave(s);               // localStorage + (로그인 시) 계정 저장
  }
  function reset() {
    setAnswers(Array(QUIZ.length).fill(null));
    setResultScore(null);
    onClear && onClear();              // 저장된 결과 삭제 → 다음 새로고침에도 문항부터
  }

  if (resultScore != null) {
    const result = getType(resultScore);
    const pct = Math.max(0, Math.min(100, resultScore));
    return (
      <div>
        <div className="sa-card">
          <div className="sa-result-h">
            <div className="sa-result-emoji">{result.emoji}</div>
            <div className="sa-result-name">나는 <span className="accent">{result.name}</span></div>
            <div className="sa-result-desc">{result.desc}</div>
          </div>
          <div className="sa-meter"><div style={{ width: Math.max(8, pct) + "%" }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: -14 }}>
            <span>🛡️ 안정</span><span>균형</span><span>공격 🔥</span>
          </div>
        </div>

        <div className="sa-card">
          <h3><span className="sa-chip">맞춤 가이드</span> 나에게 맞는 매도 원칙</h3>
          {result.guide.map((g, i) => (
            <div className="sa-guide" key={i}>
              <div className="ico">{g[0]}</div>
              <div>
                <div className="gt">{g[1]}</div>
                <div className="gd">{g[2]}</div>
              </div>
            </div>
          ))}
          <div className="sa-note" style={{ marginTop: 16 }}>
            <div className="lbl">주식도AI 한마디</div>
            <div className="txt">위 숫자(%)는 정답이 아니라 '예시'예요. 진짜 중요한 건, 사기 전에 내 손절·익절 선을 미리 정해두고 지키는 습관이에요!</div>
          </div>
        </div>

        <button className="sa-btn" style={{ width: "100%", padding: "15px" }} onClick={reset}>다시 진단하기</button>

        <div className="sa-disc">
          <b>참고용 안내.</b> 이 진단은 투자 성향을 스스로 돌아보게 돕는 교육용 자료예요.
          제시된 손절·익절 비율은 일반적인 예시일 뿐 정답이 아니며, 개인 상황에 따라 달라요.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="sa-card">
        <div className="sa-hero" style={{ fontSize: 22 }}>나는 어떤 <span className="hl">투자자</span>일까?</div>
        <div className="sa-herosub">{QUIZ.length}개 질문에 답하면 내 투자 유형을 분석해줘요.</div>
      </div>

      {QUIZ.map((item, qi) => (
        <div className="sa-card" key={qi}>
          <div className="sa-q">
            <div className="qn">Q{qi + 1} / {QUIZ.length}</div>
            <div className="qt">{item.q}</div>
            {item.opts.map(([label, val], oi) => (
              <button key={oi}
                className={"sa-opt" + (answers[qi] === val ? " sel" : "")}
                onClick={() => pick(qi, val)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button className="sa-btn" style={{ width: "100%", padding: "16px", opacity: allAnswered ? 1 : .5 }}
        disabled={!allAnswered} onClick={finish}>
        {allAnswered ? "내 유형 결과 보기 →" : "모든 질문에 답해주세요"}
      </button>
    </div>
  );
}
