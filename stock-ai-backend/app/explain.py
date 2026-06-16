"""(선택) 진짜 숫자를 받아 '고등학생 눈높이'로 풀어주는 설명 레이어.
ANTHROPIC_API_KEY 가 .env 에 있을 때만 작동합니다. 없으면 None 을 돌려줍니다.
중요: 숫자 자체는 DART/시세 API에서 온 '진짜 값'이고, Claude는 해석/설명만 합니다.
"""
import os
import json

try:
    import anthropic
except Exception:
    anthropic = None

# 필요 시 최신 모델 문자열로 교체하세요.
MODEL = "claude-sonnet-4-6"


def explain(data: dict):
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key or anthropic is None:
        return None
    try:
        client = anthropic.Anthropic(api_key=key)
        prompt = (
            "다음은 한 종목의 '진짜' 데이터야(이미 검증된 숫자이니 절대 바꾸지 마).\n"
            f"{json.dumps(data, ensure_ascii=False)}\n\n"
            "이 숫자들을 고등학생도 이해되게 한국어로 풀어줘.\n"
            "- PER이 높은 편인지 낮은 편인지, 영업이익 흐름, 최근 공시의 의미를 각각 2~3문장.\n"
            "- 전문용어는 처음 나올 때 괄호로 짧게 풀이.\n"
            "- '지금 사라/팔아라' 같은 단정적 매수·매도 권유는 금지. 균형 있게."
        )
        msg = client.messages.create(
            model=MODEL,
            max_tokens=1200,
            messages=[{"role": "user", "content": prompt}],
        )
        return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text")
    except Exception as e:
        return f"(설명 생성 실패: {e})"
