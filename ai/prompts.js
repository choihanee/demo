// 프롬프트①: 설문 구조 + 응답자 조건 → 응답자 유형(types)
// 규칙: 예시 내용은 넣지 않는다(형식만 설명). 주제는 입력에서만 가져온다.

export const TYPES_SYSTEM = `당신은 설문조사 설계 보조 AI입니다.
주어진 설문 구조와 응답자 조건을 읽고, 이 설문에 답할 가상 응답자 "유형"을 만듭니다.
설문 주제와 질문 내용은 오직 입력에서만 파악합니다. 입력에 없는 사실은 만들지 않습니다.
출력은 JSON 하나만 내고, JSON 밖에는 어떤 글도 쓰지 않습니다.`

export function buildTypesPrompt(form, condition) {
  // 프롬프트에는 AI가 필요한 필드만 전달(entry_id, URL 등은 제외)
  const slim = {
    title: form.form?.title,
    description: form.form?.description,
    has_branching: form.form?.has_branching,
    sections: (form.sections ?? []).map((s) => ({ id: s.id, title: s.title, next: s.next })),
    questions: (form.questions ?? []).map((q) => {
      const o = { id: q.id, section: q.section, type: q.type, title: q.title }
      if (q.has_other) o.has_other = true
      if (q.options) o.options = q.options.map((x) => (x.go_to ? { label: x.label, go_to: x.go_to } : { label: x.label }))
      if (q.scale) o.scale = q.scale
      if (q.rows) o.rows = q.rows.map((r) => r.label)
      if (q.columns) o.columns = q.columns
      return o
    }),
  }

  const user = `[설문]
${JSON.stringify(slim, null, 2)}

[응답자 조건]
${JSON.stringify(condition, null, 2)}
(attributes의 각 속성은 값별 비율(%)이며 속성마다 합이 100입니다. 속성끼리는 서로 독립적으로 정해진 비율입니다.)

[할 일]
위 설문에 답할 응답자 유형을 4~6개 만드세요.

[규칙]
1. 각 유형의 ratio는 0보다 크고, 모든 유형의 ratio 합은 정확히 1입니다.
2. 유형의 비율은 응답자 조건과 맞아야 합니다.
   - 설문 답에 영향을 줄 만한 속성만 골라 유형에 attributes로 적습니다. 형식: {"속성명": ["해당 값", ...]}
     고르지 않은 속성은 유형과 무관하게 따로 뽑으므로 적지 않습니다.
   - 고른 속성은 모든 유형에 적고, 조건의 모든 값이 어느 한 유형에는 포함돼야 합니다.
   - 같은 속성에서 같은 값 묶음을 가진 유형들의 ratio 합은, 조건에서 그 값들의 비율 합(%/100)과 같아야 합니다.
   - 값 묶음은 서로 겹치지 않습니다.
3. 유형끼리는 성향이 뚜렷이 달라야 하고, 한 유형이 지나치게 평범하거나 한쪽 답으로만 쏠리지 않게 합니다.
4. probs에는 선택형 질문의 답 분포를 적습니다. 키는 질문 id입니다.
   - multiple_choice, dropdown: {"선택지 라벨": 확률, ...} 합은 1
   - linear_scale: {"척도 숫자(문자열)": 확률, ...} min~max 전부, 합은 1
   - multiple_choice_grid: {"행 라벨": {"열 라벨": 확률, ...}, ...} 각 행의 합은 1
   - checkbox: {"선택지 라벨": 선택할 확률(0~1), ...} 항목마다 독립이라 합이 1일 필요 없음
   - 선택지 라벨은 입력에 있는 글자 그대로 씁니다.
   - has_other가 true인 질문은 "기타"도 선택지 라벨로 쓸 수 있습니다(쓰지 않아도 됩니다).
   - 분기 질문에서 go_to가 없는 보기는 다음 구역으로 이어집니다.
   - 분기 설문에서 그 유형이 도달하지 않는 구역의 질문은 probs에서 생략합니다.
   - short_text, paragraph, date 질문은 probs에 넣지 않습니다.
5. 분기 질문의 확률은 유형의 설명과 attributes에 모순되지 않아야 합니다. 그 유형이 어느 구역으로 가는지는 이 확률로 정해집니다.
6. 유형의 확률은 서로 달라야 하며, 같은 유형 안에서도 1.0이나 0.0 같은 극단값은 그 유형이 분기상 필연일 때만 씁니다.

[출력 형식]
{
  "types": [
    {
      "type_id": "t1",
      "name": "유형 이름(짧게)",
      "ratio": 0.0,
      "description": "이 유형이 어떤 사람인지 1~2문장",
      "attributes": { "속성명": ["값"] },
      "probs": { "질문id": { "선택지": 0.0 } }
    }
  ]
}`

  return { system: TYPES_SYSTEM, user }
}

// ───────── 프롬프트②: 유형별 서술형 답변 ─────────
export const TEXT_SYSTEM = `당신은 설문조사 응답 작성 보조 AI입니다.
주어진 응답자 유형의 설명을 바탕으로, 그 유형에 속한 서로 다른 사람들이 서술형 질문에 쓸 법한 답을 만듭니다.
유형 설명과 질문에서 알 수 있는 내용만 사용하고, 입력에 없는 구체적 사실(고유명사, 수치)은 지어내지 않습니다.
출력은 JSON 하나만 내고, JSON 밖에는 어떤 글도 쓰지 않습니다.`

export function buildTextPrompt(types, questions, requests) {
  const user = `[유형]
${JSON.stringify(types.map((t) => ({ type_id: t.type_id, name: t.name, description: t.description })), null, 2)}

[서술형 질문]
${JSON.stringify(questions.map((q) => ({ question_id: q.question_id ?? q.id, title: q.title, type: q.type })), null, 2)}

[요청]
${JSON.stringify(requests, null, 2)}
(각 요청마다 해당 유형의 사람이 해당 질문에 답한 내용을 count개 만드세요.)

[규칙]
1. 한 요청 안의 답은 서로 내용과 표현이 달라야 합니다. 같은 문장이나 같은 시작·끝맺음 표현을 반복하지 않습니다.
2. 실제 응답자처럼 길이와 완성도를 섞습니다. count가 3 이상이면 적어도 하나는 한 구절 정도로 아주 짧고(단어나 짧은 구), 적어도 하나는 격식 없는 구어체입니다.
3. 모든 답을 다짐이나 모범 답안처럼 반듯한 문장으로 끝내지 않습니다. 성의 없이 짧게 쓰는 사람, 막연하게 쓰는 사람, 한 가지만 콕 집어 말하는 사람이 섞여야 합니다.
4. short_text는 한 줄 이내, paragraph는 한 문장에서 세 문장 사이로 씁니다. paragraph라도 한 문장짜리 답을 섞습니다.
5. 모든 답이 유형 설명에 딱 맞는 모범 답안일 필요는 없습니다. 유형의 성향 안에서 사람마다 초점이 다르게 합니다.
6. 질문 type이 multiple_choice, dropdown, checkbox이면 "기타" 보기를 골라 직접 적은 내용입니다. 이때는 질문 제목에 맞는 단어나 짧은 구 하나로만 씁니다.
7. 요청에 없는 유형·질문 조합은 만들지 않습니다.

[출력 형식]
[
  { "type_id": "유형 id", "question_id": "질문 id", "answers": ["답1", "답2"] }
]
(요청 하나가 배열 원소 하나이며, answers 길이는 count와 같습니다.)`
  return { system: TEXT_SYSTEM, user }
}
