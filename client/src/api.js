// [최하늬] 서버 연동
const BASE = 'http://localhost:3001'
async function post(path, body) {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status)
  return res.json()
}
export const readForm = (formUrl) => post('/api/form/read', { formUrl })
export const generate = (form, condition) => post('/api/generate', { form, condition })
export const submitForm = (form, rows) => post('/api/form/submit', { form, rows })
