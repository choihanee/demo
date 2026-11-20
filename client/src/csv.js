// [최하늬] CSV 다운로드
const cell = (v) => {
  if (v === null || v === undefined) return ''
  if (Array.isArray(v)) return v.join(';')
  if (typeof v === 'object') return Object.entries(v).map(([k, x]) => `${k}:${x}`).join(' / ')
  return String(v)
}
export function downloadCsv(form, result) {
  const qs = form.questions
  const attrNames = Object.keys(result.rows[0]?.attributes || {})
  const header = ['응답자', '유형', ...attrNames, '성실도', ...qs.map((q) => q.title)]
  const lines = result.rows.map((r) => [r.respondent_id, r.type_name, ...attrNames.map((a) => r.attributes[a]), r.quality, ...qs.map((q) => cell(r.answers[q.id]))])
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`
  const csv = '﻿# AI 생성 데이터\n' + [header, ...lines].map((l) => l.map(esc).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  a.download = 'demo_ai_generated.csv'
  a.click()
}
