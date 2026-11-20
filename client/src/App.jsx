// 화면 흐름: 설정(링크·조건) → 진행 → 결과
import { useState } from 'react'
import Settings from './pages/Settings.jsx'
import Progress from './pages/Progress.jsx'
import Result from './pages/Result.jsx'

export default function App() {
  const [step, setStep] = useState('settings')
  const [job, setJob] = useState(null)       // { form, condition }
  const [result, setResult] = useState(null)
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-violet-700 mb-8">데모</h1>
      {step === 'settings' && <Settings onStart={(j) => { setJob(j); setStep('progress') }} />}
      {step === 'progress' && <Progress job={job} onDone={(r) => { setResult(r); setStep('result') }} onBack={() => setStep('settings')} />}
      {step === 'result' && <Result form={job.form} result={result} onRestart={() => setStep('settings')} />}
    </div>
  )
}
