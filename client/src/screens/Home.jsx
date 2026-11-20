import { Nav, Footer, Button, SectionTitle } from '../components/common.jsx';

const A = '/assets/';

// hero 이미지 기준 좌표 (가로 1348 × 세로 755) · fx = 움직임 종류, d = 시작 지연(초)
const decos = [
  { src: 'decorations/awning-stripes.png', x: 0, y: -5, w: 1348, h: 36, fill: true },
  { src: 'decorations/candy-glass-blue.png', x: -7, y: 329, w: 155, h: 135, fx: 'fx-bob', d: 0.4 },
  { src: 'decorations/candy-glass-pink.png', x: 1225, y: 284, w: 164, h: 147, fx: 'fx-bob', d: 1.1 },
  { src: 'decorations/headline-candy-pink.png', x: 312, y: 150, w: 30, h: 59, fx: 'fx-drift', d: 0.2 },
  { src: 'decorations/headline-candy-lilac.png', x: 1022, y: 150, w: 31, h: 61, fx: 'fx-drift', d: 0.9 },
  { src: 'decorations/confetti-01.png', x: 158, y: 120, w: 21, h: 22, fx: 'fx-drift', d: 0.0 },
  { src: 'decorations/confetti-05.png', x: 1115, y: 120, w: 21, h: 22, fx: 'fx-drift', d: 0.6 },
  { src: 'decorations/confetti-02.png', x: 279, y: 194, w: 21, h: 22, fx: 'fx-drift', d: 1.2 },
  { src: 'decorations/confetti-06.png', x: 1237, y: 232, w: 21, h: 22, fx: 'fx-drift', d: 0.3 },
  { src: 'decorations/confetti-07.png', x: 1086, y: 383, w: 21, h: 22, fx: 'fx-drift', d: 1.5 },
  { src: 'decorations/confetti-04.png', x: 322, y: 495, w: 21, h: 22, fx: 'fx-drift', d: 0.8 },
  { src: 'decorations/confetti-05.png', x: 373, y: 461, w: 21, h: 22, fx: 'fx-drift', d: 1.8 },
  { src: 'decorations/shine-01.png', x: 195, y: 253, w: 24, h: 28, fx: 'fx-twinkle', d: 0.0 },
  { src: 'decorations/shine-02.png', x: 1198, y: 400, w: 24, h: 28, fx: 'fx-twinkle', d: 0.7 },
  { src: 'decorations/shine-03.png', x: 950, y: 497, w: 24, h: 28, fx: 'fx-twinkle', d: 1.4 },
  { src: 'decorations/shine-04.png', x: 1155, y: 508, w: 24, h: 28, fx: 'fx-twinkle', d: 0.4 },
];

const steps = [
  { n: '01', title: '설문 연결', desc: '구글폼 응답 링크를 입력해요.', cap: 'blue', icon: 'icon-01-connect.png' },
  { n: '02', title: '응답 조건', desc: '조사 대상과 응답 인원을 골라요.', cap: 'mint', icon: 'icon-02-respondents.png' },
  { n: '03', title: '테스트 실행', desc: '선택한 조건으로 설문을 돌려봐요.', cap: 'lilac', icon: 'icon-03-run.png' },
  { n: '04', title: '리포트 확인', desc: '응답 차트와 수정 제안을 확인해요.', cap: 'pink', icon: 'icon-04-report.png' },
];

export default function Home({ go, link, setLink }) {
  return (
    <div className="page home">
      <Nav go={go} border={false} />

      <section className="hero">
        <div className="stage">
          {decos.map((d, i) => (
            <img
              key={i}
              className={`abs ${d.fx || ''}`}
              alt=""
              src={A + d.src}
              style={{ left: d.x, top: d.y, width: d.w, height: d.h, objectFit: d.fill ? 'fill' : 'contain', animationDelay: `${d.d || 0}s` }}
            />
          ))}

          <div className="hero-badge rise" style={{ '--d': '0.05s' }}><i />AI 설문 사전 점검</div>
          <h1 className="hero-title rise" style={{ '--d': '0.15s' }}>
            설문 보내기 전에,<br />먼저 돌려봐요!
          </h1>
          <p className="hero-sub rise" style={{ '--d': '0.3s' }}>가상 응답으로 문항과 선택지를 미리 점검해요.</p>

          <form className="hero-input rise" style={{ '--d': '0.42s' }} onSubmit={(e) => { e.preventDefault(); go('connect'); }}>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="구글폼 응답 링크를 붙여넣어 주세요" />
            <Button type="submit">테스트 시작</Button>
          </form>

          <img className="abs fx-bob" alt="더미 유리병" src={A + 'characters/dummy-jar.png'} style={{ left: 445, top: 394, width: 391, height: 391 }} />
          <img className="abs fx-sway" alt="더미 별사탕" src={A + 'characters/dummy-star.png'} style={{ left: 730, top: 526, width: 219, height: 219, animationDelay: '0.5s' }} />
          <img className="abs fx-flash" alt="" src={A + 'decorations/mascot-spark-lines.png'} style={{ left: 910, top: 542, width: 38, height: 43 }} />
        </div>
      </section>

      <section className="how">
        <SectionTitle id="how">설문 테스트 이용 방법</SectionTitle>
        <div className="how-row">
          {steps.map((s, i) => (
            <div className="how-item" key={s.n}>
              <div className="how-card">
                <div className="how-cap" style={{ backgroundImage: `url(${A}decorations/step-capsule-${s.cap}.png)` }}>
                  <span className="how-num">{s.n}</span>
                  <img alt="" src={A + 'icons/' + s.icon} />
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
              {i < steps.length - 1 && <span className="how-arrow">›</span>}
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
