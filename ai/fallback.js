// AI가 끝까지 실패했을 때 대신 쓰는 규칙 기반 폴백. AI 없이 설문 구조와 condition만으로 만든다.
// 같은 입력이면 항상 같은 결과가 나온다(시드 고정). 결과에는 source: 'fallback' 표시가 붙는다.

// ───────── 시드 난수 ─────────
function hash(str) {
  let h = 2166136261
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}
function rng(seedStr) {
  let a = hash(seedStr)
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const normalize = (w) => {
  const s = w.reduce((a, b) => a + b, 0)
  return w.map((x) => x / s)
}
const toDist = (labels, weights) => Object.fromEntries(labels.map((l, i) => [l, weights[i]]))

// 선택지 분포: 기본은 고르게 + 무작위 쏠림, peak 가 있으면 그 선택지에 힘을 더 준다
function choiceDist(labels, seed, peak = -1) {
  const r = rng(seed)
  const w = labels.map((_, i) => 0.4 + r() ** 2 * 1.6 + (i === peak ? 2.5 : 0))
  return toDist(labels, normalize(w))
}
// 척도 분포: 유형마다 평균이 다른 종 모양
function scaleDist(min, max, seed) {
  const r = rng(seed)
  const labels = []
  for (let i = min; i <= max; i++) labels.push(String(i))
  const mean = min + (max - min) * (0.2 + r() * 0.6)
  const w = labels.map((l) => Math.exp(-((Number(l) - mean) ** 2) / 2) + 0.03)
  return toDist(labels, normalize(w))
}
// 체크박스: 선택지마다 고를 확률(독립)
function checkboxProbs(labels, seed) {
  const r = rng(seed)
  return Object.fromEntries(labels.map((l) => [l, Number((0.12 + r() * 0.6).toFixed(2))]))
}

// ───────── 유형 만들기 ─────────
function makeGroups(condition) {
  const attrs = condition?.attributes ?? {}
  const attr = Object.keys(attrs).find((a) => Object.keys(attrs[a]).length >= 2)
  if (!attr) return { attr: null, groups: [{ values: [], pct: 100 }] }
  let groups = Object.entries(attrs[attr]).map(([v, pct]) => ({ values: [v], pct }))
  while (groups.length > 5) {
    // 가장 작은 두 묶음을 합친다
    groups.sort((a, b) => a.pct - b.pct)
    const [a, b, ...rest] = groups
    groups = [...rest, { values: [...a.values, ...b.values], pct: a.pct + b.pct }]
  }
  return { attr, groups }
}

export function fallbackTypes(form, condition) {
  const { attr, groups } = makeGroups(condition)
  // 유형이 4개가 될 때까지 가장 큰 묶음을 6:4로 나눈다
  let items = groups.map((g) => ({ ...g, part: '' }))
  while (items.length < 4) {
    items.sort((a, b) => b.pct - a.pct)
    const [big, ...rest] = items
    items = [...rest, { ...big, pct: big.pct * 0.6, part: 'A' }, { ...big, pct: big.pct * 0.4, part: 'B' }]
  }
  // 정렬을 원래 순서로 돌려 유형 번호가 안정적이게 한다
  items.sort((a, b) => b.pct - a.pct)
  const total = items.reduce((s, g) => s + g.pct, 0)

  const questions = form.questions ?? []

  return items.map((g, idx) => {
    const type_id = `t${idx + 1}`
    const label = g.values.length ? g.values.join('·') : '일반'
    const name = `${label} 응답자${g.part ? ' ' + g.part : ''}`
    const t = {
      type_id,
      name,
      ratio: g.pct / total,
      description: g.values.length
        ? `${attr}이(가) ${g.values.join(', ')}인 응답자 집단. 규칙 기반 폴백으로 만든 유형이라 성향은 무작위로 정해졌다.`
        : '전체 응답자 집단. 규칙 기반 폴백으로 만든 유형이다.',
      source: 'fallback',
      probs: {},
    }
    if (g.values.length) t.attributes = { [attr]: g.values }

    // 분기 질문이 있으면 유형마다 다른 갈래를 크게 선호하게 한다
    const chosen = {} // 분기 질문 id → 고른 보기
    for (const q of questions) {
      if (!(q.options ?? []).some((o) => o.go_to)) continue
      const labels = q.options.map((o) => o.label)
      const peak = idx % labels.length
      t.probs[q.id] = toDist(labels, normalize(labels.map((l, i) => (i === peak ? 0.7 : 0.3 / (labels.length - 1)))))
      chosen[q.id] = q.options[peak]
    }

    // 엔진과 같은 규칙으로 이 유형이 지나가는 구역을 따라가 본다
    // (분기 보기의 go_to → 없으면 다음 구역으로 진행)
    const sections = form.sections?.length ? form.sections : null
    const reachable = new Set()
    if (sections) {
      let cur = sections[0]
      while (cur && !reachable.has(cur.id)) {
        reachable.add(cur.id)
        const goTo = questions.filter((q) => q.section === cur.id).map((q) => chosen[q.id]?.go_to).find(Boolean)
        const nextInOrder = sections[sections.indexOf(cur) + 1]?.id ?? 'submit'
        const next = cur.next === 'branch' ? goTo ?? nextInOrder : cur.next ?? nextInOrder
        cur = next === 'submit' ? null : sections.find((x) => x.id === next)
      }
    }

    for (const q of questions) {
      if (t.probs[q.id]) continue
      if (sections && !reachable.has(q.section)) continue // 이 유형이 가지 않는 구역의 질문은 건너뜀
      const seed = `${type_id}|${q.id}`
      if (q.type === 'multiple_choice' || q.type === 'dropdown') {
        t.probs[q.id] = choiceDist((q.options ?? []).map((o) => o.label), seed)
      } else if (q.type === 'linear_scale') {
        t.probs[q.id] = scaleDist(q.scale.min, q.scale.max, seed)
      } else if (q.type === 'multiple_choice_grid') {
        t.probs[q.id] = Object.fromEntries((q.rows ?? []).map((r) => [r.label, choiceDist(q.columns, `${seed}|${r.label}`)]))
      } else if (q.type === 'checkbox') {
        t.probs[q.id] = checkboxProbs((q.options ?? []).map((o) => o.label), seed)
      }
    }
    return t
  })
}

// ───────── 서술형 답변 ─────────
// 주제와 무관한 일반 문장 풀. 질문 내용을 모르므로 어느 설문에서도 어색하지 않은 짧은 답만 쓴다.
const SHORT = ['딱히 없어요', '잘 모르겠어요', '없음', '특별한 건 없습니다', '그냥 그래요', '상황에 따라 달라요', '비용이 부담돼요', '시간이 부족해서요', '귀찮아서요', '아직 생각 안 해봤어요', '보통이에요', '주변 영향이 커요']
const LONG = [
  '크게 불편한 점은 없지만 가끔 신경 쓰이는 부분은 있어요.',
  '상황에 따라 달라서 한마디로 말하기는 어렵습니다.',
  '시간이 부족한 게 제일 큽니다. 여유가 생기면 조금 달라질 것 같아요.',
  '비용 부담이 있어서 선택이 제한되는 편이에요.',
  '평소엔 괜찮은데 바쁠 때는 챙기기가 어렵습니다.',
  '딱히 불만은 없고 지금 상태로도 괜찮다고 생각해요.',
  '주변 사람들 영향을 많이 받는 것 같아요. 혼자서는 잘 안 바뀌네요.',
  '예전부터 습관처럼 해 와서 바꿀 생각을 크게 안 해봤어요.',
  '필요하다고는 느끼는데 막상 실천하기가 쉽지 않습니다.',
  '정보가 부족해서 어떻게 해야 할지 막막할 때가 있어요.',
]

export function fallbackTextAnswers(types, questions, requests) {
  const byId = Object.fromEntries(questions.map((q) => [q.question_id ?? q.id, q]))
  return requests.map((r) => {
    const q = byId[r.question_id]
    const pool = q?.type === 'paragraph' ? LONG : SHORT
    const rand = rng(`${r.type_id}|${r.question_id}`)
    const order = [...pool.keys()].sort(() => rand() - 0.5)
    const answers = []
    for (let i = 0; i < r.count; i++) {
      if (i < pool.length) answers.push(pool[order[i]])
      else answers.push(`${pool[order[i % pool.length]]} (${Math.floor(i / pool.length) + 1})`) // 풀보다 많이 필요하면 번호로 구분
    }
    return { type_id: r.type_id, question_id: r.question_id, answers, source: 'fallback' }
  })
}
