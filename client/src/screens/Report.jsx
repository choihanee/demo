import { useMemo, useState } from 'react';
import { Nav, Footer, Button } from '../components/common.jsx';
import { submitForm } from '../api.js';
import { downloadCsv } from '../csv.js';

const show = (v) =>
  v == null ? '-' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k}:${x}`).join(' / ') : String(v);

// stats → 질문별(표는 행별) 막대 그래프 데이터. 값은 "명수"라서 비율로 바꿔요.
function buildCharts(form, result) {
  const qs = Object.fromEntries((form?.questions || []).map((q) => [q.id, q]));
  const total = result.meta?.count ?? result.rows?.length ?? 0;
  const make = (id, title, dist, multi, avg) => {
    const items = Object.entries(dist).filter(([k, v]) => !k.startsWith('_') && typeof v === 'number');
    const denom = multi ? total : items.reduce((s, [, v]) => s + v, 0);
    return {
      id,
      title,
      avg,
      items: items.map(([label, n]) => ({ label, count: n, percent: denom ? Math.round((n / denom) * 100) : 0 })),
    };
  };
  const charts = [];
  for (const [qid, stat] of Object.entries(result.stats || {})) {
    const q = qs[qid];
    const title = `${qid}. ${q?.title ?? ''}`.trim();
    const nested = Object.values(stat).some((v) => v && typeof v === 'object');
    if (nested) {
      for (const [row, dist] of Object.entries(stat)) {
        if (row.startsWith('_') || typeof dist !== 'object') continue;
        charts.push(make(`${qid}:${row}`, `${title} · ${row}`, dist, false));
      }
    } else {
      charts.push(make(qid, title, stat, q?.type === 'checkbox', stat._avg));
    }
  }
  return charts;
}

export default function Report({ go, form, result }) {
  const data = result || { meta: {}, rows: [], stats: {}, types: [] };
  const meta = data.meta || {};
  const charts = useMemo(() => buildCharts(form, data), [form, data]);
  const [chartId, setChartId] = useState(null);
  const chart = charts.find((c) => c.id === chartId) || charts[0];

  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const count = meta.count ?? data.rows.length;
  const bad = (meta.quality?.missing ?? 0) + (meta.quality?.careless ?? 0);
  const questions = form?.questions || [];

  const submit = async () => {
    setSubmitting(true);
    setMsg('');
    try {
      const r = await submitForm(form, data.rows);
      setMsg(`제출 ${r.submitted}건 / 실패 ${r.failed}건 ${r.message || ''}`);
    } catch (e) {
      setMsg(`제출하지 못했어요: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <Nav go={go} />
      <main className="wrap main">
        <button className="back" onClick={() => go('conditions')}>← 응답 조건 다시 보기</button>

        <div className="page-header">
          <div>
            {meta.form_title && <div className="eyebrow">{meta.form_title}</div>}
            <h1>설문 점검 리포트</h1>
            {count > 0 && <p>가상 응답 {count}건</p>}
          </div>
          <Button variant="secondary" onClick={() => downloadCsv(form, data)} disabled={!data.rows.length}>CSV 다운로드</Button>
        </div>

        <div className="notice">⚠ {meta.label || 'AI 생성 데이터'} · 실제 응답이 아니에요. 본 조사 전에 문항과 선택지를 점검하는 데 활용해 주세요.</div>

        <div className="metrics">
          <div className="metric"><div className="metric-top"><span>가상 응답</span><em className="badge">AI 생성 데이터</em></div><b>{count}<small>건</small></b></div>
          <div className="metric"><div className="metric-top"><span>점검 대상</span></div><b>{questions.length}<small>문항</small></b></div>
          <div className="metric"><div className="metric-top"><span>결측·불성실 응답</span></div><b>{bad}<small>건</small></b></div>
        </div>

        <div className="report-grid">
          <section className="card report-card">
            <div className="card-head"><h3>응답자 유형</h3><em className="badge">AI 구성</em></div>
            {(data.types || []).length === 0 && <p className="empty">표시할 유형이 없어요.</p>}
            {(data.types || []).map((t) => (
              <div className="fb type" key={t.type_id}>
                <div className="type-head"><b>{t.name}</b><span className="tag tag-blue">{Math.round(t.ratio * 100)}%</span></div>
                <p>{t.description}</p>
              </div>
            ))}
          </section>

          <section className="card report-card">
            <div className="card-head"><h3>가상 응답 분포</h3><em className="badge">AI 생성 데이터</em></div>
            {charts.length === 0 && <p className="empty">표시할 분포가 없어요.</p>}
            {charts.length > 0 && (
              <>
                <select className="select" value={chart?.id} onChange={(e) => setChartId(e.target.value)}>
                  {charts.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                {chart?.avg != null && <p className="avg">평균 {chart.avg}</p>}
                <div key={chart?.id}>
                  {chart?.items.map((it, k) => (
                    <div className="bar" key={it.label}>
                      <div className="bar-row"><span>{it.label}</span><span>{it.count}명 · {it.percent}%</span></div>
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${it.percent}%`, animationDelay: `${k * 0.08}s` }} /></div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        <section className="card wide">
          <div className="card-head"><h3>응답 미리보기</h3><em className="badge">{count}명 중 {Math.min(30, data.rows.length)}명</em></div>
          {data.rows.length === 0 ? <p className="empty">표시할 응답이 없어요.</p> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>{['#', '유형', '성실도', ...questions.map((q) => q.id)].map((h) => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {data.rows.slice(0, 30).map((r) => (
                    <tr key={r.respondent_id}>
                      <td>{r.respondent_id}</td><td>{r.type_name}</td><td>{r.quality}</td>
                      {questions.map((q) => <td key={q.id} className="cut">{show(r.answers?.[q.id])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card wide">
          <div className="card-head"><h3>구글폼에 제출</h3></div>
          <label className="check"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />내가 만든 테스트용 폼입니다</label>
          <div className="actions left">
            <Button disabled={!confirm || submitting || !data.rows.length} onClick={submit}>{submitting ? '제출 중...' : '제출하기'}</Button>
            <Button variant="secondary" onClick={() => go('home')}>처음으로</Button>
          </div>
          {msg && <p className="muted">{msg}</p>}
        </section>
      </main>
      <Footer />
    </div>
  );
}
