// 별사탕 PNG는 여백이 있어서 "보이는 크기(size)" 기준으로 잘라서 보여줘요.
export function Star({ size = 34, className = '' }) {
  const s = size / 849;
  return (
    <span
      className={`star-mark ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: 'url(/assets/characters/dummy-star.png)',
        backgroundSize: `${1254 * s}px ${1254 * s}px`,
        backgroundPosition: `${-201 * s}px ${-178 * s}px`,
      }}
    />
  );
}

export function Nav({ go, border = true }) {
  return (
    <header className={`gnb ${border ? 'border' : ''}`}>
      <div className="wrap gnb-inner">
        <button className="logo" onClick={() => go('home')}>
          <Star size={34} className="logo-star" />
          <span>Demo</span>
        </button>
        <nav className="gnb-links">
          <button
            onClick={() => {
              go('home');
              setTimeout(() => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' }), 50);
            }}
          >
            이용 방법
          </button>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <Star size={26} />
        <b>Demo</b>
        <span>대학생과 대학원생을 위한 설문 사전 점검</span>
      </div>
    </footer>
  );
}

export function Button({ variant = 'primary', children, ...rest }) {
  return (
    <button className={`btn btn-${variant}`} {...rest}>
      {children}
    </button>
  );
}

export function Chip({ selected, children, ...rest }) {
  return (
    <button className={`chip ${selected ? 'on' : ''}`} {...rest}>
      {children}
    </button>
  );
}

export function StepTabs({ active }) {
  const items = ['구글폼 연결', '응답 조건 설정', '점검 결과'];
  return (
    <div className="step-tabs">
      {items.map((label, i) => (
        <div key={label} className={`step-tab ${i === active ? 'on' : ''}`}>
          <span className="step-num">{i + 1}</span>
          {label}
        </div>
      ))}
    </div>
  );
}

export function PageHeader({ title, sub, eyebrow, action }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ id, children }) {
  return (
    <h2 className="section-title" id={id}>
      <i />
      <span>{children}</span>
      <i />
    </h2>
  );
}
