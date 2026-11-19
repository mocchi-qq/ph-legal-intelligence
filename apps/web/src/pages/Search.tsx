import React from "react";

export default function SearchPage() {
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
            <a href="/research" className="text-sm font-medium text-foreground-secondary hover:text-foreground px-3 py-2 border-b-2 border-transparent hover:border-accent transition-colors">
              Research
            </a>
            <a href="/saved" className="text-sm font-medium text-foreground-secondary hover:text-foreground px-3 py-2 border-b-2 border-transparent hover:border-accent transition-colors">
              Saved
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold mb-2">Search Legal Authorities</h1>
            <p className="text-sm text-foreground-secondary">
              Search Philippine court decisions, statutes, regulations, and other
              legal authorities. Enter a citation (e.g., G.R. No. 123456, Republic
              Act No. 1001) or a natural-language query.
            </p>
          </div>

          <div className="bg-surface border border-surface-border rounded-lg p-6 shadow-sm mb-8">
            <form className="space-y-4">
              <div>
                <label htmlFor="query" className="block text-sm font-medium mb-2">
                  Search query
                </label>
                <input
                  id="query"
                  type="text"
                  className="w-full px-4 py-3 text-base border border-surface-border rounded-md focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-colors"
                  placeholder="e.g., G.R. No. 123456 or Republic Act No. 1001"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mode" className="block text-sm font-medium mb-2">
                    Retrieval mode
                  </label>
                  <select
                    id="mode"
                    className="w-full px-4 py-3 border border-surface-border rounded-md bg-background focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-colors"
                  >
                    <option value="standard">Standard (hybrid + rerank)</option>
                    <option value="quick">Quick lookup</option>
                    <option value="deep">Deep research</option>
                    <option value="statutory">Statutory matching</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="limit" className="block text-sm font-medium mb-2">
                    Max results
                  </label>
                  <select
                    id="limit"
                    className="w-full px-4 py-3 border border-surface-border rounded-md bg-background focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-colors"
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full px-6 py-3 bg-accent text-white rounded-md font-medium hover:bg-accent-hover transition-colors flex items-center justify-center gap-2"
              >
                <span className="sr-only">Search</span>
                🔍 Search
              </button>
            </form>
          </div>

          <SearchResults />

          <DemoNotice />
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

function SearchResults() {
  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4">Search Results</h2>
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-yellow-800">
          This is a <strong>demo environment</strong>. All search results shown
          below are explicitly synthetic records created for demonstration
          purposes only. They do not represent actual court decisions or
          statutes.
        </p>
      </div>
      <div className="space-y-4">
        <SyntheticResult />
        <SyntheticResult />
        <SyntheticResult />
      </div>
      <p className="text-sm text-foreground-muted mt-4">
        3 synthetic results displayed. No real legal documents are exposed in
        this preview.
      </p>
    </div>
  );
}

function SyntheticResult() {
  return (
    <div className="border border-surface-border rounded-lg p-4 bg-surface shadow-sm">
      <div className="flex items-start gap-2 mb-2">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-synthetic-badge text-synthetic-text border border-synthetic-border">
          SYNTHETIC
        </span>
        <span className="ml-auto text-xs text-foreground-muted">
          Demo record
        </span>
      </div>
      <h3 className="font-serif text-lg font-semibold mb-1">
        Synthetic Republic Act No. 99001
      </h3>
      <p className="text-sm text-foreground-secondary mb-3">
        An act establishing a synthetic registration duty for covered entities.
      </p>
      <div className="flex items-center gap-4 text-xs text-foreground-muted">
        <span>Document type: Republic Act</span>
        <span>Jurisdiction: PH</span>
        <span>Verification: Pending Review</span>
        <span>Status: Synthetic fixture</span>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="px-4 py-2 text-sm font-medium text-accent hover:text-accent-hover border border-surface-border rounded-md bg-background hover:bg-secondary transition-colors">
          View Details
        </button>
        <button className="px-4 py-2 text-sm font-medium text-foreground-secondary hover:text-foreground border border-surface-border rounded-md bg-background hover:bg-secondary transition-colors">
          Save
        </button>
      </div>
    </div>
  );
}

function DemoNotice() {
  return (
    <div className="mt-8 p-6 bg-tertiary border border-surface-border rounded-lg">
      <h3 className="font-semibold mb-2">About this demo</h3>
      <p className="text-sm text-foreground-secondary mb-4">
        The search interface demonstrates the platform architecture with
        synthetic data. Real legal documents require separate authorization
        and are not available in this preview.
      </p>
      <ul className="text-sm text-foreground-secondary space-y-2 list-disc pl-4">
        <li>All results are explicitly synthetic</li>
        <li>No real court decisions or statutes are exposed</li>
        <li>Synthetic content is not legal advice</li>
        <li>Authorization states remain unchanged</li>
      </ul>
    </div>
  );
}
