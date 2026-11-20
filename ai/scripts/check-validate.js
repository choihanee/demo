// 키 없이 검증 코드만 확인: node scripts/check-validate.js
import { readFileSync } from 'node:fs'
import { validateTypes } from '../validate.js'

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf-8'))
const input = load('../samples/prompt1_input.mock.json')
const output = load('../samples/prompt1_output.mock.json')
const form = input
const condition = input.condition

const ok = validateTypes(output, form, condition)
console.log('통과 ✅ 유형 수:', ok.length, '/ ratio 합:', ok.reduce((a, t) => a + t.ratio, 0).toFixed(3))

const bad = (name, mutate) => {
  const copy = structuredClone(output)
  mutate(copy)
  try {
    validateTypes(copy, form, condition)
    console.log(`❌ ${name}: 잡히지 않음`)
  } catch (e) {
    console.log(`✅ ${name} → ${e.message}`)
  }
}
bad('ratio 합 어긋남', (o) => (o.types[0].ratio = 0.4))
bad('조건 비율 불일치', (o) => { o.types[2].ratio = 0.2; o.types[0].ratio = 0.3 })
bad('없는 선택지', (o) => (o.types[0].probs.q1 = { 예: 0.5, 글쎄: 0.5 }))
bad('분포 합 아님', (o) => (o.types[0].probs.q5 = { 1: 0.1, 2: 0.1 }))
bad('type_id 중복', (o) => (o.types[1].type_id = o.types[0].type_id))
