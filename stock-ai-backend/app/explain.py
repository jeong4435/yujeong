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

# 무료 티어에서 시도할 모델(우선순위순). 앞에서부터 되는 걸 자동 선택.
# ※ 모델이 또 바뀌어도 이 리스트만 손보면 됨. (1.5 시리즈는 2025년 은퇴)
MODEL_CANDIDATES = [
    "gemini-2.5-flash",        # 현재 무료 주력(품질·속도 균형)
    "gemini-flash-latest",     # 별칭(구글이 가리키는 최신 flash)
    "gemini-2.5-flash-lite",   # 더 가볍고 할당량 여유
    "gemini-2.0-flash",        # 최후 폴백
]

# 한 번 성공한 모델명을 기억해 매 요청마다 재탐색하지 않음.
_working_model = None


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
    analyst = data.get("analyst", {}) or {}

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

    # 증권가 컨센서스(목표주가·투자의견)
    cons = analyst.get("consensus") or {}
    cons_text = "없음"
    if cons.get("target_price") or cons.get("recomm_mean"):
        parts = []
        if cons.get("target_price"):
            up = ""
            try:
                cur = float(str(price).replace(",", ""))
                if cur > 0:
                    pct = (cons["target_price"] - cur) / cur * 100
                    up = f" (현재가 대비 {pct:+.1f}%)"
            except Exception:
                pass
            parts.append(f"목표주가 평균 {cons['target_price']:,}원{up}")
        if cons.get("recomm_mean"):
            parts.append(f"투자의견 평균 {cons['recomm_mean']}/5.0 ({cons.get('recomm_label','')})")
        cons_text = " · ".join(parts)

    # 최근 증권사 리포트(제목·증권사·날짜)
    reports = analyst.get("reports") or []
    reports_text = "없음"
    if reports:
        reports_text = "\n".join(
            f"  [{r.get('date','')}] {r.get('broker','')}: {r.get('title','')}" for r in reports[:5]
        )

    # 동종업계 종목(같은 업종 비교용)
    peers = analyst.get("peers") or []
    peers_text = "없음"
    if peers:
        peers_text = ", ".join(
            f"{p.get('name','')}({p.get('change_pct'):+.1f}%)" if p.get("change_pct") is not None
            else str(p.get("name", "")) for p in peers[:5]
        )

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

[증권가 컨센서스]
{cons_text}

[최근 증권사 리포트]
{reports_text}

[동종업계 종목(같은 업종, 오늘 등락)]
{peers_text}

---
위 데이터를 토대로 아래 5개 항목을 각각 분석해주세요.
각 항목은 3~5문장으로, 핵심만 짚어주세요.

1. 밸류에이션 분석
PER·PBR 수준과 현재 주가가 비싼지 싼지를 데이터 근거로. 동종업계 종목이 제시됐다면 같은 업종 맥락에서 비교.

2. 펀더멘털 분석
3개년 매출·영업이익·순이익 흐름이 의미하는 것. 성장성·수익성 관점의 해석.

3. 최근 이슈 해석
공시와 뉴스가 이 회사에 어떤 의미인지. 긍정·부정 요인 균형 있게.

4. 증권가 시각
제시된 목표주가·투자의견과 최근 증권사 리포트들의 제목을 근거로, 증권가(애널리스트)가 이 종목을 어떻게 보고 있는지 쉽게 풀어서 요약.
목표주가가 있으면 현재가 대비 어느 정도 기대인지 언급. 단, 목표주가·투자의견은 '애널리스트들의 추정·의견'일 뿐 보장이 아님을 분명히 할 것.
컨센서스나 리포트 데이터가 '없음'이면 이 항목은 "공개된 증권사 컨센서스 정보가 충분하지 않아요." 한 문장으로만.

5. 종합 시각
위 분석을 종합한 현재 이 종목의 상황 요약.
긍정적 신호와 주의할 리스크를 모두 짚고, 투자 판단은 독자가 할 수 있도록 근거만 제시.

작성 규칙:
- 전문용어는 처음 등장 시 괄호로 짧게 풀이
- 데이터에 없는 내용은 추측하거나 지어내지 말 것(특히 목표주가·수치를 임의 생성 금지)
- '지금 사세요/파세요' 같은 직접적 매수·매도 권유 금지. 증권가 목표주가를 인용하되 그것을 '우리의 권유'로 표현하지 말 것
- 항목 구분은 "▌밸류에이션 분석", "▌펀더멘털 분석", "▌최근 이슈", "▌증권가 시각", "▌종합 시각" 형식 사용
- 한국어로 작성"""


def _generate(prompt: str):
    """프롬프트 → Gemini 텍스트. 키 없으면 None, 모델은 자동 폴백."""
    global _working_model
    key = os.environ.get("GEMINI_API_KEY")
    if not key or genai is None:
        return None
    try:
        genai.configure(api_key=key)
    except Exception:
        return None
    # 이미 되는 모델을 알면 그것부터, 모르면 후보 순서대로 시도.
    order = ([_working_model] if _working_model else []) + \
            [m for m in MODEL_CANDIDATES if m != _working_model]
    for name in order:
        try:
            response = genai.GenerativeModel(name).generate_content(prompt)
            text = response.text
            if text:
                _working_model = name   # 성공한 모델 기억
                return text
        except Exception:
            continue   # 이 모델 실패 → 다음 후보로
    return None


def explain(data: dict):
    """개별 종목 종합 분석(5섹션)."""
    return _generate(_build_prompt(data))


def _build_market_prompt(indices: dict, trending: dict) -> str:
    idx_list = (indices or {}).get("indices", []) or []
    idx_text = "없음"
    if idx_list:
        rows = []
        for x in idx_list:
            cp = x.get("change_pct")
            sign = "" if cp is None else (f"{cp:+.2f}%")
            rows.append(f"  {x.get('name','')}: {x.get('price','')} ({sign})")
        idx_text = "\n".join(rows)

    # 오늘의 거래대금 상위/급등/급락 종목 → 섹터 추론 재료
    groups = (trending or {}).get("groups", []) or []
    def names(label_kw):
        for g in groups:
            if label_kw in g.get("label", ""):
                return ", ".join(
                    f"{s.get('name','')}({s.get('change_pct'):+.1f}%)" if s.get("change_pct") is not None
                    else str(s.get("name", "")) for s in (g.get("stocks") or [])[:5]
                ) or "없음"
        return "없음"
    vol_text = names("거래대금")
    up_text = names("급등")
    down_text = names("급락")

    return f"""당신은 한국 주식시장 전문 애널리스트입니다.
아래는 오늘 시장의 실제 데이터입니다. 수치는 절대 바꾸지 마세요.

[주요 지수]
{idx_text}

[오늘 거래대금 상위]
{vol_text}

[오늘 급등 종목]
{up_text}

[오늘 급락 종목]
{down_text}

---
아래 2개 항목을 분석해주세요. 각 항목은 4~6문장, 고등학생도 이해되게.

1. 시황
국내(코스피·코스닥)와 미국(나스닥·다우) 지수의 방향을 종합해 오늘 시장 분위기를 설명.
국내외 흐름이 같은지 다른지, 위험을 선호하는(공격적) 분위기인지 회피하는(보수적) 분위기인지 쉽게 풀어줘.

2. 섹터
급등·급락·거래대금 상위 종목들이 어떤 업종(섹터·테마)에 속하는지 보고, 오늘 어떤 분야에 돈이 몰리고 빠졌는지 정리.
(예: 반도체·2차전지·바이오·자동차·금융 등. 종목명으로 업종을 추론하되, 모르면 단정하지 말 것)

작성 규칙:
- 전문용어는 처음 등장 시 괄호로 짧게 풀이
- 데이터에 없는 수치를 지어내지 말 것
- '지금 사세요/파세요' 같은 매수·매도 권유 금지
- 항목 구분은 "▌시황", "▌섹터" 형식 사용
- 한국어로 작성"""


def market_overview(indices: dict, trending: dict):
    """오늘의 시장 — 시황·섹터 AI 분석(2섹션). 키 없으면 None."""
    return _generate(_build_market_prompt(indices, trending))
