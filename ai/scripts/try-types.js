// 키가 있을 때 실제 호출 테스트: node scripts/try-types.js
import { readFileSync } from 'node:fs'
import { getTypes } from '../index.js'

const input = JSON.parse(readFileSync(new URL('../samples/prompt1_input.mock.json', import.meta.url), 'utf-8'))
const types = await getTypes(input, input.condition)
console.log(JSON.stringify(types, null, 2))
console.log('유형 수:', types.length, '/ ratio 합:', types.reduce((a, t) => a + t.ratio, 0).toFixed(3))
