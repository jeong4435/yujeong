#!/usr/bin/env bash
# 주식도 AI — 프론트엔드 실행 (macOS/Linux)
cd "$(dirname "$0")"
echo "─────────────────────────────────"
echo "  주식도 AI 프론트엔드 시작"
echo "─────────────────────────────────"

if ! command -v node >/dev/null; then
  echo "[오류] Node.js가 없어요. https://nodejs.org 에서 LTS 설치 후 다시 실행하세요."; exit 1
fi

if [ ! -d node_modules ]; then
  echo "처음 실행이네요. 라이브러리 설치할게요 (1~2분)..."
  npm install
fi

echo
echo "✅ 화면 켜는 중... 브라우저에서  http://localhost:5173  을 여세요."
echo "   (백엔드도 같이 켜져 있어야 데이터가 나와요)"
echo
npm run dev
