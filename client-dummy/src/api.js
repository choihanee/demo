// 팀 서버(choihanee/demo 의 /server)와 연결해요. 서버 주소는 .env 의 VITE_API_BASE_URL 로 바꿀 수 있어요.
const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

async function post(path, body, signal) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error('서버에 연결하지 못했어요. 서버(localhost:3001)가 켜져 있는지 확인해 주세요.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `서버 오류 (${res.status})`);
  }
  return res.json();
}

// 구글폼 링크 → 문항 { form, sections, questions }
export const readForm = (formUrl, signal) => post('/api/form/read', { formUrl }, signal);

// 문항 + 조건 → { meta, rows, stats, types }
// condition: { total: 1~200, attributes: { 조건이름: { 항목: 비율(합 100) } } }
export const generate = (form, condition, signal) => post('/api/generate', { form, condition }, signal);

// 가상 응답을 구글폼에 제출 → { submitted, failed, message? }
export const submitForm = (form, rows) => post('/api/form/submit', { form, rows });

// 화면에서 입력한 값 → 서버가 받는 condition 모양
export function buildCondition(c) {
  const attributes = {};
  for (const a of c.attrs) {
    const name = a.name.trim();
    if (!name) continue;
    const dist = {};
    for (const o of a.options) {
      const label = o.label.trim();
      if (label) dist[label] = Number(o.pct) || 0;
    }
    attributes[name] = dist;
  }
  return { total: Number(c.count), attributes };
}
