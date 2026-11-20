
// [최하늬] CSV 다운로드

// 답변 데이터를 CSV 셀에 맞는 문자열로 변환
const cell = (v) => {
  if (v === null || v === undefined) return '';

  if (Array.isArray(v)) {
    return v.join('; ');
  }

  if (typeof v === 'object') {
    return Object.entries(v)
      .map(([k, x]) => `${k}:${x}`)
      .join(' / ');
  }

  return String(v);
};

export function downloadCsv(form, result) {
  const qs = form.questions;

  // 응답자 속성 항목 추출
  const attrNames = Object.keys(
    result.rows[0]?.attributes || {}
  );

  // CSV 제목 행
  const header = [
    '응답자',
    '유형',
    ...attrNames,
    '성실도',
    ...qs.map((q) => q.title),
  ];

  // 응답자별 데이터 행
  const lines = result.rows.map((r) => [
    r.respondent_id,
    r.type_name,
    ...attrNames.map((a) => r.attributes?.[a]),
    r.quality,
    ...qs.map((q) => cell(r.answers?.[q.id])),
  ]);

  // 쉼표, 큰따옴표 등이 포함된 데이터 처리
  const esc = (v) =>
    `"${String(v ?? '').replace(/"/g, '""')}"`;

  // CSV 문자열 생성 (UTF-8 BOM으로 한글 깨짐 방지)
  const csv =
    '\uFEFF# AI 생성 데이터\r\n' +
    [header, ...lines]
      .map((l) => l.map(esc).join(','))
      .join('\r\n');

  // CSV 파일 생성 및 다운로드
  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = 'demo_ai_generated.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();

  // 메모리 정리
  URL.revokeObjectURL(url);
}
