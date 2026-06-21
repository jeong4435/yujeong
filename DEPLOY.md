# 배포 가이드 — A안(완전 무료)

구조: **프론트(Vercel) + 백엔드(Render 무료) + keep-alive 핑(cron-job.org)** · 월 ₩0

> 순서가 중요해요. **① 백엔드 먼저 배포 → 주소 확보 → ② 프론트에 그 주소 넣고 배포 → ③ 핑 설정**

---

## ① 백엔드 — Render (무료)

1. https://render.com 가입 (깃허브 계정으로 로그인 추천)
2. **New + → Blueprint** 클릭
3. 저장소 `jeong4435/yujeong` 선택 → Render가 루트의 `render.yaml`을 자동 인식
4. **Apply** → 서비스 `jusikdo-ai-backend` 생성됨
5. 생성 후 **Environment** 탭에서 비밀값 입력:
   - `DART_API_KEY` = (본인 OpenDART 인증키)
   - `GEMINI_API_KEY` = (AI 분석용. Google AI Studio aistudio.google.com 무료 발급. 없으면 AI 분석·시황·섹터 카드가 안 뜸)
6. 첫 빌드 5~10분. 완료되면 주소가 생겨요:
   **`https://jusikdo-ai-backend.onrender.com`** (이름은 다를 수 있음)
7. 확인: 브라우저로 `…onrender.com/api/health` → `{"ok":true, ...}` 나오면 성공 ✅

---

## ② 프론트 — Vercel (무료)

1. https://vercel.com 가입 (깃허브로 로그인)
2. **Add New → Project** → 저장소 `yujeong` 선택
3. 설정:
   - **Root Directory**: `stock-ai-frontend`  ← 꼭 지정
   - Framework: Vite (자동 인식)
   - Build Command: `npm run build` / Output: `dist` (자동)
4. **Environment Variables** 에 추가:
   - 이름 `VITE_API_BASE` = ①에서 받은 백엔드 주소 (예: `https://jusikdo-ai-backend.onrender.com`)
5. **Deploy** → 1~2분 후 `https://yujeong.vercel.app` 같은 주소 생성 🎉

> 백엔드 주소를 나중에 바꾸면, Vercel에서 `VITE_API_BASE` 수정 후 **Redeploy** 해야 반영돼요(빌드 시점에 박히는 값이라서).

### Cloudflare Pages로 하고 싶다면 (대안)
- Pages → Create → 저장소 연결 → Build command `npm run build`, Output `dist`, Root `stock-ai-frontend`
- 환경변수 `VITE_API_BASE` 동일하게 설정

---

## ③ keep-alive 핑 — cron-job.org (무료)

Render 무료는 15분 미사용 시 잠들어 첫 요청이 느려요(첫 조회 KRX 로딩까지 겹치면 1분+). 주기적 핑으로 깨워둡니다.

1. https://cron-job.org 가입
2. **Create cronjob**
   - URL: `https://jusikdo-ai-backend.onrender.com/api/health`
   - 실행 주기: **매 10분**
3. 저장 → 백엔드가 항상 깨어 있어 첫 조회도 빠릿 ✅

---

## 비용 / 한계 요약
- **월 ₩0** (Render 무료 750시간/월 = 24시간 가동 가능, Vercel·cron-job 무료)
- 트래픽이 늘어 콜드스타트/성능이 거슬리면 → Render를 **Starter($7/월)** 로 올리면 상시가동·콜드스타트 사라짐 (다른 변경 불필요)
- DART 키는 Render 환경변수(Secret)에만 있고 깃에는 없음 — 안전

## 업데이트하는 법
코드 고치고 `git push` 하면 Render·Vercel이 **자동으로 다시 배포**해요. (별도 작업 불필요)
