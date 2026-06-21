import Link from "next/link";

export default function HomePage() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Public multiplayer table</p>
        <h1>ONE / Один</h1>
        <p className="lede">
          A fast color and number card game for friends, public rooms, and
          private invites.
        </p>
        <div className="actions">
          <Link className="button primary" href="/lobby">
            Open lobby
          </Link>
          <Link className="button secondary" href="/register">
            Create account
          </Link>
        </div>
      </div>
      <div className="table-preview" aria-label="Card table preview">
        <div className="preview-card red">7</div>
        <div className="preview-card blue">R</div>
        <div className="preview-card green">2</div>
        <div className="preview-card yellow">S</div>
      </div>
    </section>
  );
}
