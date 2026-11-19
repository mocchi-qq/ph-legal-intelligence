import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Nav, Footer, DemoBanner, PageHeader } from "../components/layout";

export default function SearchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("standard");
  const [limit, setLimit] = useState("10");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const demo = location.search.includes("demo=true");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResults([
      {
        id: "syn-ra-99001",
        title: "Synthetic Republic Act No. 99001",
        type: "Republic Act",
        citation: "Synthetic RA No. 99001",
        snippet:
          "An act establishing a synthetic registration duty for all covered entities operating within the jurisdiction.",
        jurisdiction: "PH",
        status: "SYNTHETIC",
      },
      {
        id: "syn-gr-88001",
        title: "Synthetic G.R. No. 88001",
        type: "Court Decision",
        citation: "Synthetic G.R. No. 88001",
        snippet:
          "Contract interpretation case involving synthetic statutory construction principles.",
        jurisdiction: "PH",
        status: "SYNTHETIC",
      },
      {
        id: "syn-eo-77001",
        title: "Synthetic Executive Order No. 77001",
        type: "Executive Order",
        citation: "Synthetic EO No. 77001",
        snippet:
          "Administrative order establishing synthetic compliance procedures for covered agencies.",
        jurisdiction: "PH",
        status: "SYNTHETIC",
      },
    ]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white text-foreground">
      <Nav active="/search" />
      <main className="flex-1 container pt-12 pb-16">
        <PageHeader
          title="Search Legal Authorities"
          subtitle="Search Philippine court decisions, statutes, regulations, and other legal authorities."
          action={
            <Link to="/" className="btn-ghost btn-sm">
              ← Back to Home
            </Link>
          }
        />

        <div className="grid lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <SearchForm
              query={query}
              mode={mode}
              limit={limit}
              onQueryChange={setQuery}
              onModeChange={setMode}
              onLimitChange={setLimit}
              onSubmit={handleSubmit}
              loading={loading}
            />

            <DemoBanner />

            {results.length > 0 && (
              <SearchResults results={results} demo={demo} />
            )}
          </div>

          <aside className="lg:col-span-1 space-y-6">
            <SearchFilters demo={demo} />
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function SearchForm({
  query,
  mode,
  limit,
  onQueryChange,
  onModeChange,
  onLimitChange,
  onSubmit,
  loading,
}: {
  query: string;
  mode: string;
  limit: string;
  onQueryChange: (v: string) => void;
  onModeChange: (v: string) => void;
  onLimitChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}) {
  return (
    <div className="card p-6">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="query" className="block text-sm font-semibold text-foreground mb-2">
            Search query
          </label>
          <input
            id="query"
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="input"
            placeholder="e.g., G.R. No. 123456 or Republic Act No. 1001"
            disabled={loading}
          />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="mode" className="block text-sm font-semibold text-foreground mb-2">
              Retrieval mode
            </label>
            <select
              id="mode"
              value={mode}
              onChange={(e) => onModeChange(e.target.value)}
              className="select"
              disabled={loading}
            >
              <option value="standard">Standard (hybrid + rerank)</option>
              <option value="quick">Quick lookup</option>
              <option value="deep">Deep research</option>
              <option value="statutory">Statutory matching</option>
            </select>
          </div>
          <div>
            <label htmlFor="limit" className="block text-sm font-semibold text-foreground mb-2">
              Max results
            </label>
            <select
              id="limit"
              value={limit}
              onChange={(e) => onLimitChange(e.target.value)}
              className="select"
              disabled={loading}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>
    </div>
  );
}

function SearchResults({ results, demo }: { results: any[]; demo: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif font-semibold text-3xl text-ink">Search Results</h2>
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">
          {results.length} results
        </span>
      </div>

      {demo && (
        <div className="alert alert-warning mb-6">
          <span className="text-xs font-medium uppercase tracking-wider text-warning">
            Demo Environment
          </span>
          <p className="text-xs text-warning mt-1">
            All results are explicitly synthetic. No real legal documents are exposed.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {results.map((result) => (
          <SearchResultCard key={result.id} result={result} />
        ))}
      </div>
    </div>
  );
}

function SearchResultCard({ result }: { result: any }) {
  return (
    <div className="card p-5 hover:shadow-md transition-shadow group">
      <div className="flex items-start gap-3 mb-3">
        <span className="badge badge-synthetic">
          SYNTHETIC
        </span>
        <span className="ml-auto text-xs text-foreground-muted">
          Demo record
        </span>
      </div>

      <div className="flex justify-between items-start mb-2">
        <Link to="/document" className="no-underline block">
          <h3 className="font-serif font-semibold text-lg text-ink group-hover:text-accent transition-colors mb-1">
            {result.title}
          </h3>
          <p className="text-xs text-foreground-muted font-mono">
            {result.citation}
          </p>
        </Link>
        <div className="mt-1 flex gap-2">
          <Link to="/document" className="btn-ghost btn-sm text-xs">
            View
          </Link>
          <button className="btn-ghost btn-sm text-xs text-foreground-muted">
            Save
          </button>
        </div>
      </div>

      <p className="text-sm text-foreground-secondary leading-relaxed mb-4">
        {result.snippet}
      </p>

      <div className="flex items-center gap-4 text-xs text-foreground-muted">
        <span>Document type: {result.type}</span>
        <span>Jurisdiction: {result.jurisdiction}</span>
        <span>Verification: Pending Review</span>
        <span className="font-mono">Status: Synthetic fixture</span>
      </div>
    </div>
  );
}

function SearchFilters({ demo }: { demo: boolean }) {
  return (
    <div className="card p-5">
      <h3 className="font-serif font-semibold text-xl text-ink mb-4">Filters</h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Document Type
          </label>
          <div className="space-y-1">
            <FilterChip label="Republic Act" />
            <FilterChip label="Court Decision" />
            <FilterChip label="Executive Order" />
            <FilterChip label="Constitutional Provision" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Jurisdiction
          </label>
          <div className="space-y-1">
            <FilterChip label="PH" />
            <FilterChip label="Supreme Court" />
            <FilterChip label="Court of Appeals" />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-foreground-muted">
            Authority Status
          </label>
          <div className="space-y-1">
            <FilterChip label="Authorized" />
            <FilterChip label="Unknown" />
            <FilterChip label="Blocked" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <button className="w-full flex items-center justify-between px-3 py-2 text-sm text-foreground border border-surface-border rounded-md bg-surface hover:bg-secondary hover:border-accent transition-colors text-left">
      <span>{label}</span>
      <span className="text-xs text-foreground-muted">+</span>
    </button>
  );
}
