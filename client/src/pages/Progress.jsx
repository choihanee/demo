// [최하늬·박민서] 진행 화면
import { useEffect, useState } from 'react'
import { generate } from '../api.js'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'

const STEPS = ['문항 분석', 'AI 응답자 유형 구성', '객관식·분기 응답 생성', 'AI 서술형 답변 생성', '결측·불성실 응답 반영']

export default function Progress({ job, onDone, onBack }) {
  const [i, setI] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, STEPS.length - 1)), 1200)
    generate(job.form, job.condition).then(onDone).catch((e) => setError(e.message)).finally(() => clearInterval(t))
    return () => clearInterval(t)
  }, [])
  return (
    <Card>
      {error ? (<><p className="text-red-500 mb-3">생성 실패: {error}</p><Button variant="ghost" onClick={onBack}>돌아가기</Button></>) : (
        <ul className="space-y-2">{STEPS.map((s, idx) => <li key={s} className={idx <= i ? 'text-violet-700 font-semibold' : 'text-gray-300'}>{idx < i ? '✓' : idx === i ? '…' : '·'} {s}</li>)}</ul>
      )}
    </Card>
  )
}
