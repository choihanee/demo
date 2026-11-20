// AI 없이 폴백 확인: node scripts/check-fallback.js
import { readFileSync } from 'node:fs'
import { fallbackTypes, fallbackTextAnswers } from '../fallback.js'
import { validateTypes, validateTextAnswers } from '../validate.js'

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf-8'))

for (const file of ['prompt1_input.mock.json', 'form_sleep.mock.json']) {
  const input = load(`../samples/${file}`)
  const types = fallbackTypes(input, input.condition)
  // 우리 검증 코드를 그대로 통과해야 한다(비율 합 1, 조건 비율, 선택지 이름, 분포 합)
  const ok = validateTypes({ types }, input, input.condition)
  console.log(`\n[${file}] 폴백 유형 ${ok.length}개 ✅  ratio 합 ${ok.reduce((a, t) => a + t.ratio, 0).toFixed(3)}`)
  for (const t of ok) console.log(`  ${t.type_id} ${t.name}  ratio=${t.ratio.toFixed(2)}  probs 질문 수=${Object.keys(t.probs).length}`)

  const textQs = input.questions.filter((q) => q.type === 'short_text' || q.type === 'paragraph')
  const requests = types.flatMap((t) => textQs.map((q) => ({ type_id: t.type_id, question_id: q.id, count: 3 })))
  const answers = validateTextAnswers(fallbackTextAnswers(types, textQs, requests), requests)
  console.log(`  서술형 폴백 ${answers.length}개 ✅  예) ${answers[0].answers.join(' / ')}`)
}

// 같은 입력이면 같은 결과인지
const a = load('../samples/form_sleep.mock.json')
const same = JSON.stringify(fallbackTypes(a, a.condition)) === JSON.stringify(fallbackTypes(a, a.condition))
console.log('\n같은 입력 → 같은 결과:', same ? '✅' : '❌')
