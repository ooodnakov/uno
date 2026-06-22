import Link from "next/link";

export default function HomePage() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">LIVE CARD TABLE</p>
        <h1>Deal a fast table.</h1>
        <p className="lede">
          Create a room, invite friends, and play a server-checked round with
          10-second turns. Match color, call ONE, and beat the timer.
        </p>
        <div className="actions">
          <Link className="button primary" href="/lobby">
            Open lobby
          </Link>
          <Link className="button secondary" href="/register">
            Create account
          </Link>
        </div>
        <div className="hero-facts">
          <span>registered tables only</span>
          <span>2–6 players</span>
          <span>10s turns</span>
        </div>
      </div>
      <div className="table-preview" aria-label="Card table preview">
        <span className="preview-orbit-label">Host turn · 08s</span>
        <div className="preview-card red">7</div>
        <div className="preview-card blue">R</div>
        <div className="preview-card green">2</div>
        <div className="preview-card yellow">S</div>
      </div>
    </section>
  );
}
