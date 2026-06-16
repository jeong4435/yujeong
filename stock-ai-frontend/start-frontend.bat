@echo off
chcp 65001 >nul
title 주식도 AI - 프론트엔드
echo ─────────────────────────────────
echo   주식도 AI 프론트엔드 시작
echo ─────────────────────────────────
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js가 설치되어 있지 않아요. https://nodejs.org 에서 LTS 설치 후 다시 실행하세요.
  pause & exit /b
)

if not exist node_modules (
  echo 처음 실행이네요. 라이브러리 설치할게요 ^(1~2분^)...
  call npm install
)

echo.
echo ✅ 화면 켜는 중... 브라우저에서  http://localhost:5173  을 여세요.
echo    (백엔드 창도 같이 켜져 있어야 데이터가 나와요)
echo.
call npm run dev
pause
