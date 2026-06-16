#!/usr/bin/env bash
# 주식도 AI — 백엔드 실행 (macOS/Linux)
cd "$(dirname "$0")"
echo "─────────────────────────────────"
echo "  주식도 AI 백엔드 시작"
echo "─────────────────────────────────"

if ! command -v python3 >/dev/null; then
  echo "[오류] python3가 없어요. 설치 후 다시 실행하세요."; exit 1
fi

if [ ! -d .venv ]; then
  echo "처음 실행이네요. 가상환경 만들고 라이브러리 설치할게요 (몇 분 걸려요)..."
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
else
  source .venv/bin/activate
fi

echo
echo "✅ 서버 켜는 중... 브라우저에서  http://localhost:8000  을 여세요."
echo "   (이 터미널은 끄지 마세요. 끄면 서버가 꺼져요)"
echo
python -m uvicorn app.main:app --reload
