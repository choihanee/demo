import { Nav, Footer, Button, StepTabs, PageHeader } from '../components/common.jsx';

export default function Connect({ go, link, setLink, onNext, loading, error }) {
  const ready = link.trim().length > 0 && !loading;
  return (
    <div className="page">
      <Nav go={go} />
      <main className="wrap main">
        <button className="back" onClick={() => go('home')}>← 처음 화면</button>
        <PageHeader title="새 설문 테스트" sub="구글폼 링크와 조사 대상을 입력해 주세요." />
        <StepTabs active={0} />
        <form className="card block" onSubmit={(e) => { e.preventDefault(); if (ready) onNext(); }}>
          <h2>구글폼 링크를 입력해 주세요</h2>
          <p className="muted">설문에 응답하는 사람이 열 수 있는 공유 링크를 사용해 주세요.</p>
          <label className="field-label" htmlFor="link">구글폼 공유 링크</label>
          <input id="link" className="field" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/forms/..." />
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <Button type="submit" disabled={!ready}>{loading ? '문항 읽는 중...' : '다음'}</Button>
          </div>
        </form>
      </main>
      <Footer />
    </div>
  );
}
