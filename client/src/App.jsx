import { useEffect, useRef, useState } from 'react';
import Home from './screens/Home.jsx';
import Connect from './screens/Connect.jsx';
import Conditions from './screens/Conditions.jsx';
import Loading from './screens/Loading.jsx';
import Report from './screens/Report.jsx';
import { readForm, generate, buildCondition } from './api.js';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [link, setLink] = useState('');
  const [form, setForm] = useState(null); // 서버가 읽어온 문항
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [conditions, setConditions] = useState({ count: '', attrs: [] });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const abortRef = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const go = (s) => setScreen(s);

  // 1단계: 링크 → 문항 읽기
  const loadForm = async () => {
    setFormError('');
    setFormLoading(true);
    try {
      setForm(await readForm(link.trim()));
      setScreen('conditions');
    } catch (e) {
      setFormError(`폼을 읽지 못했어요: ${e.message}`);
    } finally {
      setFormLoading(false);
    }
  };

  // 2단계: 조건 → 가상 응답 생성
  const run = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError('');
    setResult(null);
    setScreen('loading');
    try {
      setResult(await generate(form, buildCondition(conditions), ctrl.signal));
      setScreen('report');
    } catch (e) {
      if (e.name === 'AbortError') return;
      setError(e.message || '알 수 없는 오류가 생겼어요.');
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setError('');
    setScreen('conditions');
  };

  let view;
  if (screen === 'connect') view = <Connect go={go} link={link} setLink={setLink} onNext={loadForm} loading={formLoading} error={formError} />;
  else if (screen === 'conditions') view = <Conditions go={go} form={form} value={conditions} setValue={setConditions} onRun={run} />;
  else if (screen === 'loading') view = <Loading go={go} error={error} onRetry={run} onCancel={cancel} />;
  else if (screen === 'report') view = <Report go={go} form={form} result={result} />;
  else view = <Home go={go} link={link} setLink={setLink} />;

  return <div key={screen} className="page-anim">{view}</div>;
}
