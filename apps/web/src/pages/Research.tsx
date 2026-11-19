import React from "react";

export default function ResearchPage() {
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
          <nav className="md:flex items-center gap-6 hidden">
            <a href="/" className="text-sm font-medium text-foreground-secondary hover:text-foreground px-3 py-2 border-b-2 border-transparent hover:border-accent transition-colors">
              Home
            </a>
            <a href="/search" className="text-sm font-medium text-foreground-secondary hover:text-foreground px-3 py-2 border-b-2 border-transparent hover:border-accent transition-colors">
              Search
            </a>
            <a href="/research" className="text-sm font-medium text-foreground px-3 py-2 border-b-2 border-accent transition-colors">
              Research
            </a>
            <a href="/saved" className="text-sm font-medium text-foreground-secondary hover:text-foreground px-3 py-2 border-b-2 border-transparent hover:border-accent transition-colors">
              Saved
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 container py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold mb-2">Research Workspace</h1>
            <p className="text-sm text-foreground-secondary">
              Save research sessions, track citations, and organize legal
              authorities for extended research work.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="border border-surface-border rounded-lg p-6 bg-surface shadow-sm">
              <h3 className="font-serif text-lg font-bold mb-4">Active Research</h3>
              <div className="space-y-4">
                <ResearchItem title="Synthetic Republic Act No. 99001" preview="Registration duty for covered entities" />
                <ResearchItem title="Synthetic Court Decision GR-88001" preview="Contract interpretation case" />
              </div>
            </div>

            <div className="border border-surface-border rounded-lg p-6 bg-surface shadow-sm">
              <h3 className="font-serif text-lg font-bold mb-4">Saved Citations</h3>
              <div className="space-y-4">
                <CitationItem citation="Synthetic Republic Act No. 99001, §1" />
                <CitationItem citation="Synthetic GR No. 88001, ¶3" />
              </div>
            </div>

            <div className="border border-surface-border rounded-lg p-6 bg-surface shadow-sm">
              <h3 className="font-serif text-lg font-bold mb-4">Recent Activity</h3>
              <div className="space-y-4">
                <ActivityItem action="Viewed document" target="Synthetic Republic Act No. 99001" time="2 hours ago" />
                <ActivityItem action="Saved citation" target="Synthetic GR No. 88001" time="5 hours ago" />
              </div>
            </div>
          </div>

          <DemoNotice />
        </div>
      </main>

      <footer className="border-t border-surface-border bg-surface py-6 mt-auto">
        <div className="container px-4">
          <p className="text-sm text-foreground-muted text-center">
            Philippine Legal Intelligence Platform — Preview
          </p>
        </div>
      </footer>
    </div>
  );
}

function ResearchItem({ title, preview }: { title: string; preview: string }) {
  return (
    <div className="p-3 border border-surface-border rounded-md bg-background">
      <div className="flex justify-between items-start mb-1">
        <h4 className="font-semibold text-sm">{title}</h4>
        <button className="text-xs text-foreground-secondary hover:text-foreground">Open</button>
      </div>
      <p className="text-xs text-foreground-muted">{preview}</p>
    </div>
  );
}

function CitationItem({ citation }: { citation: string }) {
  return (
    <div className="flex items-center justify-between p-3 border border-surface-border rounded-md bg-background">
      <code className="text-xs text-foreground">{citation}</code>
      <button className="text-xs text-accent hover:text-accent-hover">Remove</button>
    </div>
  );
}

function ActivityItem({ action, target, time }: { action: string; target: string; time: string }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-foreground-muted">{action}</span>
      <span className="text-foreground">{target}</span>
      <span className="ml-auto text-foreground-muted">{time}</span>
    </div>
  );
}

function DemoNotice() {
  return (
    <div className="mt-8 p-6 bg-tertiary border border-surface-border rounded-lg">
      <h3 className="font-semibold mb-2">About this demo</h3>
      <p className="text-sm text-foreground-secondary mb-4">
        The research workspace demonstrates the platform architecture with
        synthetic data. Real legal documents require separate authorization
        and are not available in this preview.
      </p>
      <ul className="text-sm text-foreground-secondary space-y-2 list-disc pl-4">
        <li>All content shown is explicitly synthetic</li>
        <li>No real court decisions or statutes are exposed</li>
        <li>Synthetic content is not legal advice</li>
        <li>Authorization states remain unchanged</li>
      </ul>
    </div>
  );
}
