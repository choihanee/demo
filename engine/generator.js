// [김가빈] 응답 생성 엔진 (인수인계서 기준)
//
// 서버에서 쓰는 순서
//   1) const plan = planResponses(form, condition, types)       객관식·분기 응답 + 서술형 요청 목록
//   2) const textAnswers = await 수민.getTextAnswers(plan.textRequests)
//   3) const result = fillText(plan, textAnswers)                최종 결과 (responses.json 형식)
//   4) const errors = validate(form, result)                     제출 전 검사 (선택)
// 한 번에 하려면: generate(form, condition, types, textAnswers)
//
// 입력 형식
//   form       : questions.json (form, sections, questions)
//   condition  : { total: 50, attributes: { 학년: { "1학년": 20, ... }, 거주: { 자취: 70, ... } } }
//   types      : [{ type_id, name, ratio, description, attributes?, probs? }]   (수민 프롬프트①)
//   textAnswers: [{ type_id, question_id, answers: [...] }]                     (수민 프롬프트②)

export const TEXT_TYPES = ['short_text', 'paragraph']
export const CHOICE_TYPES = ['multiple_choice', 'dropdown']
export const SUPPORTED = [...CHOICE_TYPES, 'checkbox', 'linear_scale', ...TEXT_TYPES, 'multiple_choice_grid', 'date']

const DEFAULTS = { total: 50, minTotal: 1, maxTotal: 200, missingRate: 0.05, carelessRate: 0.05, otherRate: 0.03 }
const FALLBACK_TEXT = ['딱히 없어요', '잘 모르겠어요', '특별히 생각나는 건 없어요', '보통이에요']
const FALLBACK_OTHER = '기타'
const CARELESS_TEXT = ['ㅇㅇ', '없음', '.', 'ㅁㄴㅇㄹ', '그냥']
const OTHER = '기타'

// ───────────────────────── 기본 도구 ─────────────────────────

// seed를 주면 매번 같은 결과 (데모 재현용)
export function makeRng(seed) {
  if (seed === undefined || seed === null) return Math.random
  let a = Number(seed) >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0)
const pickOne = (rng, arr) => arr[Math.floor(rng() * arr.length)]

function pickWeighted(rng, items, weights) {
  const w = weights.map(num)
  const total = w.reduce((s, x) => s + x, 0)
  if (total <= 0) return pickOne(rng, items)
  let r = rng() * total
  for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i] }
  return items[items.length - 1]
}

function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]] }
  return arr
}

// 비율 → 정확한 인원 (최대 잔여법). {"자취":70,"통학":30}, 50 → {"자취":35,"통학":15}
export function allocateCounts(weightMap, n) {
  const keys = Object.keys(weightMap)
  const w = keys.map((k) => num(weightMap[k]))
  const sum = w.reduce((s, x) => s + x, 0)
  const raw = keys.map((_, i) => (sum > 0 ? (w[i] / sum) * n : n / keys.length))
  const counts = raw.map(Math.floor)
  let left = n - counts.reduce((s, c) => s + c, 0)
  raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left-- > 0) counts[i]++ })
  return Object.fromEntries(keys.map((k, i) => [k, counts[i]]))
}

export const optionLabels = (q) => (q.options || []).map((o) => (typeof o === 'string' ? o : o.label))
export const scaleOptions = (q) => {
  const min = q.scale?.min ?? 1
  const max = q.scale?.max ?? 5
  return Array.from({ length: Math.max(max - min + 1, 1) }, (_, i) => String(min + i))
}
export const isBranchQuestion = (q) => (q.options || []).some((o) => typeof o === 'object' && o.go_to)

// ───────────────────────── 입력 정리 (AI가 이상한 값을 줘도 안 멈추게) ─────────────────────────

function normalizeCondition(condition) {
  const total = Math.round(Math.min(Math.max(Number(condition?.total) || DEFAULTS.total, DEFAULTS.minTotal), DEFAULTS.maxTotal))
  const attributes = {}
  for (const [name, dist] of Object.entries(condition?.attributes || {})) {
    const clean = Object.fromEntries(Object.entries(dist || {}).filter(([, v]) => num(v) > 0))
    if (Object.keys(clean).length) attributes[name] = clean
  }
  return { total, attributes }
}

function normalizeTypes(types, form, condition, warnings) {
  const list = Array.isArray(types) ? types.filter((t) => t && t.type_id) : []
  if (!list.length) {
    warnings.add('AI 응답자 유형이 없어 기본 유형 1개로 생성함')
    return [{ type_id: 'T0', name: '기본 응답자', ratio: 1, description: '', attributes: {}, probs: {} }]
  }
  const qById = Object.fromEntries((form.questions || []).map((q) => [q.id, q]))
  const out = list.map((t) => {
    const attributes = {}
    for (const [name, v] of Object.entries(t.attributes || {})) {
      const allowed = Object.keys(condition.attributes[name] || {})
      const vals = [].concat(v).filter((x) => !allowed.length || allowed.includes(x))
      if (vals.length) attributes[name] = vals
      else if (allowed.length) warnings.add(`${t.type_id}: 고정 속성 ${name}=${v} 이 조건에 없어 무시함`)
    }
    // 확률표에 없는 선택지 이름 경고 (오타 등)
    for (const [qid, p] of Object.entries(t.probs || {})) {
      const q = qById[qid]
      if (!q) { warnings.add(`${t.type_id}: 없는 문항 ${qid}의 확률은 무시함`); continue }
      const valid = q.type === 'linear_scale' ? scaleOptions(q) : q.type === 'multiple_choice_grid' ? (q.rows || []).map((r) => r.label) : [...optionLabels(q), OTHER]
      for (const k of Object.keys(p || {})) if (!valid.includes(k)) warnings.add(`${t.type_id}: ${qid}에 없는 선택지 "${k}"`)
    }
    return { ...t, ratio: num(t.ratio), attributes, probs: t.probs || {} }
  })
  if (out.every((t) => t.ratio === 0)) out.forEach((t) => (t.ratio = 1))
  const sum = out.reduce((s, t) => s + t.ratio, 0)
  if (Math.abs(sum - 1) > 0.01) warnings.add(`유형 비율 합이 ${sum.toFixed(2)}라 비율대로 맞춤`)
  return out
}

// ───────────────────────── 속성 배정 (조건 비율을 정확히 맞추기) ─────────────────────────
// 유형에 고정된 값이 있으면 그 안에서, 남은 자리(quota)가 많은 값부터 채움

function assignAttributes(rng, typeIds, typeOf, condition, warnings) {
  const n = typeIds.length
  const result = typeIds.map(() => ({}))
  for (const [name, dist] of Object.entries(condition.attributes)) {
    const quota = allocateCounts(dist, n)
    const order = shuffle(rng, [...Array(n).keys()])
    // 선택지가 적은(제약이 강한) 응답자부터 배정
    order.sort((a, b) => (typeOf[typeIds[a]].attributes[name]?.length ?? 99) - (typeOf[typeIds[b]].attributes[name]?.length ?? 99))
    let overflow = 0
    for (const i of order) {
      const allowed = typeOf[typeIds[i]].attributes[name] || Object.keys(dist)
      const open = allowed.filter((v) => quota[v] > 0)
      const pool = open.length ? open : allowed
      if (!open.length) overflow++
      // 남은 자리 비율대로 뽑기
      const v = pickWeighted(rng, pool, pool.map((x) => Math.max(quota[x] ?? 0, 0) || 0.01))
      quota[v] = (quota[v] ?? 0) - 1
      result[i][name] = v
    }
    if (overflow) warnings.add(`${name}: 유형 비율과 조건 비율이 달라 ${overflow}명은 조건 비율을 벗어남`)
  }
  return result
}

// ───────────────────────── 문항별 응답 ─────────────────────────

// 확률이 없을 때: 유형 설명으로 예/아니오 방향만 추정, 나머지는 고르게
function guessWeights(type, opts) {
  const desc = type.description || ''
  const neg = /경험이 없|없다|안 한다|하지 않|않는다/.test(desc)
  const pos = !neg && /경험이 있|하고 있|있다/.test(desc)
  return opts.map((label) => {
    if (/아니|없음|없다/.test(label)) return neg ? 10 : pos ? 0.1 : 1
    if (/^예$|^네$|있음|있다/.test(label)) return neg ? 0.1 : pos ? 10 : 1
    return 1
  })
}

function answerQuestion(rng, q, type, warnings) {
  const p = type.probs[q.id]
  switch (q.type) {
    case 'multiple_choice':
    case 'dropdown': {
      const opts = optionLabels(q)
      const items = q.has_other ? [...opts, OTHER] : opts
      const weights = p
        ? items.map((o) => (o === OTHER ? p[OTHER] ?? 0 : p[o] ?? 0))
        : [...guessWeights(type, opts), ...(q.has_other ? [DEFAULTS.otherRate * opts.length] : [])]
      const value = pickWeighted(rng, items, weights)
      return { value, needsOther: value === OTHER }
    }
    case 'checkbox': {
      const opts = optionLabels(q)
      let picked = opts.filter((o) => rng() < (p ? num(p[o]) : 0.35))
      if (q.has_other && rng() < (p?.[OTHER] ?? DEFAULTS.otherRate)) picked.push(OTHER)
      if (!picked.length) picked = [pickWeighted(rng, opts, opts.map((o) => (p ? num(p[o]) || 0.01 : 1)))]
      return { value: picked, needsOther: picked.includes(OTHER) }
    }
    case 'linear_scale': {
      const opts = scaleOptions(q)
      const mid = (opts.length - 1) / 2
      const w = p ? opts.map((o) => p[o] ?? 0) : opts.map((_, i) => 1 / (1 + Math.abs(i - mid)))
      return { value: Number(pickWeighted(rng, opts, w)) }
    }
    case 'multiple_choice_grid': {
      const value = {}
      for (const row of q.rows || []) {
        const rp = p?.[row.label]
        value[row.label] = pickWeighted(rng, q.columns || [], (q.columns || []).map((c) => (rp ? rp[c] ?? 0 : 1)))
      }
      return { value }
    }
    case 'date': {
      const d = new Date(Date.now() - Math.floor(rng() * 60) * 86400000)
      return { value: d.toISOString().slice(0, 10) }
    }
    case 'short_text':
    case 'paragraph':
      return { value: undefined, needsText: true } // 2단계(fillText)에서 채움
    default:
      warnings.add(`${q.id}: 지원하지 않는 유형(${q.type})이라 비워둠`)
      return { value: null }
  }
}

// ───────────────────────── 1단계: 응답자 배정 + 객관식·분기 ─────────────────────────

export function planResponses(form, rawCondition, rawTypes, options = {}) {
  const rng = makeRng(options.seed)
  const warnings = new Set()
  const questions = form.questions || []
  const condition = normalizeCondition(rawCondition)
  const types = normalizeTypes(rawTypes, form, condition, warnings)
  const typeOf = Object.fromEntries(types.map((t) => [t.type_id, t]))

  // 섹션이 없는 폼은 전체를 한 섹션으로
  const sections = form.sections?.length ? form.sections : [{ id: '__all', page_index: 0, next: 'submit' }]
  const inSection = (sid) => questions.filter((q) => (sid === '__all' ? true : q.section === sid))

  // 유형 배정 (정확한 인원)
  const typeCounts = allocateCounts(Object.fromEntries(types.map((t) => [t.type_id, t.ratio])), condition.total)
  const typeIds = shuffle(rng, Object.entries(typeCounts).flatMap(([id, c]) => Array(c).fill(id)))
  const attrs = assignAttributes(rng, typeIds, typeOf, condition, warnings)

  const rows = typeIds.map((tid, i) => {
    const type = typeOf[tid]
    const answers = Object.fromEntries(questions.map((q) => [q.id, null]))
    const other = {}
    const pages = []
    const visited = new Set()
    let current = sections[0]

    // 섹션을 따라가며 응답 → 안 간 섹션의 문항은 null 그대로
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      pages.push(current.page_index ?? pages.length)
      let goTo = null
      for (const q of inSection(current.id)) {
        const a = answerQuestion(rng, q, type, warnings)
        answers[q.id] = a.value
        if (a.needsOther) other[q.id] = undefined // 2단계에서 "기타" 내용 채움
        const opt = (q.options || []).find((o) => typeof o === 'object' && o.label === a.value && o.go_to)
        if (opt) goTo = opt.go_to
      }
      let next = current.next
      if (next === 'branch') {
        next = goTo
        if (!next) warnings.add(`${current.id}: 분기 섹션인데 이동할 곳을 못 찾아 제출로 끝냄`)
      }
      if (!next || next === 'submit') break
      current = sections.find((s) => s.id === next)
      if (!current) warnings.add(`없는 섹션 ${next}로 이동하려 해서 끝냄`)
    }

    return {
      respondent_id: i + 1,
      is_synthetic: true,
      type_id: tid,
      type_name: type.name,
      attributes: attrs[i],
      quality: 'normal',
      page_history: pages.join(','),
      answers,
      other,
    }
  })

  // 서술형 + "기타" 직접 입력 → 수민님 프롬프트② 요청 (유형×문항별 필요한 개수)
  const counts = {}
  for (const r of rows) {
    for (const q of questions) {
      const needs = (TEXT_TYPES.includes(q.type) && r.answers[q.id] === undefined) || q.id in r.other
      if (needs) counts[`${r.type_id}|${q.id}`] = (counts[`${r.type_id}|${q.id}`] || 0) + 1
    }
  }
  const textRequests = Object.entries(counts).map(([k, count]) => {
    const [type_id, question_id] = k.split('|')
    return { type_id, question_id, count }
  })

  return { form, condition, types, rows, textRequests, warnings: [...warnings], seed: options.seed }
}

// ───────────────────────── 2단계: 서술형·기타 채우기 + 결측·불성실 ─────────────────────────

export function fillText(plan, textAnswers = [], options = {}) {
  const seed = options.seed ?? (plan.seed != null ? Number(plan.seed) + 1 : undefined)
  const rng = makeRng(seed)
  const missingRate = options.missingRate ?? DEFAULTS.missingRate
  const carelessRate = options.carelessRate ?? DEFAULTS.carelessRate
  const warnings = new Set(plan.warnings)
  const questions = plan.form.questions || []

  // 유형×문항별 답 목록 (섞어서 겹치지 않게 순서대로 사용)
  const pool = {}
  for (const t of Array.isArray(textAnswers) ? textAnswers : []) {
    const list = (t?.answers || []).filter((s) => typeof s === 'string' && s.trim())
    if (list.length) pool[`${t.type_id}|${t.question_id}`] = shuffle(rng, [...list])
  }
  const cursor = {}
  const textSource = { ai: 0, fallback: 0 }
  const take = (key, fallbackList) => {
    const list = pool[key]
    if (!list) { textSource.fallback++; return pickOne(rng, fallbackList) }
    const i = cursor[key] = (cursor[key] ?? -1) + 1
    if (i === list.length) warnings.add(`${key.replace('|', ' ')}: AI 답이 부족해 일부 반복 사용`)
    textSource.ai++
    return list[i % list.length]
  }

  const rows = plan.rows.map((r) => ({ ...r, attributes: { ...r.attributes }, answers: structuredClone(r.answers), other: { ...r.other } }))

  for (const r of rows) {
    // 서술형, 기타 내용 채우기
    for (const q of questions) {
      const key = `${r.type_id}|${q.id}`
      if (r.answers[q.id] === undefined) r.answers[q.id] = take(key, FALLBACK_TEXT)
      if (q.id in r.other && r.other[q.id] === undefined) r.other[q.id] = take(key, [FALLBACK_OTHER])
    }

    // 결측 / 불성실 (한 사람은 둘 중 하나만)
    const roll = rng()
    if (roll < missingRate) {
      // 필수가 아닌 문항 중 일부를 비움 (분기 질문은 건드리지 않음)
      const candidates = questions.filter((q) => !q.required && !isBranchQuestion(q) && r.answers[q.id] !== null)
      const drop = candidates.filter(() => rng() < 0.6)
      if (!drop.length && candidates.length) drop.push(pickOne(rng, candidates))
      if (drop.length) {
        r.quality = 'missing'
        for (const q of drop) { r.answers[q.id] = null; delete r.other[q.id] }
      }
    } else if (roll < missingRate + carelessRate) {
      r.quality = 'careless'
      const straight = rng() < 0.5 // 절반은 "한 줄로 찍기", 절반은 "아무거나 찍기"
      for (const q of questions) {
        const v = r.answers[q.id]
        if (v === null || isBranchQuestion(q)) continue // 분기 질문을 바꾸면 이미 간 섹션과 안 맞음
        if (CHOICE_TYPES.includes(q.type)) {
          r.answers[q.id] = pickOne(rng, optionLabels(q)); delete r.other[q.id]
        } else if (q.type === 'checkbox') {
          r.answers[q.id] = [pickOne(rng, optionLabels(q))]; delete r.other[q.id]
        } else if (q.type === 'linear_scale') {
          const opts = scaleOptions(q)
          r.answers[q.id] = Number(straight ? opts[Math.floor(opts.length / 2)] : pickOne(rng, opts))
        } else if (q.type === 'multiple_choice_grid') {
          const same = pickOne(rng, q.columns)
          for (const k in v) v[k] = straight ? same : pickOne(rng, q.columns)
        } else if (TEXT_TYPES.includes(q.type)) {
          r.answers[q.id] = pickOne(rng, CARELESS_TEXT)
        }
      }
    }
  }

  const quality = rows.reduce((m, r) => ((m[r.quality] = (m[r.quality] || 0) + 1), m), { normal: 0, missing: 0, careless: 0 })

  return {
    meta: {
      is_synthetic: true,
      label: 'AI 생성 데이터',
      form_title: plan.form.form?.title,
      count: rows.length,
      condition: plan.condition,
      quality,
      text_source: textSource,
      warnings: [...warnings],
      created_at: new Date().toISOString(),
    },
    rows,
    stats: makeStats(questions, rows),
    types: plan.types.map(({ type_id, name, ratio, description }) => ({ type_id, name, ratio, description })),
  }
}

// ───────────────────────── 통계 (결과 화면 그래프용) ─────────────────────────

export function makeStats(questions, rows) {
  const stats = {}
  for (const q of questions) {
    if ([...CHOICE_TYPES, 'checkbox'].includes(q.type)) {
      const s = Object.fromEntries(optionLabels(q).map((l) => [l, 0]))
      if (q.has_other) s[OTHER] = 0
      for (const r of rows) for (const x of [].concat(r.answers[q.id] ?? [])) s[x] = (s[x] || 0) + 1
      stats[q.id] = s
    } else if (q.type === 'linear_scale') {
      const s = Object.fromEntries(scaleOptions(q).map((l) => [l, 0]))
      let sum = 0, n = 0
      for (const r of rows) { const v = r.answers[q.id]; if (v != null) { s[String(v)]++; sum += v; n++ } }
      stats[q.id] = { ...s, _avg: n ? Math.round((sum / n) * 100) / 100 : null }
    } else if (q.type === 'multiple_choice_grid') {
      const s = Object.fromEntries((q.rows || []).map((row) => [row.label, Object.fromEntries(q.columns.map((c) => [c, 0]))]))
      for (const r of rows) for (const [k, v] of Object.entries(r.answers[q.id] || {})) if (s[k]?.[v] != null) s[k][v]++
      stats[q.id] = s
    }
  }
  return stats
}

// ───────────────────────── 검사 (테스트·제출 전) ─────────────────────────
// 반환: 오류 문장 목록. 빈 배열이면 통과.

export function validate(form, result) {
  const errors = []
  const questions = form.questions || []
  const pageOf = Object.fromEntries((form.sections || []).map((s) => [s.id, String(s.page_index)]))
  for (const r of result.rows) {
    const pages = r.page_history.split(',')
    for (const q of questions) {
      const v = r.answers[q.id]
      const visible = !form.sections?.length || pages.includes(pageOf[q.section])
      if (!visible && v !== null) errors.push(`#${r.respondent_id} ${q.id}: 안 간 섹션인데 답이 있음`)
      if (visible && q.required && SUPPORTED.includes(q.type) && (v === null || v === undefined || (Array.isArray(v) && !v.length)))
        errors.push(`#${r.respondent_id} ${q.id}: 필수 문항이 비어 있음`)
      if (v == null) continue
      if (CHOICE_TYPES.includes(q.type) && ![...optionLabels(q), OTHER].includes(v)) errors.push(`#${r.respondent_id} ${q.id}: 없는 선택지 "${v}"`)
      if (q.type === 'checkbox' && v.some((x) => ![...optionLabels(q), OTHER].includes(x))) errors.push(`#${r.respondent_id} ${q.id}: 없는 선택지 포함`)
      if ([...(Array.isArray(v) ? v : [v])].includes(OTHER) && !r.other?.[q.id]) errors.push(`#${r.respondent_id} ${q.id}: 기타 내용이 비어 있음`)
    }
    if (r.is_synthetic !== true) errors.push(`#${r.respondent_id}: is_synthetic 표시 없음`)
  }
  return errors
}

export function generate(form, condition, types, textAnswers, options = {}) {
  return fillText(planResponses(form, condition, types, options), textAnswers, options)
}
