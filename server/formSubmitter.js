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

export async function submitForm(form, rows) {
  // TODO(다온): 실제 전송 + 재시도. 테스트용 폼에만 제출!
  // for (const row of rows) await fetch(form.form.submit_url, { method: 'POST', body: toFormData(form, row) })
  return { submitted: 0, failed: rows.length, message: '아직 구현 전 (샘플 모드)' }
}
