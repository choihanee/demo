// [김가빈] 엔진 혼자 테스트: node test.js
import { readFileSync, writeFileSync } from 'node:fs'
import { planResponses, fillText } from './generator.js'

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf-8'))
const form = load('../data/questions.json')
const { types } = load('../data/types.json')
const textAnswers = load('../data/text_answers.json')

const plan = planResponses(form, form.condition, types, { seed: 42 })
console.log('서술형 요청 목록 (수민님 프롬프트② 입력):', plan.textRequests)

const result = fillText(plan, textAnswers)
console.log(`\n생성 ${result.meta.count}명, 경고:`, result.meta.warnings)
console.log('첫 응답자:', JSON.stringify(result.rows[0], null, 2))
console.log('q1 통계:', result.stats.q1, '/ q5 통계:', result.stats.q5)

// 검사: 분기 위반, 필수 문항 빈칸
const errors = []
for (const r of result.rows) {
  if (r.answers.q1 === '아니오' && r.answers.q2 !== null) errors.push(`${r.respondent_id}: 비경험자인데 q2 응답`)
  if (r.answers.q1 === '예' && r.answers.q4 !== null) errors.push(`${r.respondent_id}: 경험자인데 q4 응답`)
  for (const q of form.questions) if (q.required && r.answers[q.id] === null && r.page_history.split(',').includes(String(form.sections.find((s) => s.id === q.section).page_index)))
    errors.push(`${r.respondent_id}: 필수 ${q.id} 빈칸`)
}
const quality = result.rows.reduce((m, r) => ((m[r.quality] = (m[r.quality] || 0) + 1), m), {})
console.log('성실도:', quality)
console.log(errors.length ? `❌ 오류 ${errors.length}건\n${errors.join('\n')}` : '✅ 분기·필수 문항 검사 통과')

writeFileSync(new URL('../data/responses.json', import.meta.url), JSON.stringify(result, null, 2))
console.log('\n→ data/responses.json 저장')
