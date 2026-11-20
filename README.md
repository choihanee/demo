# 데모 (Demo)
대학생이 만든 설문을 AI 가상 응답자가 먼저 응답해 보는 사전 점검 도구. 팀: 친구 구해와

## 폴더와 담당 (자기 폴더만 수정)
| 폴더 | 담당 | 내용 |
|---|---|---|
| /client | 박민서, 최하늬 | React 화면 |
| /server | 범다온 | Express 서버, 폼 파싱·제출 |
| /engine | 김가빈 | 응답 생성 엔진 |
| /ai | 장수민 | 프롬프트①②, JSON 검증, 폴백 |
| /data | 전원 | 공유 샘플 (형식 기준) |

## 실행
```
# 1) 서버 (터미널 1)
cd server
npm install
npm run dev          # http://localhost:3001

# 2) 화면 (터미널 2)
cd client
npm install
npm run dev          # http://localhost:5173

# 엔진만 테스트
cd engine
node test.js
```

## 데이터 흐름
```
링크 → [server] 폼 파싱(questions.json)
     → [ai] 프롬프트① : 질문 + condition → types
     → [engine] plan  : 응답자 배정, 객관식·분기 응답, 서술형 요청 목록(textRequests)
     → [ai] 프롬프트② : textRequests → 서술형 answers
     → [engine] fillText : 서술형 끼워 넣기, 결측·불성실, is_synthetic
     → [server] formResponse 제출
```

## API (server)
| API | 입력 | 출력 |
|---|---|---|
| POST /api/form/read | { formUrl } | questions.json 형식 |
| POST /api/generate | { form, condition } | { meta, rows, stats, types } |
| POST /api/form/submit | { form, rows } | { submitted, failed } |

## 공유 샘플 (/data)
- questions.json : 다온 형식 질문 + condition (인수인계서 기준)
- types.json : 프롬프트① 출력
- text_answers.json : 프롬프트② 출력
- responses.json : 엔진 출력 (node engine/test.js 로 다시 만들 수 있음)
