import React from "react";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-foreground">
      <header className="border-b border-surface-border bg-surface sticky top-0 z-50">
        <div className="container flex items-center justify-between h-full px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="font-serif text-2xl font-bold text-accent tracking-tight">
              PHLI
            </span>
            <span className="font-serif text-sm font-semibold text-foreground tracking-wider uppercase">
              Philippine Legal Intelligence
            </span>
          </div>
          <nav className="md:flex items-center gap-6 hidden">
            <a href="/" className="text-sm font-medium text-accent px-3 py-2 border-b-2 border-accent transition-colors">
              Home
            </a>
            <a href="/search" className="text-sm font-medium text-foreground-secondary hover:text-foreground px-3 py-2 border-b-2 border-transparent hover:border-accent transition-colors">
              Search
            </a>
            <a href="/research" className="text-sm font-medium text-foreground-secondary hover:text-foreground px-3 py-2 border-b-2 border-transparent hover:border-accent transition-colors">
              Research
            </a>
            <a href="/saved" className="text-sm font-medium text-foreground-secondary hover:text-foreground px-3 py-2 border-b-2 border-transparent hover:border-accent transition-colors">
              Saved
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground-secondary hover:text-foreground border border-surface-border rounded-md bg-background hover:bg-secondary transition-colors">
              <span className="sr-only">Open main menu</span>
              ☰
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <h1 className="font-serif text-4xl font-bold text-center mb-8">
          Philippine Legal Intelligence Platform
        </h1>

        <section className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-lg text-foreground-secondary mb-6">
            A professional legal research platform for Philippine law. Search
            court decisions, statutes, regulations, and other legal authorities
            with verified provenance and clear citation tracking.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/search"
              className="px-6 py-3 bg-accent text-white rounded-md font-medium hover:bg-accent-hover transition-colors"
            >
              Start Searching
            </a>
            <a
              href="/research"
              className="px-6 py-3 border border-surface-border text-foreground rounded-md font-medium hover:bg-secondary transition-colors"
            >
              Research Workspace
            </a>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6 mb-12">
          <CapabilityCard title="Search & Retrieval" description="Search Philippine legal authorities with lexical retrieval, metadata filtering, and point-in-time version selection." />
          <CapabilityCard title="Document Views" description="Open detailed views of court decisions, statutes, and regulations with provision-level navigation and citation relationships." />
          <CapabilityCard title="Citation & Authority" description="Inspect citation relationships, version history, and authority state explanations with provenance tracking." />
        </section>

        <DemoBanner />
      </main>

      <footer className="border-t border-surface-border bg-surface py-6 mt-auto">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 px-4">
          <p className="text-sm text-foreground-muted">
            Philippine Legal Intelligence Platform — Preview
          </p>
          <div className="flex items-center gap-6 text-sm text-foreground-muted">
            <a href="#" className="hover:text-foreground">About</a>
            <a href="#" className="hover:text-foreground">Privacy</a>
            <a href="#" className="hover:text-foreground">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function CapabilityCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="border border-surface-border rounded-lg bg-surface shadow-sm">
      <div className="border-b border-surface-border p-4">
        <h3 className="font-serif text-lg font-bold">{title}</h3>
      </div>
      <div className="p-4">
        <p className="text-sm text-foreground-secondary">{description}</p>
      </div>
    </div>
  );
}

function DemoBanner() {
  return (
    <section className="bg-secondary rounded-lg p-8 mb-12 border border-surface-border">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl font-bold mb-2">Demo Mode — Synthetic Data</h3>
          <p className="text-sm text-foreground-secondary">
            This preview uses explicitly synthetic records to demonstrate the
            platform architecture. No real legal documents are exposed, and no
            synthetic content should be treated as verified legal authority.
          </p>
        </div>
        <a
          href="/search?demo=true"
          className="px-4 py-2 border border-surface-border text-sm font-medium rounded-md text-foreground hover:bg-tertiary transition-colors"
        >
          Explore Demo
        </a>
      </div>
    </section>
  );
}
