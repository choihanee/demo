// [장수민] AI 프롬프트 ①②. 지금은 /data 목업을 돌려주고, 실제 LLM 호출은 TODO.
// 서버가 부르는 함수 2개만 이 이름과 형식을 지켜주세요.
import { readFileSync } from 'node:fs'

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf-8'))

// 프롬프트①: 질문 + condition → types [{type_id, name, ratio, description, attributes?, probs?}]
export async function getTypes(form, condition) {
  try {
    // TODO(수민): LLM 호출 → JSON 검증(ratio 합 1, 필드 확인)
    return load('../data/types.json').types
  } catch (e) {
    console.error('[ai] 프롬프트① 실패, 폴백 사용:', e.message)
    return [] // 엔진이 기본 유형으로 계속 진행
  }
}

// 프롬프트②: types + 서술형 질문 + requests → [{type_id, question_id, answers}]
export async function getTextAnswers(types, questions, requests) {
  try {
    // TODO(수민): LLM 호출. requests의 count만큼 answers 생성
    return load('../data/text_answers.json')
  } catch (e) {
    console.error('[ai] 프롬프트② 실패, 폴백 사용:', e.message)
    return [] // 엔진이 기본 문장으로 채움
  }
}
