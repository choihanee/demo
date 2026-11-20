# 더미 UI (React + Vite)

팀 서버(`choihanee/demo` 의 `/server`)에 맞춰 만든 화면이에요.

## 실행
```bash
# 1) 서버 (팀 레포 /server) — http://localhost:3001
cd server && npm install && npm run dev   # .env 에 GEMINI_API_KEY 필요

# 2) 이 화면
npm install
npm run dev
```
서버 주소를 바꾸려면 `.env` 에 `VITE_API_BASE_URL=http://localhost:3001` 처럼 적어요.

## 화면 흐름과 API
| 화면 | 호출 |
|---|---|
| 구글폼 연결 → "다음" | `POST /api/form/read` { formUrl } |
| 응답 조건 → "설문 돌려보기" | `POST /api/generate` { form, condition: { total, attributes } } |
| 로딩 | 응답이 올 때까지 (취소·재시도 가능) |
| 리포트 | 응답 `{ meta, rows, stats, types }` 로 표시 · CSV 다운로드 |
| 리포트 → "제출하기" | `POST /api/form/submit` { form, rows } |

- 응답자 조건: 조건 이름·항목은 자유 텍스트, 항목별 비율은 합 100. 조건은 없어도 돼요.
- 가상 응답 인원: 1~200명 (서버 엔진 범위와 같아요)
- 호출 코드는 `src/api.js` 한 곳에 있어요.

## 참고
- 팀 서버는 "수정 제안(선택지 누락 등)"을 아직 주지 않아서 리포트에는 응답자 유형·분포·미리보기를 보여줘요.
- 이미지: `public/assets/` · 글꼴: 주아(Google Fonts) · 색상: `src/styles.css`의 `:root`
- 움직임: `src/styles.css` 맨 아래 (시스템에서 "동작 줄이기"를 켜면 꺼져요)
