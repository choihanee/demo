import { useEffect, useState } from 'react';
import { Nav, Button } from '../components/common.jsx';

const A = '/assets/';
// 서버가 하는 일 순서(문항 분석 → 유형 구성 → 응답 생성 → 서술형 → 결측·불성실)에 맞춰 보여줘요.
const MESSAGES = ['문항을 분석하고 있어요', 'AI 응답자 유형을 구성하고 있어요', '객관식·분기 응답을 만드는 중이에요', 'AI가 서술형 답변을 쓰는 중이에요', '결측·불성실 응답을 반영하고 있어요'];

const sparkles = [
  { src: 'shine-01.png', x: 40, y: 60, d: 0 },
  { src: 'shine-02.png', x: 410, y: 40, d: 0.5 },
  { src: 'shine-03.png', x: 450, y: 250, d: 1 },
  { src: 'shine-04.png', x: 10, y: 270, d: 1.5 },
];
const confetti = [
  { src: 'confetti-01.png', x: 90, y: 20, d: 0.2 },
  { src: 'confetti-05.png', x: 380, y: 110, d: 0.8 },
  { src: 'confetti-02.png', x: 60, y: 170, d: 1.2 },
  { src: 'confetti-04.png', x: 430, y: 330, d: 0.5 },
];

export default function Loading({ go, error, onRetry, onCancel }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (error) return undefined;
    const t = setInterval(() => setI((n) => Math.min(n + 1, MESSAGES.length - 1)), 3500);
    return () => clearInterval(t);
  }, [error]);

  return (
    <div className="page loading-page">
      <Nav go={go} />
      <main className={`loading-main ${error ? 'paused' : ''}`}>
        <div className="loading-stage">
          {sparkles.map((s, k) => (
            <img key={k} className="ld-deco fx-twinkle" alt="" src={`${A}decorations/${s.src}`} style={{ left: s.x, top: s.y, animationDelay: `${s.d}s` }} />
          ))}
          {confetti.map((s, k) => (
            <img key={k} className="ld-deco fx-drift" alt="" src={`${A}decorations/${s.src}`} style={{ left: s.x, top: s.y, animationDelay: `${s.d}s` }} />
          ))}
          <img className="ld-jar" alt="더미 유리병" src={`${A}characters/dummy-jar.png`} />
          <img className="ld-star" alt="더미 별사탕" src={`${A}characters/dummy-star.png`} />
        </div>

        {error ? (
          <div className="ld-text">
            <h2>앗, 문제가 생겼어요</h2>
            <p>{error}</p>
            <div className="actions center">
              <Button variant="secondary" onClick={onCancel}>조건 다시 보기</Button>
              <Button onClick={onRetry}>다시 시도</Button>
            </div>
          </div>
        ) : (
          <div className="ld-text">
            <h2 key={i} className="ld-msg">{MESSAGES[i]}<span className="dots"><i>.</i><i>.</i><i>.</i></span></h2>
            <div className="ld-bar"><i /></div>
            <div className="actions center">
              <Button variant="secondary" onClick={onCancel}>취소</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
