// [박민서] 설정 화면: 링크 입력 → 문항 확인 → 응답 수·비율 설정
import { useState } from 'react'
import { readForm } from '../api.js'
import Button from '../components/Button.jsx'
import Card from '../components/Card.jsx'

const DEFAULT_ATTRS = { 학년: { '1학년': 25, '2학년': 25, '3학년': 25, '4학년': 25 }, 거주: { 자취: 40, 통학: 50, 기숙사: 10 } }

export default function Settings({ onStart }) {
  const [url, setUrl] = useState('')
  const [form, setForm] = useState(null)
  const [total, setTotal] = useState(100)
  const [attrs, setAttrs] = useState(DEFAULT_ATTRS)
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    try { setForm(await readForm(url)) } catch (e) { setError('폼을 읽지 못했어요: ' + e.message) }
  }
  const setPct = (name, key, v) => setAttrs({ ...attrs, [name]: { ...attrs[name], [key]: Number(v) } })
  const sumOk = Object.values(attrs).every((d) => Object.values(d).reduce((s, x) => s + x, 0) === 100)

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-xl font-bold mb-3">구글폼 링크</h2>
        <div className="flex gap-2">
          <input className="flex-1 border rounded-xl px-4 py-2" placeholder="https://docs.google.com/forms/..." value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button onClick={load}>불러오기</Button>
        </div>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </Card>

      {form && (
        <>
          <Card>
            <h2 className="text-xl font-bold mb-2">{form.form.title}</h2>
            <ul className="text-sm space-y-1">
              {form.questions.map((q) => <li key={q.id}><span className="text-violet-600 font-semibold">[{q.type}]</span> {q.title}{q.required && ' *'}</li>)}
            </ul>
          </Card>
          <Card className="space-y-4">
            <h2 className="text-xl font-bold">응답자 조건</h2>
            <label className="block">응답 수: {total}명
              <input type="range" min="50" max="200" step="10" value={total} onChange={(e) => setTotal(Number(e.target.value))} className="w-full" />
            </label>
            {Object.entries(attrs).map(([name, dist]) => (
              <div key={name}>
                <p className="font-semibold mb-1">{name} (합 100)</p>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(dist).map(([k, v]) => (
                    <label key={k} className="text-sm">{k} <input type="number" className="w-16 border rounded px-1" value={v} onChange={(e) => setPct(name, k, e.target.value)} />%</label>
                  ))}
                </div>
              </div>
            ))}
            {/* TODO(민서): 속성 추가·삭제 */}
            {!sumOk && <p className="text-red-500 text-sm">각 조건의 비율 합이 100이 되어야 해요.</p>}
            <Button disabled={!sumOk} onClick={() => onStart({ form, condition: { total, attributes: attrs } })}>가상 응답 생성</Button>
          </Card>
        </>
      )}
    </div>
  )
}
