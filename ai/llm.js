import 'dotenv/config'

// Gemini 전용. 키는 ai/.env 의 GEMINI_API_KEY (예전 이름 ANTHROPIC_API_KEY, GOOGLE_API_KEY 도 읽음)
// 모델은 .env 의 AI_MODEL 로 바꿀 수 있다. 응답 대기 한도는 AI_TIMEOUT_MS(기본 60초).
const KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.ANTHROPIC_API_KEY || '').trim()
const MODEL = process.env.AI_MODEL || 'gemini-3.8-flash'

async function callGemini(system, user, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`
  const res = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 60000), // 한도를 넘으면 끊고 재시도
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      // 생각 토큰도 출력 한도에 포함되므로 넉넉히 잡는다
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens * 2, temperature: 0.9 },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data?.error?.message ?? res.statusText}`)
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('')
  if (!text) throw new Error(`Gemini 빈 응답(finishReason=${data.candidates?.[0]?.finishReason})`)
  return text
}

function extractJson(text) {
  const a = text.search(/[\[{]/)
  if (a < 0) throw new Error('응답에서 JSON을 찾지 못함')
  const close = text[a] === '[' ? ']' : '}'
  const b = text.lastIndexOf(close)
  if (b <= a) throw new Error('응답에서 JSON을 찾지 못함')
  return JSON.parse(text.slice(a, b + 1))
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const isQuota = (e) => /\b429\b/.test(e.message) && /quota|limit/i.test(e.message) // 사용 한도 초과: 재시도하면 호출만 더 소모된다
const isBusy = (e) => !isQuota(e) && /\b(429|500|502|503|504)\b|timeout|aborted|fetch failed/i.test(e.message) // 서버 혼잡·일시 오류

// validate(raw) 는 통과하면 값을 반환, 실패하면 Error를 던진다.
// 실패하면 오류 내용을 알려 주고 다시 요청한다(최대 retries회). 서버가 붐비면 쉬었다가 재시도한다.
export async function askJson({ system, user, validate, retries = 3, maxTokens = 4000 }) {
  if (!KEY) throw new Error('API 키 없음(ai/.env 의 GEMINI_API_KEY 확인)')
  let lastErr
  for (let i = 0; i <= retries; i++) {
    const content = lastErr ? `${user}\n\n[직전 시도 오류] ${lastErr.message}\n위 오류를 고쳐 JSON만 다시 출력하세요.` : user
    try {
      return validate(extractJson(await callGemini(system, content, maxTokens)))
    } catch (e) {
      lastErr = e
      console.error(`[ai] 시도 ${i + 1} 실패 (gemini/${MODEL}):`, e.message)
      if (isQuota(e)) break // 한도 초과는 즉시 포기(폴백으로 넘어감)
      if (isBusy(e) && i < retries) await sleep(3000 * (i + 1)) // 3초, 6초, 9초 쉬었다가 재시도
    }
  }
  throw lastErr
}
