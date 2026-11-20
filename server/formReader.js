// [범다온] 구글폼 링크 → questions.json 형식
import { readFileSync } from 'node:fs'

export async function readForm(formUrl) {
  // TODO(다온): viewform 페이지의 FB_PUBLIC_LOAD_DATA_ 파싱 → form, sections, questions(entry_id, go_to 포함)
  // 지금은 샘플을 돌려줌
  const sample = JSON.parse(readFileSync(new URL('../data/questions.json', import.meta.url), 'utf-8'))
  return { ...sample, form: { ...sample.form, form_url: formUrl || sample.form.form_url } }
}
