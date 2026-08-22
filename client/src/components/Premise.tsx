const POINTS = [
  {
    step: "01",
    title: "A tumour is not one thing",
    body: "Intratumour heterogeneity: within a single mass there are regions dense with tumour cells, regions with different cellular characteristics, and dead tissue. Biologically, it is several territories, not one.",
  },
  {
    step: "02",
    title: "A biopsy samples a sliver of it",
    body: "The needle removes a tiny fraction of the total volume. Whatever comes back on that core is what the lab sees — and what the tumour is then assumed to be.",
  },
  {
    step: "03",
    title: "So: was that sliver representative?",
    body: "If every pass lands in the same territory, the sample can miss the tumour's spatial diversity entirely. MRI already gives a map of that structure. The question is whether we use it when choosing where to sample.",
  },
];

/** The biological argument the simulation exists to test. */
export default function Premise() {
  return (
    <section className="mb-10">
      <h2 className="label-mono mb-4 text-ink-muted">The problem</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {POINTS.map((point, index) => (
          <article
            key={point.step}
            className="panel materialize rounded-2xl p-5 ring-1 ring-hairline"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <div className="label-mono mb-3 text-brand">{point.step}</div>
            <h3 className="title-2 mb-2 text-ink-primary">{point.title}</h3>
            <p className="caption text-ink-secondary">{point.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
