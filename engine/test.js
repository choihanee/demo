// [김가빈] 엔진 테스트: node test.js
import { readFileSync, writeFileSync } from 'node:fs'
import { planResponses, fillText, validate, generate } from './generator.js'

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf-8'))
const form = load('../data/questions.json')
const { types } = load('../data/types.json')
const textAnswers = load('../data/text_answers.json')
let failed = 0
const check = (name, errors) => {
  if (errors.length) { failed++; console.log(`❌ ${name}: ${errors.length}건\n   ${errors.slice(0, 5).join('\n   ')}`) }
  else console.log(`✅ ${name}`)
}

// 1. 정상 흐름
const plan = planResponses(form, form.condition, types, { seed: 42 })
console.log('수민님께 보낼 서술형 요청:', plan.textRequests)
const result = fillText(plan, textAnswers)
console.log(`\n${result.meta.count}명 생성 / 성실도`, result.meta.quality, '/ 서술형 출처', result.meta.text_source)
if (result.meta.warnings.length) console.log('경고:', result.meta.warnings)

// 유형별 요약
const byType = {}
for (const r of result.rows) {
  const b = (byType[r.type_name] ||= { 인원: 0, 거주: {}, q1: {} })
  b.인원++; b.거주[r.attributes.거주] = (b.거주[r.attributes.거주] || 0) + 1; b.q1[r.answers.q1] = (b.q1[r.answers.q1] || 0) + 1
}
console.table(byType)
const 거주 = result.rows.reduce((m, r) => ((m[r.attributes.거주] = (m[r.attributes.거주] || 0) + 1), m), {})
console.log('거주 전체:', 거주, '← 조건', form.condition.attributes.거주, `(${form.condition.total}명 기준)`)

check('정상 흐름 검사 (분기·필수·선택지·기타·표시)', validate(form, result))

// 2. AI 실패 (유형·서술형 없음) 에도 돌아가는지
const noAi = generate(form, form.condition, [], [], { seed: 1 })
check('AI 실패 대비 (폴백)', validate(form, noAi))

// 3. 섹션 없는 폼
const flat = { ...form, sections: [], questions: form.questions.map(({ section, ...q }) => ({ ...q, options: q.options?.map(({ go_to, ...o }) => o) })) }
check('섹션 없는 폼', validate(flat, generate(flat, { total: 30 }, types, textAnswers, { seed: 3 })))

// 4. 이상한 AI 값 (비율 합 2, 없는 선택지)
const weird = types.map((t) => ({ ...t, ratio: t.ratio * 2, probs: { ...t.probs, q3: { 없는선택지: 1 } } }))
const w = generate(form, form.condition, weird, textAnswers, { seed: 5 })
check('이상한 AI 값', validate(form, w))
console.log('   경고 예시:', w.meta.warnings.slice(0, 2))

writeFileSync(new URL('../data/responses.json', import.meta.url), JSON.stringify(result, null, 2))
console.log(`\n→ data/responses.json 저장 ${failed ? `(실패 ${failed}건)` : '(전부 통과)'}`)
process.exit(failed ? 1 : 0)
