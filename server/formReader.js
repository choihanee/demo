// [범다온] 구글폼 링크 → questions.json 구조로 변환

const TYPE_MAP = {
  0: 'short_text', 1: 'paragraph', 2: 'multiple_choice', 3: 'dropdown',
  4: 'checkbox', 5: 'linear_scale', 7: 'multiple_choice_grid',
  9: 'date', 10: 'time', 13: 'file_upload',
};

export async function readForm(formUrl) {
  const response = await fetch(formUrl);
  if (!response.ok) throw new Error(`Google Form 가져오기 실패: ${response.status}`);

  const html = await response.text();
  const match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*([\s\S]*?);\s*<\/script>/);
  if (!match) throw new Error('Google Form 데이터를 찾을 수 없습니다.');

  const data = JSON.parse(match[1]);
  const items = data[1]?.[1] ?? [];

  const sections = [{ id: 'section1', page_index: 0, title: '', next: 'submit' }];
  const sectionByItemId = {};
  const questions = [];
  let current = 'section1';
  let n = 0;

  for (const item of items) {
    const [itemId, title, , typeCode, entries] = item;

    // 섹션 구분
    if (typeCode === 8) {
      const idx = sections.length;
      current = `section${idx + 1}`;
      sectionByItemId[itemId] = current;
      sections.push({ id: current, page_index: idx, title: title ?? '', next: 'submit' });
      continue;
    }

    // 질문이 아닌 블록(제목, 이미지 등) 건너뛰기
    if (!Array.isArray(entries) || entries.length === 0) continue;

    const type = TYPE_MAP[typeCode] ?? 'unknown';
    const first = entries[0];
    const q = { id: `q${++n}`, section: current, type, title, required: first[2] === 1 };

    if (type === 'multiple_choice_grid') {
      q.rows = entries.map(e => ({ label: e[3]?.[0], entry_id: `entry.${e[0]}` }));
      q.columns = (first[1] ?? []).map(o => o[0]);
    } else {
      q.entry_id = `entry.${first[0]}`;

      if (['multiple_choice', 'checkbox', 'dropdown'].includes(type)) {
        const raw = first[1] ?? [];
        q.has_other = raw.some(o => o[4] === 1);
        q.options = raw
          .filter(o => o[4] !== 1)
          .map(o => (typeof o[2] === 'number' ? { label: o[0], go_to: o[2] } : { label: o[0] }));
      }

      if (type === 'linear_scale') {
        const raw = first[1] ?? [];
        q.scale = {
          min: Number(raw[0]?.[0]),
          max: Number(raw.at(-1)?.[0]),
          min_label: first[3]?.[0] ?? '',
          max_label: first[3]?.[1] ?? '',
        };
      }
    }

    questions.push(q);
  }

  // go_to: 섹션 item id → 팀 섹션 id (-2는 제출)
  let hasBranching = false;
  for (const q of questions) {
    for (const o of q.options ?? []) {
      if (o.go_to === undefined) continue;
      if (o.go_to === -3) o.go_to = 'submit';
        else if (sectionByItemId[o.go_to]) o.go_to = sectionByItemId[o.go_to];
        else delete o.go_to; // -2(다음 섹션) 등은 분기 아님
      if (o.go_to) hasBranching = true;
    }
  }

  // 기본 next: 다음 섹션 (분기 있으면 branch로 바꾸는 건 나중에)
  sections.forEach((s, i) => { s.next = sections[i + 1]?.id ?? 'submit'; });
  for (const s of sections) {
    if (questions.some(q => q.section === s.id && q.options?.some(o => o.go_to))) s.next = 'branch';
  }

  return {
    form: {
      title: data[3] ?? data[1]?.[8] ?? '',
      description: data[1]?.[0] ?? '',
      form_url: formUrl,
      submit_url: formUrl.replace(/\/viewform.*/, '/formResponse'),
      has_branching: hasBranching,
    },
    sections,
    questions,
  };
}