import React from "react";

export default function DocumentPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-foreground">
      <header className="border-b border-surface-border bg-surface sticky top-0 z-50">
        <div className="container flex items-center justify-between h-full px-4 py-3">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground-secondary hover:text-foreground border border-surface-border rounded-md bg-background hover:bg-secondary transition-colors">
              <span className="sr-only">Back</span>
              ←
            </button>
            <span className="font-serif text-lg font-bold text-accent tracking-tight">
              PHLI
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="/" className="text-sm font-medium text-foreground-secondary hover:text-foreground px-3 py-2 border-b-2 border-transparent hover:border-accent transition-colors">
              Home
            </a>
            <a href="/search" className="text-sm font-medium text-foreground-secondary hover:text-foreground px-3 py-2 border-b-2 border-transparent hover:border-accent transition-colors">
              Search
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-4 mb-6">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-synthetic-badge text-synthetic-text border border-synthetic-border">
              SYNTHETIC
            </span>
            <span className="ml-auto text-xs text-foreground-muted">
              Demo record — not legal authority
            </span>
          </div>

          <article className="bg-surface border border-surface-border rounded-lg shadow-sm">
            <header className="p-6 border-b border-surface-border">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className="inline-block text-xs font-medium text-accent uppercase tracking-wider mb-1">
                    Republic Act
                  </span>
                  <h1 className="font-serif text-3xl font-bold leading-tight mb-2">
                    Synthetic Republic Act No. 99001
                  </h1>
                  <p className="text-sm text-foreground-secondary">
                    An act establishing a synthetic registration duty for covered
                    entities.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-1">
                    Document ID
                  </div>
                  <div className="font-mono text-xs text-foreground">
                    SYN-99001-v1
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-foreground-secondary">
                <span className="px-2 py-1 rounded border border-surface-border bg-background">
                  Jurisdiction: PH
                </span>
                <span className="px-2 py-1 rounded border border-surface-border bg-background">
                  Verification: Pending Review
                </span>
                <span className="px-2 py-1 rounded border border-surface-border bg-background">
                  Authority: Unofficial
                </span>
                <span className="px-2 py-1 rounded border border-surface-border bg-background">
                  Status: In Force
                </span>
              </div>
            </header>

            <div className="p-6">
              <h2 className="font-serif text-xl font-semibold mb-4">Provisions</h2>
              <div className="space-y-3">
                <Provision number={1} text="This Act establishes a synthetic registration duty for all covered entities operating within the jurisdiction." />
                <Provision number={2} text="A covered entity must register with the synthetic authority within thirty (30) days of commencement of operations." />
                <Provision number={3} text="Registration requires submission of entity identification, principal place of business, and designated compliance officer." />
                <Provision number={4} text="Failure to register is subject to a synthetic administrative penalty as determined by the authority." />
              </div>
            </div>

            <section className="p-6 border-t border-surface-border">
              <h2 className="font-serif text-xl font-semibold mb-4">Citation Relationships</h2>
              <p className="text-sm text-foreground-secondary mb-4">
                This synthetic document has no verified citation relationships in
                the demo corpus. Real legal documents would display citing and
                cited-by relationships here.
              </p>
              <div className="flex items-center gap-2 text-sm text-foreground-muted">
                <span className="text-xs font-medium text-foreground-muted">Citations:</span>
                <span className="text-xs">None</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-foreground-muted mt-2">
                <span className="text-xs font-medium text-foreground-muted">Cited by:</span>
                <span className="text-xs">None</span>
              </div>
            </section>

            <section className="p-6 border-t border-surface-border">
              <h2 className="font-serif text-xl font-semibold mb-4">Version History</h2>
              <div className="border border-surface-border rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="px-4 py-3 font-medium text-foreground-secondary">Version</th>
                      <th className="px-4 py-3 font-medium text-foreground-secondary">Effective From</th>
                      <th className="px-4 py-3 font-medium text-foreground-secondary">Change Summary</th>
                      <th className="px-4 py-3 font-medium text-foreground-secondary">Provisions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-surface-border">
                      <td className="px-4 py-3 font-mono">v1.0</td>
                      <td className="px-4 py-3">2019-02-01</td>
                      <td className="px-4 py-3">Initial ingestion</td>
                      <td className="px-4 py-3">4 provisions</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="p-6 border-t border-surface-border bg-tertiary">
              <h2 className="font-serif text-xl font-semibold mb-4">Provenance & Verification</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-foreground-secondary">Source:</span>
                  <span className="font-mono text-xs">synthetic://fixture/RA-99001</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground-secondary">Verification status:</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-unknown-badge text-unknown-text border border-unknown-border">
                    UNKNOWN
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground-secondary">Authorization:</span>
                  <span className="font-mono text-xs">Not authorized for real use</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-foreground-secondary">Legal advice:</span>
                  <span className="text-xs">Not provided — demo only</span>
                </div>
              </div>
            </section>
          </article>
        </div>
      </main>

      <footer className="border-t border-surface-border bg-surface py-6 mt-auto">
        <div className="container flex items-center justify-between gap-4 px-4">
          <p className="text-sm text-foreground-muted">
            Philippine Legal Intelligence Platform — Preview
          </p>
        </div>
      </footer>
    </div>
  );
}

function Provision({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex gap-3 p-3 border-b border-surface-border last:border-0">
      <span className="font-mono font-medium text-foreground-muted w-12">
        Section {number}.
      </span>
      <span>{text}</span>
    </div>
  );
}
