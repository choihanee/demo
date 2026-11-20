// [박민서] 결과 화면: 가짜 데이터 표시, 미리보기 표, CSV, 제출
import { useState } from 'react'
import { submitForm } from '../api.js'
import { downloadCsv } from '../csv.js'
import Button from '../components/Button.jsx'
import Card from '../components/Card.jsx'

const show = (v) => v == null ? <span className="text-gray-300">-</span> : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k}:${x}`).join(' / ') : String(v)

export default function Result({ form, result, onRestart }) {
  const [confirm, setConfirm] = useState(false)
  const [msg, setMsg] = useState('')
  const submit = async () => { const r = await submitForm(form, result.rows); setMsg(`제출 ${r.submitted}건 / 실패 ${r.failed}건 ${r.message || ''}`) }

  return (
    <div className="space-y-4">
      <div className="bg-amber-100 text-amber-800 rounded-xl px-4 py-2 text-sm font-semibold">⚠ {result.meta.label} · 실제 응답이 아닙니다</div>
      <Card>
        <h2 className="font-bold mb-2">응답자 유형</h2>
        <ul className="text-sm space-y-1">{result.types.map((t) => <li key={t.type_id}><b>{t.name}</b> {Math.round(t.ratio * 100)}% · {t.description}</li>)}</ul>
      </Card>
      <Card className="overflow-x-auto">
        <div className="flex justify-between mb-3">
          <h2 className="font-bold">응답 미리보기 ({result.meta.count}명 중 30명)</h2>
          <Button variant="ghost" onClick={() => downloadCsv(form, result)}>CSV 다운로드</Button>
        </div>
        <table className="text-xs min-w-full">
          <thead><tr>{['#', '유형', '성실도', ...form.questions.map((q) => q.id)].map((h) => <th key={h} className="text-left p-2 border-b">{h}</th>)}</tr></thead>
          <tbody>{result.rows.slice(0, 30).map((r) => (
            <tr key={r.respondent_id}><td className="p-2 border-b">{r.respondent_id}</td><td className="p-2 border-b">{r.type_name}</td><td className="p-2 border-b">{r.quality}</td>
              {form.questions.map((q) => <td key={q.id} className="p-2 border-b max-w-48 truncate">{show(r.answers[q.id])}</td>)}</tr>))}
          </tbody>
        </table>
      </Card>
      <Card className="space-y-3">
        <h2 className="font-bold">구글폼에 제출</h2>
        <label className="flex gap-2 text-sm items-center"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />내가 만든 테스트용 폼입니다</label>
        <div className="flex gap-2"><Button disabled={!confirm} onClick={submit}>제출하기</Button><Button variant="ghost" onClick={onRestart}>처음으로</Button></div>
        {msg && <p className="text-sm text-gray-600">{msg}</p>}
      </Card>
    </div>
  )
}
