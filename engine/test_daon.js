// [김가빈] 다온님 readForm 결과 → 엔진 연결 테스트
// 사용법:
//   node test_daon.js "구글폼 링크"          ← 다온님 readForm으로 실제 폼 읽기
//   node test_daon.js ../data/questions.json  ← 파일로 테스트 (readForm 없이)
import { readFileSync } from 'node:fs'
import { generate, validate, SUPPORTED } from './generator.js'

// ⚠️ 다온님 파일 경로·함수 이름이 다르면 여기만 바꾸세요
const READER_PATH = '../server/formReader.js'
const READER_FN = 'readForm'

const arg = process.argv[2]
if (!arg) { console.log('사용법: node test_daon.js "구글폼 링크"'); process.exit(1) }

// 1. 폼 읽기
let form
if (arg.endsWith('.json')) {
  form = JSON.parse(readFileSync(new URL(arg, import.meta.url), 'utf-8'))
  console.log('📄 파일에서 읽음:', arg)
} else {
  const mod = await import(READER_PATH)
  if (typeof mod[READER_FN] !== 'function') {
    console.log(`❌ ${READER_PATH} 에 ${READER_FN} 함수가 없어요. 있는 것:`, Object.keys(mod))
    process.exit(1)
  }
  form = await mod[READER_FN](arg)
  console.log('🌐 다온님 readForm으로 읽음')
}

// 2. 필드 검사 (엔진이 기대하는 모양인지)
const problems = []
const p = (msg) => problems.push(msg)
if (!Array.isArray(form?.questions)) p('questions 가 배열이 아님 (form.questions 필요)')
const qs = form?.questions || []
const sections = form?.sections || []
const sectionIds = new Set(sections.map((s) => s.id))
if (form?.form?.has_branching && !sections.length) p('has_branching=true 인데 sections 가 비어 있음')
for (const s of sections) {
  if (!s.id) p(`섹션에 id 없음: ${JSON.stringify(s)}`)
  if (s.page_index === undefined) p(`${s.id}: page_index 없음 (제출 pageHistory에 필요)`)
  if (s.next && !['branch', 'submit'].includes(s.next) && !sectionIds.has(s.next)) p(`${s.id}: next="${s.next}" 인 섹션이 없음`)
}
for (const q of qs) {
  const where = q.id || q.title || JSON.stringify(q).slice(0, 40)
  for (const k of ['id', 'type', 'title']) if (q[k] === undefined) p(`${where}: ${k} 없음`)
  if (q.type && !SUPPORTED.includes(q.type)) p(`${where}: 엔진이 모르는 유형 "${q.type}" (지원: ${SUPPORTED.join(', ')})`)
  if (sections.length && !sectionIds.has(q.section)) p(`${where}: section="${q.section}" 인 섹션이 없음`)
  if (['multiple_choice', 'checkbox', 'dropdown'].includes(q.type)) {
    if (!Array.isArray(q.options) || !q.options.length) p(`${where}: options 없음`)
    else for (const o of q.options) {
      if (typeof o !== 'object' || !o.label) p(`${where}: 선택지가 {label} 객체가 아님 → ${JSON.stringify(o)}`)
      else if (o.go_to && o.go_to !== 'submit' && !sectionIds.has(o.go_to)) p(`${where}: 선택지 "${o.label}"의 go_to="${o.go_to}" 섹션이 없음`)
    }
  }
  if (q.type === 'linear_scale' && (q.scale?.min === undefined || q.scale?.max === undefined)) p(`${where}: scale.min / scale.max 없음`)
  if (q.type === 'multiple_choice_grid') {
    if (!Array.isArray(q.rows) || !q.rows.every((r) => r.label)) p(`${where}: rows 가 [{label, entry_id}] 형태가 아님`)
    if (!Array.isArray(q.columns) || !q.columns.every((c) => typeof c === 'string')) p(`${where}: columns 가 글자 목록이 아님`)
  }
  const needsEntry = q.type !== 'multiple_choice_grid'
  if (needsEntry && !q.entry_id) p(`${where}: entry_id 없음 (제출에 필요)`)
}

console.log(`\n문항 ${qs.length}개, 섹션 ${sections.length}개`)
console.table(qs.map((q) => ({ id: q.id, type: q.type, 필수: !!q.required, 섹션: q.section, 선택지: (q.options || q.columns || []).length, 분기: (q.options || []).filter((o) => o.go_to).map((o) => `${o.label}→${o.go_to}`).join(', ') })))
if (problems.length) console.log(`⚠️ 필드 문제 ${problems.length}건:\n - ${problems.join('\n - ')}`)
else console.log('✅ 필드 형식 정상')

// 3. 엔진 돌리기 (AI 없이 기본값으로) + validate
const condition = form.condition ?? { total: 30, attributes: {} }
const result = generate(form, condition, [], [], { seed: 1 })
const errors = validate(form, result)
console.log(`\n생성 ${result.meta.count}명 / 경고:`, result.meta.warnings)
console.log('거쳐간 페이지 예시:', [...new Set(result.rows.map((r) => r.page_history))])
console.log(errors.length ? `❌ validate 오류 ${errors.length}건:\n - ${errors.slice(0, 10).join('\n - ')}` : '✅ validate 통과 (빈 배열)')
