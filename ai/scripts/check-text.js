// 키 없이 ② 검증만 확인: node scripts/check-text.js
import { readFileSync } from 'node:fs'
import { validateTextAnswers } from '../validate.js'

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf-8'))
const input = load('../samples/prompt2_input.mock.json')
const output = load('../samples/prompt2_output.mock.json')

const ok = validateTextAnswers(output, input.requests)
console.log('통과 ✅ 항목 수:', ok.length)

const bad = (name, mutate) => {
  const copy = structuredClone(output)
  mutate(copy)
  try { validateTextAnswers(copy, input.requests); console.log(`❌ ${name}: 잡히지 않음`) }
  catch (e) { console.log(`✅ ${name} → ${e.message}`) }
}
bad('개수 부족', (o) => o[0].answers.pop())
bad('조합 누락', (o) => o.pop())
bad('중복 답', (o) => (o[1].answers[1] = o[1].answers[0]))
