import React from "react";
import { Link } from "react-router-dom";
import { Nav, Footer, PageHeader } from "../components/layout";

export default function DocumentPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-foreground">
      <Nav active="/search" />
      <main className="flex-1 container pt-12 pb-16">
        <div className="flex items-start gap-4 mb-6">
          <span className="badge badge-synthetic">
            SYNTHETIC
          </span>
          <span className="ml-auto text-xs text-foreground-muted font-mono">
            Demo record — not legal authority
          </span>
        </div>

        <article className="card">
          <header className="card-header">
            <div className="flex items-start justify-between gap-6 mb-6">
              <div className="flex-1">
                <span className="inline-block text-xs font-semibold uppercase tracking-wider text-accent mb-2 block">
                  Republic Act
                </span>
                <h1 className="font-serif font-bold text-4xl text-ink leading-tight mb-3">
                  Synthetic Republic Act No. 99001
                </h1>
                <p className="text-lg text-foreground-secondary leading-relaxed">
                  An act establishing a synthetic registration duty for covered
                  entities operating within the jurisdiction of the Republic.
                </p>
              </div>
              <div className="text-right hidden md:block">
                <div className="text-xs font-semibold uppercase tracking-wider text-foreground-muted mb-1">
                  Document ID
                </div>
                <div className="font-mono text-sm text-ink">
                  SYN-99001-v1
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-foreground-secondary">
              <span className="px-3 py-1.5 rounded-md border border-surface-border bg-secondary">
                Jurisdiction: PH
              </span>
              <span className="px-3 py-1.5 rounded-md border border-surface-border bg-secondary">
                Verification: Pending Review
              </span>
              <span className="px-3 py-1.5 rounded-md border border-surface-border bg-secondary">
                Authority: Unofficial
              </span>
              <span className="px-3 py-1.5 rounded-md border border-surface-border bg-secondary">
                Status: In Force
              </span>
            </div>
          </header>

          <div className="card-body">
            <section className="mb-10 border-b border-surface-border pb-6">
              <h2 className="font-serif font-semibold text-3xl text-ink mb-6">
                Provisions
              </h2>
              <div className="space-y-0">
                {provisions.map((p) => (
                  <Provision key={p.number} number={p.number} text={p.text} />
                ))}
              </div>
            </section>

            <section className="mb-10 border-b border-surface-border pb-6">
              <h2 className="font-serif font-semibold text-3xl text-ink mb-6">
                Citation Relationships
              </h2>
              <p className="text-sm text-foreground-secondary mb-6 leading-relaxed">
                This synthetic document has no verified citation relationships
                in the demo corpus. Real legal documents would display citing
                and cited-by relationships here.
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <CitationGroup title="Citations" items={[]} />
                <CitationGroup title="Cited By" items={[]} />
              </div>
            </section>

            <section className="mb-10 border-b border-surface-border pb-6">
              <h2 className="font-serif font-semibold text-3xl text-ink mb-6">
                Version History
              </h2>
              <div className="overflow-hidden rounded-lg border border-surface-border">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th className="w-20">Version</th>
                      <th className="w-32">Effective From</th>
                      <th>Change Summary</th>
                      <th className="text-right w-32">Provisions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-mono text-xs text-ink">v1.0</td>
                      <td className="text-xs text-foreground-secondary">2019-02-01</td>
                      <td className="text-xs text-foreground-secondary">Initial ingestion</td>
                      <td className="text-xs text-foreground-secondary text-right">4 provisions</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="alert alert-info">
              <div className="flex items-start gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink">
                  Provenance
                </span>
                <div className="flex-1 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Source:</span>
                    <span className="font-mono text-ink">synthetic://fixture/RA-99001</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Verification status:</span>
                    <span className="badge badge-unknown">
                      UNKNOWN
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Authorization:</span>
                    <span className="font-mono text-foreground-secondary">Not authorized for real use</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-secondary">Legal advice:</span>
                    <span className="text-foreground-secondary">Not provided — demo only</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </article>

        <div className="mt-8 flex gap-3">
          <Link to="/search" className="btn-secondary">
            ← Back to Search
          </Link>
          <button className="btn-primary">Save to Research</button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

const provisions = [
  {
    number: 1,
    text:
      "This Act establishes a synthetic registration duty for all covered entities operating within the jurisdiction.",
  },
  {
    number: 2,
    text:
      "A covered entity must register with the synthetic authority within thirty (30) days of commencement of operations.",
  },
  {
    number: 3,
    text:
      "Registration requires submission of entity identification, principal place of business, and designated compliance officer.",
  },
  {
    number: 4,
    text:
      "Failure to register is subject to a synthetic administrative penalty as determined by the authority.",
  },
];

function Provision({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex gap-4 p-4 border-b border-surface-border last:border-0">
      <span className="font-mono font-medium text-foreground-muted w-20 shrink-0">
        Section {number}.
      </span>
      <span className="text-sm text-foreground leading-relaxed">{text}</span>
    </div>
  );
}

function CitationGroup({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div>
      <h4 className="font-semibold text-sm text-ink mb-3">{title}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-foreground-muted">None</p>
      ) : (
        <ul className="space-y-2 text-sm text-foreground-secondary">
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
