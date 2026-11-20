// 키가 있을 때 ①②를 이어서 실제 호출: node scripts/try-all.js [샘플파일명]
// 예) node scripts/try-all.js            → samples/prompt1_input.mock.json
//     node scripts/try-all.js form_sleep.mock.json
import { readFileSync } from 'node:fs'
import { getTypes, getTextAnswers } from '../index.js'

const file = process.argv[2] ?? 'prompt1_input.mock.json'
const input = JSON.parse(readFileSync(new URL(`../samples/${file}`, import.meta.url), 'utf-8'))
const { condition } = input

console.log(`\n=== 프롬프트① (${file}) ===`)
const types = await getTypes(input, condition)
for (const t of types) console.log(`${t.type_id} ${t.name}  ratio=${t.ratio.toFixed(2)}  ${JSON.stringify(t.attributes ?? {})}`)
console.log('ratio 합:', types.reduce((a, t) => a + t.ratio, 0).toFixed(3))

// 서술형 질문 × 모든 유형으로 requests 구성(분기 없는 설문 기준)
const textQs = input.questions.filter((q) => q.type === 'short_text' || q.type === 'paragraph')
const requests = types.flatMap((t) => textQs.map((q) => ({ type_id: t.type_id, question_id: q.id, count: 3 })))

console.log('\n=== 프롬프트② ===')
const answers = await getTextAnswers(types, textQs, requests)
for (const a of answers) console.log(`[${a.type_id}×${a.question_id}]\n  - ` + a.answers.join('\n  - '))
console.log('\n항목 수:', answers.length, '/ 요청 수:', requests.length)
