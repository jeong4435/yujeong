"""Gemini 기반 종목 분석 레이어.
GEMINI_API_KEY 가 환경변수에 있을 때만 작동. 없으면 None 반환.
중요: 숫자는 DART/KRX/네이버의 진짜 값. Gemini는 해석·분석만 담당.
"""
import os
import json

try:
    import google.generativeai as genai
except Exception:
    genai = None

MODEL = "gemini-1.5-flash-latest"


def _build_prompt(data: dict) -> str:
    name = data.get("name", "")
    code = data.get("code", "")
    price = data.get("price", "")
    change_pct = data.get("change_pct", "")
    as_of = data.get("as_of", "")
    fu = data.get("fundamentals", {}) or {}
    fin = data.get("financials", {}) or {}
    trend = fin.get("trend", {}) if fin else {}
    disclosures = data.get("disclosures", []) or []
    news_list = data.get("news", []) or []

    # 재무 추세
    trend_text = "(재무 데이터 없음)"
    if trend.get("years"):
        years = trend["years"]
        rev = trend.get("revenue", [])
        op = trend.get("operating_profit", [])
        ni = trend.get("net_income", [])
        dir_map = {"up": "꾸준히 증가", "down": "꾸준히 감소",
                   "mixed_up": "등락 있으나 증가세", "mixed_down": "등락 있으나 감소세", "mixed": "보합"}
        trend_text = (
            f"기간: {', '.join(str(y) for y in years)}\n"
            f"  매출액:    {' → '.join(str(v) for v in rev)} ({dir_map.get(trend.get('revenue_dir',''), '')})\n"
            f"  영업이익:  {' → '.join(str(v) for v in op)} ({dir_map.get(trend.get('operating_profit_dir',''), '')})\n"
            f"  당기순이익:{' → '.join(str(v) for v in ni)} ({dir_map.get(trend.get('net_income_dir',''), '')})"
        )

    # 공시
    disc_text = "없음"
    if disclosures:
        disc_text = "\n".join(f"  [{d.get('date','')}] {d.get('title','')}" for d in disclosures[:3])

    # 뉴스
    news_text = "없음"
    if news_list:
        news_text = "\n".join(f"  - {n.get('title','')}" for n in news_list[:5])

    return f"""당신은 한국 주식시장 전문 애널리스트입니다.
아래는 {name}({code})의 실제 검증된 데이터입니다. 수치는 절대 변경하지 마세요.

[현재가]
{price}원 ({as_of} 종가) / 전일 대비 {change_pct}%

[밸류에이션]
PER: {fu.get('per', '확인불가')}배 | PBR: {fu.get('pbr', '확인불가')}배
EPS: {fu.get('eps', '확인불가')}원 | 예상PER: {fu.get('forward_per', '확인불가')}배

[3개년 재무 추세 — 단위 억원]
{trend_text}

[최근 공시]
{disc_text}

[최근 뉴스]
{news_text}

---
위 데이터를 토대로 아래 4개 항목을 각각 분석해주세요.
각 항목은 3~5문장으로, 핵심만 짚어주세요.

1. 밸류에이션 분석
PER·PBR이 업종·시장 평균 대비 어느 수준인지, 현재 주가가 비싼지 싼지 데이터 근거로.

2. 펀더멘털 분석
3개년 매출·영업이익·순이익 흐름이 의미하는 것. 성장성·수익성 관점의 해석.

3. 최근 이슈 해석
공시와 뉴스가 이 회사에 어떤 의미인지. 긍정·부정 요인 균형 있게.

4. 종합 시각
위 분석을 종합한 현재 이 종목의 상황 요약.
긍정적 신호와 주의할 리스크를 모두 짚고, 투자 판단은 독자가 할 수 있도록 근거만 제시.

작성 규칙:
- 전문용어는 처음 등장 시 괄호로 짧게 풀이
- 데이터에 없는 내용은 추측하거나 지어내지 말 것
- '지금 사세요/파세요' 같은 직접적 매수·매도 권유 금지
- 항목 구분은 "▌밸류에이션 분석", "▌펀더멘털 분석", "▌최근 이슈", "▌종합 시각" 형식 사용
- 한국어로 작성"""


def explain(data: dict):
    key = os.environ.get("GEMINI_API_KEY")
    if not key or genai is None:
        return None
    try:
        genai.configure(api_key=key)
        model = genai.GenerativeModel(MODEL)
        response = model.generate_content(_build_prompt(data))
        return response.text
    except Exception as e:
        return f"[DEBUG] {type(e).__name__}: {str(e)[:300]}"
