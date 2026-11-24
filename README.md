# BODY QUEST — 몸속 탐사대 · 에피소드 1: 심장과 혈액순환

초등 5~6학년 대상 한국어 3D 과학 탐험 웹게임입니다. 학생은 아주 작아진 탐사선을 조종해 혈관 → 심장 → 폐 → 근육을 탐험합니다. 중요한 지점마다 안내 AI "루미"에게 **자기 말로 설명해야** 다음 단계로 나아가며, 설명 수준에 따라 질문·힌트·경로·난도가 달라집니다.

## 실행 방법

```bash
npm install
npm run dev          # 웹(Vite, :5173) + API 서버(:8787) 동시 실행 → http://localhost:5173
```

배포용:

```bash
npm run build        # 타입 검사 + 정적 빌드(dist/)
npm start            # API + dist 정적 파일을 :8787 에서 함께 제공
```

테스트:

```bash
npm test             # 단위 테스트 42개 (채점·분기·복습 일정·저장·알림 발송 로직)
# 브라우저 E2E (Playwright 필요: npm i -D playwright && npx playwright install chromium)
npm run build && npm start   # 다른 터미널에서
node scripts/e2e.cjs http://localhost:8787 test-results
```

## 환경 변수 (서버 전용 — 클라이언트로 전달되지 않음)

`.env.example` 참고. 서버는 `.env`가 있으면 읽습니다(`.env`는 git에 올리지 않음).

| 변수 | 없을 때 동작 | 용도 |
|---|---|---|
| `ANTHROPIC_API_KEY` | **데모 채점(규칙 기반)** — 화면에 "데모 채점 · 실제 AI 아님" 표시 | 실제 AI 구술 평가 (Claude) |
| `BODYQUEST_AI_MODEL` | `claude-opus-5-5` | 채점 모델 변경 |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | 알림 버튼이 "서버 미설정" 안내를 보여 줌 | 복습 푸시 알림 (`npm run vapid`로 생성) |
| `PUSH_STORE_PATH` | `data/push-store.json` | 알림 구독 저장 위치 |

## 화면 구성

- **메인**: BODY QUEST 제목, 탐험 시작/이어하기, 내 탐험 기록, 오늘의 복습 미션(도착 시 자동 강조), 설정(그래픽 품질·음성 안내·채점 모드 표시)
- **탐험**: 3D 전체 화면 / 왼쪽 위 현재 미션 / 오른쪽 위 인체 지도 + 심박수 / 하단 루미 대화·갈림길·답변 / 터치 조이스틱·가속 버튼(모바일) 또는 키보드(W/S/A/D/Q/E) + 드래그로 시점 회전
- **평가**: 질문 → 마이크(음성 인식) 또는 글자 입력 → 별점 3기준·잘한 개념·오개념 확인·힌트 질문 → 재도전/실험실/추가 질문/심화 사건/진행
- **복습**: 오늘의 미션, 다음 복습까지 남은 시간, 일정, 이해도 변화 그래프, 학습한 개념

자세한 설계는 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)를 보세요.
