// [범다온] 응답 rows → formResponse 제출 (+재시도)
// rows[i] 형식: { answers: {q1: "예", q2: ["배달"], q6: {"아침": "매일"}}, other: {q2: "밀키트"}, page_history: "0,1,3" }

export function toFormData(form, row) {
  const p = new URLSearchParams()
  for (const q of form.questions) {
    const v = row.answers[q.id]
    if (v === null || v === undefined) continue
    if (q.type === 'multiple_choice_grid') {
      for (const r of q.rows) if (v[r.label]) p.append(r.entry_id, v[r.label])
    } else if (q.type === 'date') {
      const [y, m, d] = v.split('-')
      p.append(`${q.entry_id}_year`, y); p.append(`${q.entry_id}_month`, String(Number(m))); p.append(`${q.entry_id}_day`, String(Number(d)))
    } else {
      for (const x of [].concat(v)) {
        if (x === '기타') { p.append(q.entry_id, '__other_option__'); p.append(`${q.entry_id}.other_option_response`, row.other?.[q.id] || '') }
        else p.append(q.entry_id, String(x))
      }
    }
  }
  if (row.page_history) p.append('pageHistory', row.page_history)
  return p
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function submitOne(url, body, maxTry = 3) {
  let lastError = ''
  for (let t = 1; t <= maxTry; t++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      })
      if (res.ok) return { ok: true }
      lastError = `HTTP ${res.status}`
      // 400대(데이터 문제)는 재시도해도 같으니 바로 실패 (429만 재시도)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) break
    } catch (e) {
      lastError = e.message
    }
    if (t < maxTry) await sleep(1000 * t) // 1초, 2초 쉬고 재시도
  }
  return { ok: false, error: lastError }
}

export async function submitForm(form, rows, { delay = 300 } = {}) {
  const url = form.form.submit_url
  let submitted = 0
  const errors = []

  for (const row of rows) {
    const r = await submitOne(url, toFormData(form, row))
    if (r.ok) submitted++
    else errors.push({ respondent_id: row.respondent_id, error: r.error })
    await sleep(delay) // 너무 빠르게 보내면 막힐 수 있어서 간격 두기
  }

  return { submitted, failed: errors.length, errors }
}
