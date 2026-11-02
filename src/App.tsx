const pillars = [
  { number: '01', title: 'Start an Anchor', detail: 'Put an idea, challenge, or skill into motion.' },
  { number: '02', title: 'Make an Iteration', detail: 'Build on someone’s work with your own execution.' },
  { number: '03', title: 'Grow the Tree', detail: 'See how contributions connect, evolve, and inspire.' },
];

function App() {
  return (
    <main className="shell">
      <nav className="topbar" aria-label="Main navigation">
        <a className="wordmark" href="/" aria-label="CREOVA home">
          <span className="mark">C</span>
          <span>CREOVA</span>
        </a>
        <span className="nav-note">THE ACTIVE SKILL NETWORK</span>
        <a className="sign-in" href="#get-started">Get started <span aria-hidden="true">↗</span></a>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span className="pulse" /> IDEAS ARE ONLY THE BEGINNING</div>
        <h1>Don't just watch<br />what's possible.<br /><em>Make it happen.</em></h1>
        <p className="intro">A network where people turn ideas into action, build on each other’s work, and leave proof of what they can do.</p>
        <a className="primary-cta" href="#how-it-works" id="get-started">Explore the movement <span aria-hidden="true">→</span></a>
        <div className="hero-foot"><span>CREATE</span><i /> <span>EXECUTE</span><i /> <span>EVOLVE</span><i /> <span>PROVE</span></div>
      </section>

      <section className="manifesto" id="how-it-works">
        <div className="section-kicker">A DIFFERENT KIND OF NETWORK</div>
        <h2>From passive scrolling<br />to <em>active creation.</em></h2>
        <div className="pillars">
          {pillars.map((item) => (
            <article className="pillar" key={item.number}>
              <span className="pillar-number">{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <footer><span>CREOVA © 2026</span><span>YOUR NEXT MOVE STARTS HERE.</span></footer>
    </main>
  );
}

export default App;