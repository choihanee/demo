import { Nav, Footer, Button, StepTabs, PageHeader } from '../components/common.jsx';

const MIN = 1;
const MAX = 200;
let seq = 0;
const uid = () => `${Date.now()}-${seq++}`;
const newOption = () => ({ id: uid(), label: '', pct: '' });
const newAttr = () => ({ id: uid(), name: '', options: [newOption(), newOption()] });
const sum = (a) => a.options.reduce((s, o) => s + (Number(o.pct) || 0), 0);
const isBlank = (a) => !a.name.trim() && a.options.every((o) => !o.label.trim() && o.pct === '');
// 조건 하나가 서버에 보내도 되는 상태인지: 이름이 있고, 항목이 1개 이상, 비율 합이 100
const attrOk = (a) => a.name.trim() && a.options.some((o) => o.label.trim()) && sum(a) === 100;

export default function Conditions({ go, form, value, setValue, onRun }) {
  const count = parseInt(value.count, 10);
  const countOk = Number.isInteger(count) && count >= MIN && count <= MAX;
  const attrs = value.attrs;
  const attrsOk = attrs.every((a) => isBlank(a) || attrOk(a));
  const ready = countOk && attrsOk && !!form;

  const onCount = (e) => {
    const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '');
    if (digits === '') return setValue({ ...value, count: '' });
    setValue({ ...value, count: String(Math.min(parseInt(digits, 10), MAX)) });
  };
  const setAttrs = (next) => setValue({ ...value, attrs: next });
  const patchAttr = (id, patch) => setAttrs(attrs.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const patchOpt = (aid, oid, patch) =>
    setAttrs(attrs.map((a) => (a.id === aid ? { ...a, options: a.options.map((o) => (o.id === oid ? { ...o, ...patch } : o)) } : a)));
  const onPct = (aid, oid, raw) => {
    const d = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    patchOpt(aid, oid, { pct: d === '' ? '' : String(Math.min(parseInt(d, 10), 100)) });
  };

  const sub = form ? `${form.form?.title || '제목 없는 설문'} · 문항 ${form.questions?.length ?? 0}개` : '먼저 구글폼 링크를 연결해 주세요.';

  return (
    <div className="page">
      <Nav go={go} />
      <main className="wrap main">
        <button className="back" onClick={() => go('connect')}>← 구글폼 연결</button>
        <PageHeader title="새 설문 테스트" sub={sub} />
        <StepTabs active={1} />
        <form className="card block" onSubmit={(e) => { e.preventDefault(); if (ready) onRun(); }}>
          <h2>어떤 응답자를 만나볼까요?</h2>
          <p className="muted">조건 이름과 항목은 자유롭게 적고, 항목별 비율은 합이 100이 되게 맞춰 주세요. 조건 없이도 실행할 수 있어요.</p>

          {attrs.map((a) => {
            const total = sum(a);
            return (
              <div className="attr" key={a.id}>
                <div className="attr-head">
                  <input className="field" value={a.name} onChange={(e) => patchAttr(a.id, { name: e.target.value })} placeholder="조건 이름" />
                  <span className={`attr-sum ${total === 100 ? 'ok' : 'bad'}`}>합 {total} / 100</span>
                  <button type="button" className="icon-btn" aria-label="조건 삭제" onClick={() => setAttrs(attrs.filter((x) => x.id !== a.id))}>✕</button>
                </div>
                {a.options.map((o) => (
                  <div className="opt-row" key={o.id}>
                    <input className="field" value={o.label} onChange={(e) => patchOpt(a.id, o.id, { label: e.target.value })} placeholder="항목" />
                    <input className="field pct" inputMode="numeric" value={o.pct} onChange={(e) => onPct(a.id, o.id, e.target.value)} placeholder="0" />
                    <span>%</span>
                    <button type="button" className="icon-btn" aria-label="항목 삭제" disabled={a.options.length <= 1} onClick={() => patchAttr(a.id, { options: a.options.filter((x) => x.id !== o.id) })}>✕</button>
                  </div>
                ))}
                <button type="button" className="add-btn" onClick={() => patchAttr(a.id, { options: [...a.options, newOption()] })}>+ 항목 추가</button>
              </div>
            );
          })}
          <button type="button" className="add-btn big" onClick={() => setAttrs([...attrs, newAttr()])}>+ 조건 추가</button>

          <label className="field-label" htmlFor="count" style={{ marginTop: 24 }}>가상 응답 인원</label>
          <div className="count-row">
            <input id="count" className="field count" inputMode="numeric" value={value.count} onChange={onCount} placeholder={`${MIN}~${MAX}`} />
            <span>명</span>
            <em className="hint">{MIN}명부터 {MAX}명까지 입력할 수 있어요.</em>
          </div>

          <div className="actions">
            <Button type="button" variant="secondary" onClick={() => go('connect')}>이전</Button>
            <Button type="submit" disabled={!ready}>설문 돌려보기</Button>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}
