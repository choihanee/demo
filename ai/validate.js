import { z } from 'zod'

const TOL_SUM = 0.03 // 합이 이 정도까지 어긋나면 정규화로 보정
const TOL_COND = 0.06 // 조건 비율과 이 정도까지 어긋나면 허용

const TypeSchema = z.object({
  type_id: z.string().min(1),
  name: z.string().min(1),
  ratio: z.number().positive(),
  description: z.string().min(1),
  attributes: z.record(z.string(), z.array(z.string()).min(1)).optional(),
  probs: z.record(z.string(), z.any()).optional(),
})
export const TypesSchema = z.object({ types: z.array(TypeSchema).min(2).max(10) })

const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0)
const isDist = (o) => o && typeof o === 'object' && Object.values(o).every((v) => typeof v === 'number' && v >= 0)

// 합이 1 근처면 정규화, 크게 어긋나면 에러
function normalize(dist, where) {
  if (!isDist(dist)) throw new Error(`${where}: 숫자(0 이상) 분포가 아님`)
  const s = sum(dist)
  if (s <= 0 || Math.abs(s - 1) > TOL_SUM) throw new Error(`${where}: 합이 ${s.toFixed(3)} (1이어야 함)`)
  return Object.fromEntries(Object.entries(dist).map(([k, v]) => [k, v / s]))
}

function checkProbs(t, questions) {
  if (!t.probs) return
  const byId = Object.fromEntries(questions.map((q) => [q.id, q]))
  for (const [qid, dist] of Object.entries(t.probs)) {
    const q = byId[qid]
    const where = `${t.type_id}.probs.${qid}`
    if (!q) throw new Error(`${where}: 존재하지 않는 질문 id`)
    const OTHER = '기타'
    if (q.type === 'multiple_choice' || q.type === 'dropdown') {
      const labels = [...(q.options ?? []).map((o) => o.label), ...(q.has_other ? [OTHER] : [])]
      for (const k of Object.keys(dist)) if (!labels.includes(k)) throw new Error(`${where}: 없는 선택지 "${k}"`)
      t.probs[qid] = normalize(dist, where)
    } else if (q.type === 'linear_scale') {
      const keys = []
      for (let i = q.scale.min; i <= q.scale.max; i++) keys.push(String(i))
      for (const k of Object.keys(dist)) if (!keys.includes(k)) throw new Error(`${where}: 척도 범위 밖 "${k}"`)
      t.probs[qid] = normalize(dist, where)
    } else if (q.type === 'multiple_choice_grid') {
      const rows = (q.rows ?? []).map((r) => r.label)
      for (const [row, d] of Object.entries(dist)) {
        if (!rows.includes(row)) throw new Error(`${where}: 없는 행 "${row}"`)
        for (const k of Object.keys(d)) if (!q.columns.includes(k)) throw new Error(`${where}.${row}: 없는 열 "${k}"`)
        dist[row] = normalize(d, `${where}.${row}`)
      }
    } else if (q.type === 'checkbox') {
      const labels = [...(q.options ?? []).map((o) => o.label), ...(q.has_other ? [OTHER] : [])]
      for (const [k, v] of Object.entries(dist)) {
        if (!labels.includes(k)) throw new Error(`${where}: 없는 선택지 "${k}"`)
        if (typeof v !== 'number' || v < 0 || v > 1) throw new Error(`${where}.${k}: 0~1 확률이 아님`)
      }
    } else {
      throw new Error(`${where}: ${q.type} 질문에는 probs를 쓰지 않음`)
    }
  }
}

function checkCondition(types, condition) {
  const attrs = condition?.attributes ?? {}
  for (const [attr, valuePct] of Object.entries(attrs)) {
    // 유형이 전혀 쓰지 않는 속성(예: 학년)은 B가 독립적으로 뽑으므로 검사하지 않는다
    if (!types.some((t) => t.attributes?.[attr])) continue
    const groups = new Map() // 값 묶음 → ratio 합
    for (const t of types) {
      const vals = t.attributes?.[attr]
      if (!vals) throw new Error(`${t.type_id}: attributes에 "${attr}" 없음`)
      for (const v of vals) if (!(v in valuePct)) throw new Error(`${t.type_id}.attributes.${attr}: 조건에 없는 값 "${v}"`)
      const key = [...vals].sort().join('|')
      groups.set(key, (groups.get(key) ?? 0) + t.ratio)
    }
    const seen = new Set()
    for (const [key, ratioSum] of groups) {
      const vals = key.split('|')
      for (const v of vals) {
        if (seen.has(v)) throw new Error(`attributes.${attr}: 값 "${v}"이 서로 다른 묶음에 중복`)
        seen.add(v)
      }
      const expected = vals.reduce((a, v) => a + valuePct[v], 0) / 100
      if (Math.abs(ratioSum - expected) > TOL_COND)
        throw new Error(`${attr} [${vals.join(',')}]: 유형 ratio 합 ${ratioSum.toFixed(2)} ≠ 조건 ${expected.toFixed(2)}`)
    }
    for (const v of Object.keys(valuePct)) if (!seen.has(v)) throw new Error(`attributes.${attr}: 조건 값 "${v}"을 어떤 유형도 담당하지 않음`)
  }
}

// raw(JSON 파싱된 객체) → 검증·정규화된 types 배열. 실패 시 Error(메시지는 AI 재시도용으로 그대로 전달 가능)
export function validateTypes(raw, form, condition) {
  const parsed = TypesSchema.safeParse(raw)
  if (!parsed.success) throw new Error('형식 오류: ' + parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; '))
  const types = structuredClone(parsed.data.types)

  const ids = types.map((t) => t.type_id)
  if (new Set(ids).size !== ids.length) throw new Error('type_id 중복')

  // ratio 합 1 (소폭 오차는 정규화)
  const total = types.reduce((a, t) => a + t.ratio, 0)
  if (Math.abs(total - 1) > TOL_SUM) throw new Error(`ratio 합이 ${total.toFixed(3)} (1이어야 함)`)
  for (const t of types) t.ratio = t.ratio / total

  if (condition) checkCondition(types, condition)
  for (const t of types) checkProbs(t, form.questions ?? [])
  return types
}

// 프롬프트② 검증: 요청 조합이 빠짐없이 있고 answers 길이가 count와 같은지
const TextItemSchema = z.object({
  type_id: z.string(),
  question_id: z.string(),
  answers: z.array(z.string()),
})
export const TextAnswersSchema = z.array(TextItemSchema)

export function validateTextAnswers(raw, requests) {
  const list = Array.isArray(raw) ? raw : raw?.answers_list ?? raw?.items
  const parsed = TextAnswersSchema.safeParse(list)
  if (!parsed.success) throw new Error('형식 오류: ' + parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; '))
  const key = (a) => `${a.type_id}|${a.question_id}`
  const byKey = new Map(parsed.data.map((a) => [key(a), a]))
  const out = []
  for (const r of requests) {
    const got = byKey.get(key(r))
    if (!got) throw new Error(`누락: ${r.type_id} × ${r.question_id}`)
    const answers = got.answers.map((s) => s.trim()).filter(Boolean)
    if (answers.length !== r.count) throw new Error(`${r.type_id}×${r.question_id}: 답 ${answers.length}개 (count ${r.count}개여야 함)`)
    if (new Set(answers).size !== answers.length) throw new Error(`${r.type_id}×${r.question_id}: 똑같은 답이 중복`)
    out.push({ type_id: r.type_id, question_id: r.question_id, answers })
  }
  return out
}
