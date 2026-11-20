// [범다온] Express 서버: 화면 ↔ 폼 파싱·제출 ↔ AI ↔ 엔진
import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { readForm } from './formReader.js'
import { submitForm } from './formSubmitter.js'
import { getTypes, getTextAnswers } from '../ai/index.js'
import { planResponses, fillText } from '../engine/generator.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '5mb' }))

app.get('/', (req, res) => res.json({ ok: true }))

// 링크 → 질문
app.post('/api/form/read', async (req, res) => {
  try {
    res.json(await readForm(req.body.formUrl))
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// 질문 + 조건 → 가상 응답
app.post('/api/generate', async (req, res) => {
  try {
    const { form, condition } = req.body
    const types = await getTypes(form, condition)                       // 수민 ①
    const plan = planResponses(form, condition, types)                  // 가빈 1단계
    const textQs = form.questions.filter((q) => ['short_text', 'paragraph'].includes(q.type))
    const textAnswers = await getTextAnswers(plan.types, textQs, plan.textRequests) // 수민 ②
    res.json(fillText(plan, textAnswers))                               // 가빈 2단계
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
})

// 응답 → 구글폼 제출
app.post('/api/form/submit', async (req, res) => {
  try {
    res.json(await submitForm(req.body.form, req.body.rows))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`데모 서버: http://localhost:${PORT}`))
