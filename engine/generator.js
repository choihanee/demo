// [김가빈] 응답 생성 엔진
// 사용 순서 (서버에서):
//   1) const plan = planResponses(form, condition, types)   → 객관식·분기 응답 + 서술형 요청 목록
//   2) textAnswers = 수민님 프롬프트②(plan.textRequests)
//   3) const result = fillText(plan, textAnswers)           → 최종 결과 (responses.json 형식)
// 한 번에: generate(form, condition, types, textAnswers)

const TEXT_TYPES = ['short_text', 'paragraph']
const SUPPORTED = ['multiple_choice', 'checkbox', 'dropdown', 'linear_scale', ...TEXT_TYPES, 'multiple_choice_grid', 'date']
const FALLBACK_TEXT = ['딱히 없어요', '잘 모르겠어요', '시간이 부족해요', '특별히 불편한 건 없어요']
const CARELESS_TEXT = ['ㅇㅇ', '없음', '.', 'ㅁㄴㅇㄹ']

// ---------- 난수 (seed를 주면 매번 같은 결과) ----------
function makeRng(seed) {
  if (seed === undefined || seed === null) return Math.random
  let a = Number(seed) >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pickWeighted = (rng, items, weights) => {
  const total = weights.reduce((s, w) => s + Math.max(w, 0), 0)
  if (total <= 0) return items[Math.floor(rng() * items.length)]
  let r = rng() * total
  for (let i = 0; i < items.length; i++) { r -= Math.max(weights[i], 0); if (r <= 0) return items[i] }
  return items[items.length - 1]
}
const shuffle = (rng, arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]] } return arr }

// 비율대로 정확한 개수 나누기 (최대 잔여법): {"자취":70,"통학":30}, 50 → ["자취"x35, "통학"x15] 섞어서
function allocate(rng, weightMap, n) {
  const keys = Object.keys(weightMap)
  const sum = keys.reduce((s, k) => s + Number(weightMap[k]), 0) || 1
  const raw = keys.map((k) => (Number(weightMap[k]) / sum) * n)
  const counts = raw.map(Math.floor)
  let left = n - counts.reduce((s, c) => s + c, 0)
  raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { counts[i]++; left-- } })
  const out = []
  keys.forEach((k, i) => { for (let c = 0; c < counts[i]; c++) out.push(k) })
  return shuffle(rng, out)
}

const labels = (q) => (q.options || []).map((o) => (typeof o === 'string' ? o : o.label))

// ---------- 확률이 없을 때의 기본값 (폴백) ----------
function defaultWeights(q, type, opts) {
  // 분기 질문: 유형 설명에 "없다"가 있으면 부정 선택지 쪽으로
  const desc = type?.description || ''
  const negative = /경험이 없|없다|안 한다|하지 않/.test(desc)
  const positive = !negative && /경험이 있|하고 있|있다/.test(desc)
  return opts.map((label) => {
    if (/아니|없음|없다/.test(label)) return negative ? 10 : positive ? 0.1 : 1
    if (/^예$|있음|있다/.test(label)) return negative ? 0.1 : positive ? 10 : 1
    return 1
  })
}
function scaleOptions(q) {
  const min = q.scale?.min ?? 1, max = q.scale?.max ?? 5
  return Array.from({ length: max - min + 1 }, (_, i) => String(min + i))
}

// ---------- 문항별 답 만들기 ----------
function answerQuestion(rng, q, type, warnings) {
  const probs = type?.probs?.[q.id]
  switch (q.type) {
    case 'multiple_choice':
    case 'dropdown': {
      const opts = labels(q)
      const w = probs ? opts.map((o) => probs[o] ?? 0) : defaultWeights(q, type, opts)
      if (q.has_other && rng() < 0.05 && !probs) return { value: '기타', other: '기타 의견' }
      return { value: pickWeighted(rng, opts, w) }
    }
    case 'checkbox': {
      const opts = labels(q)
      let picked = opts.filter((o) => rng() < (probs ? probs[o] ?? 0 : 0.35))
      if (q.has_other && rng() < 0.05) picked.push('기타')
      if (picked.length === 0) picked = [probs ? pickWeighted(rng, opts, opts.map((o) => probs[o] ?? 0.01)) : opts[Math.floor(rng() * opts.length)]]
      return { value: picked, other: picked.includes('기타') ? '기타 의견' : undefined }
    }
    case 'linear_scale': {
      const opts = scaleOptions(q)
      const mid = (opts.length - 1) / 2
      const w = probs ? opts.map((o) => probs[o] ?? 0) : opts.map((_, i) => 1 / (1 + Math.abs(i - mid)))
      return { value: Number(pickWeighted(rng, opts, w)) }
    }
    case 'multiple_choice_grid': {
      const value = {}
      for (const row of q.rows || []) {
        const p = probs?.[row.label]
        value[row.label] = pickWeighted(rng, q.columns, q.columns.map((c) => (p ? p[c] ?? 0 : 1)))
      }
      return { value }
    }
    case 'date': {
      const d = new Date(Date.now() - Math.floor(rng() * 60) * 86400000)
      return { value: d.toISOString().slice(0, 10) }
    }
    case 'short_text':
    case 'paragraph':
      return { value: undefined } // fillText에서 채움
    default:
      warnings.add(`${q.id}: 지원하지 않는 유형(${q.type})이라 비워둠`)
      return { value: null }
  }
}

// ---------- 1단계: 응답자 배정 + 객관식·분기 응답 ----------
export function planResponses(form, condition, types, options = {}) {
  const rng = makeRng(options.seed)
  const questions = form.questions || []
  const sections = form.sections?.length ? form.sections : [{ id: '__all', page_index: 0, next: 'submit' }]
  const bySection = (sid) => questions.filter((q) => (sections[0].id === '__all' ? true : q.section === sid))
  const total = Math.min(Math.max(Number(condition?.total) || 50, 1), 200)
  const warnings = new Set()

  // 유형이 없으면(AI 실패) 기본 유형 1개
  const typeList = types?.length ? types : [{ type_id: 'T0', name: '기본 응답자', ratio: 1, description: '' }]
  const typeIds = allocate(rng, Object.fromEntries(typeList.map((t) => [t.type_id, t.ratio ?? 1])), total)
  const typeOf = Object.fromEntries(typeList.map((t) => [t.type_id, t]))

  // 속성: 유형에 고정된 값 우선, 나머지는 condition 비율대로
  const attrPools = {}
  for (const [name, dist] of Object.entries(condition?.attributes || {})) attrPools[name] = allocate(rng, dist, total)

  const rows = typeIds.map((tid, i) => {
    const type = typeOf[tid]
    const attributes = {}
    for (const [name, dist] of Object.entries(condition?.attributes || {})) {
      const fixed = type.attributes?.[name]
      if (fixed === undefined) attributes[name] = attrPools[name][i]
      else if (Array.isArray(fixed)) attributes[name] = pickWeighted(rng, fixed, fixed.map((f) => Number(dist[f]) || 1))
      else attributes[name] = fixed
    }

    // 섹션을 따라가며 응답 (분기)
    const answers = Object.fromEntries(questions.map((q) => [q.id, null]))
    const other = {}
    const pages = []
    let current = sections[0]
    const visited = new Set()
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      pages.push(current.page_index ?? pages.length)
      let goTo = null
      for (const q of bySection(current.id)) {
        if (!SUPPORTED.includes(q.type)) warnings.add(`${q.id}: 지원하지 않는 유형(${q.type})`)
        const a = answerQuestion(rng, q, type, warnings)
        answers[q.id] = a.value === undefined ? undefined : a.value
        if (a.other) other[q.id] = a.other
        const opt = (q.options || []).find((o) => typeof o === 'object' && o.label === a.value && o.go_to)
        if (opt) goTo = opt.go_to
      }
      const next = current.next === 'branch' ? goTo : current.next
      if (!next || next === 'submit') break
      current = sections.find((s) => s.id === next)
    }

    return {
      respondent_id: i + 1,
      is_synthetic: true,
      type_id: tid,
      type_name: type.name,
      attributes,
      quality: 'normal',
      page_history: pages.join(','),
      answers,
      other,
    }
  })

  // 서술형 요청 목록 (수민님 프롬프트② 입력의 requests)
  const counts = {}
  for (const r of rows) for (const q of questions) {
    if (TEXT_TYPES.includes(q.type) && r.answers[q.id] === undefined) {
      const key = `${r.type_id}|${q.id}`
      counts[key] = (counts[key] || 0) + 1
    }
  }
  const textRequests = Object.entries(counts).map(([k, count]) => {
    const [type_id, question_id] = k.split('|')
    return { type_id, question_id, count }
  })

  return { form, condition, types: typeList, rows, textRequests, warnings: [...warnings], seed: options.seed }
}

// ---------- 2단계: 서술형 채우기 + 결측·불성실 + 통계 ----------
export function fillText(plan, textAnswers = [], options = {}) {
  const rng = makeRng(options.seed ?? (plan.seed !== undefined ? Number(plan.seed) + 1 : undefined))
  const missingRate = options.missingRate ?? 0.05
  const carelessRate = options.carelessRate ?? 0.05
  const questions = plan.form.questions || []
  const pool = {}
  for (const t of textAnswers || []) pool[`${t.type_id}|${t.question_id}`] = shuffle(rng, [...(t.answers || [])])
  const used = {}

  const rows = plan.rows.map((r) => ({ ...r, answers: { ...r.answers }, other: { ...r.other } }))
  for (const r of rows) {
    for (const q of questions) {
      if (r.answers[q.id] !== undefined) continue
      const key = `${r.type_id}|${q.id}`
      const list = pool[key]
      if (list?.length) { used[key] = (used[key] || 0); r.answers[q.id] = list[used[key]++ % list.length] }
      else r.answers[q.id] = FALLBACK_TEXT[Math.floor(rng() * FALLBACK_TEXT.length)]
    }

    const roll = rng()
    if (roll < missingRate) {
      r.quality = 'missing'
      for (const q of questions) if (!q.required && r.answers[q.id] !== null && rng() < 0.6) { r.answers[q.id] = null; delete r.other[q.id] }
    } else if (roll < missingRate + carelessRate) {
      r.quality = 'careless'
      for (const q of questions) {
        if (r.answers[q.id] === null) continue
        if (q.type === 'linear_scale') r.answers[q.id] = Number(scaleOptions(q)[Math.floor(scaleOptions(q).length / 2)])
        else if (q.type === 'multiple_choice_grid') { const c = q.columns[1] ?? q.columns[0]; for (const k in r.answers[q.id]) r.answers[q.id][k] = c }
        else if (TEXT_TYPES.includes(q.type)) r.answers[q.id] = CARELESS_TEXT[Math.floor(rng() * CARELESS_TEXT.length)]
      }
    }
  }

  return {
    meta: {
      is_synthetic: true,
      label: 'AI 생성 데이터',
      form_title: plan.form.form?.title,
      count: rows.length,
      warnings: plan.warnings,
      created_at: new Date().toISOString(),
    },
    rows,
    stats: makeStats(questions, rows),
    types: plan.types.map(({ type_id, name, ratio, description }) => ({ type_id, name, ratio, description })),
  }
}

export function makeStats(questions, rows) {
  const stats = {}
  for (const q of questions) {
    if (['multiple_choice', 'dropdown', 'checkbox'].includes(q.type)) {
      const s = Object.fromEntries(labels(q).map((l) => [l, 0]))
      if (q.has_other) s['기타'] = 0
      for (const r of rows) { const v = r.answers[q.id]; if (v == null) continue; for (const x of [].concat(v)) s[x] = (s[x] || 0) + 1 }
      stats[q.id] = s
    } else if (q.type === 'linear_scale') {
      const s = Object.fromEntries(scaleOptions(q).map((l) => [l, 0]))
      for (const r of rows) { const v = r.answers[q.id]; if (v != null) s[String(v)]++ }
      stats[q.id] = s
    } else if (q.type === 'multiple_choice_grid') {
      const s = {}
      for (const row of q.rows || []) s[row.label] = Object.fromEntries(q.columns.map((c) => [c, 0]))
      for (const r of rows) { const v = r.answers[q.id]; if (!v) continue; for (const k in v) if (s[k]) s[k][v[k]]++ }
      stats[q.id] = s
    }
  }
  return stats
}

export function generate(form, condition, types, textAnswers, options = {}) {
  return fillText(planResponses(form, condition, types, options), textAnswers, options)
}
