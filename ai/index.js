import { readFileSync } from 'node:fs'
import { askJson } from './llm.js'
import { buildTypesPrompt, buildTextPrompt } from './prompts.js'
import { validateTypes, validateTextAnswers } from './validate.js'
import { fallbackTypes, fallbackTextAnswers } from './fallback.js'

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf-8'))

// 프롬프트①: 질문 + condition → types [{type_id, name, ratio, description, attributes?, probs?}]
export async function getTypes(form, condition) {
  try {
    const { system, user } = buildTypesPrompt(form, condition)
    return await askJson({
      system,
      user,
      validate: (raw) => validateTypes(raw, form, condition),
    })
  } catch (e) {
    console.error('[ai] 프롬프트① 실패, 규칙 기반 폴백 사용:', e.message)
    try {
      return validateTypes({ types: fallbackTypes(form, condition) }, form, condition).map((t) => ({ ...t, source: 'fallback' }))
    } catch (e2) {
      console.error('[ai] 규칙 기반 폴백도 실패, 고정 샘플 사용:', e2.message)
      try {
        return load('../data/types.json').types
      } catch {
        return []
      }
    }
  }
}

// 프롬프트②: types + 서술형 질문 + requests → [{type_id, question_id, answers}]
const CHUNK = 6 // 한 번에 AI에 맡기는 요청 수(길이 초과 방지)
const MAX_PER_REQUEST = 10 // 요청당 AI가 만드는 답 상한. 엔진이 모자라면 돌려 쓴다(count가 50이어도 10개만 받음)
export async function getTextAnswers(types, questions, rawRequests) {
  const requests = rawRequests.map((r) => ({ ...r, count: Math.min(r.count, MAX_PER_REQUEST) }))
  try {
    const chunks = []
    for (let i = 0; i < requests.length; i += CHUNK) chunks.push(requests.slice(i, i + CHUNK))
    const results = await Promise.all(
      chunks.map((reqs) => {
        const { system, user } = buildTextPrompt(types, questions, reqs)
        return askJson({ system, user, maxTokens: 8000, validate: (raw) => validateTextAnswers(raw, reqs) })
      }),
    )
    return results.flat()
  } catch (e) {
    console.error('[ai] 프롬프트② 실패, 규칙 기반 폴백 사용:', e.message)
    try {
      return validateTextAnswers(fallbackTextAnswers(types, questions, requests), requests).map((a) => ({ ...a, source: 'fallback' }))
    } catch (e2) {
      console.error('[ai] 규칙 기반 폴백도 실패, 고정 샘플 사용:', e2.message)
      try {
        return load('../data/text_answers.json')
      } catch {
        return []
      }
    }
  }
}
