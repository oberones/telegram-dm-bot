const cards = [
  {
    title: "Dashboard",
    body: "Operational overview for disputes, matches, health, and recent admin actions.",
  },
  {
    title: "Matches",
    body: "Inspect snapshots, event logs, and recovery actions for arbitration outcomes.",
  },
  {
    title: "Audit Log",
    body: "Track every sensitive moderation and operational action with searchable history.",
  },
];

export function App() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Dungeon Master Bot</p>
        <h1>Admin control room scaffold</h1>
        <p className="lede">
          This is the initial admin surface for the arbitration platform. It is intentionally thin:
          enough to establish the runtime, styling, and page shell before real data wiring begins.
        </p>
      </section>

      <section className="grid">
        {cards.map((card) => (
          <article className="card" key={card.title}>
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
