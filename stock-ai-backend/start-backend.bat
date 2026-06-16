@echo off
chcp 65001 >nul
title 주식도 AI - 백엔드
echo ─────────────────────────────────
echo   주식도 AI 백엔드 시작
echo ─────────────────────────────────
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo [오류] Python이 설치되어 있지 않아요. https://python.org 에서 설치 후 다시 실행하세요.
  pause & exit /b
)

if not exist .venv (
  echo 처음 실행이네요. 가상환경 만들고 라이브러리 설치할게요 ^(몇 분 걸려요^)...
  python -m venv .venv
  call .venv\Scripts\activate
  pip install -r requirements.txt
) else (
  call .venv\Scripts\activate
)

echo.
echo ✅ 서버 켜는 중... 브라우저에서  http://localhost:8000  을 여세요.
echo    (이 창은 끄지 마세요. 끄면 서버가 꺼져요)
echo.
python -m uvicorn app.main:app --reload
pause
