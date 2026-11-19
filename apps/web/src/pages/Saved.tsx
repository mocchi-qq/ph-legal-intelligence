import React from "react";
import { Link } from "react-router-dom";
import { Nav, Footer, PageHeader, DemoBanner } from "../components/layout";

export default function SavedPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-foreground">
      <Nav active="/saved" />
      <main className="flex-1 container pt-12 pb-16">
        <PageHeader
          title="Saved Research"
          subtitle="Your saved documents, citations, and research notes. This preview uses synthetic data only."
        />

        <div className="alert alert-warning mb-8">
          <span className="text-xs font-medium uppercase tracking-wider text-warning">
            Demo Environment
          </span>
          <p className="text-xs text-warning mt-1">
            All saved items are explicitly synthetic records for demonstration
            purposes only. No real legal documents are saved in this preview.
          </p>
        </div>

        <div className="space-y-4">
          <SavedItem
            title="Synthetic Republic Act No. 99001"
            type="Document"
            tags={["Republic Act", "Registration"]}
            citation="Synthetic RA No. 99001"
          />
          <SavedItem
            title="Synthetic G.R. No. 88001"
            type="Court Decision"
            tags={["Contract", "Interpretation"]}
            citation="Synthetic G.R. No. 88001"
          />
          <SavedItem
            title="Synthetic Provisions §1-§4"
            type="Provision Set"
            tags={["RA 99001", "Sections"]}
            citation="Synthetic RA No. 99001, §1-§4"
          />
        </div>

        <div className="mt-12 p-6 border border-surface-border rounded-lg bg-secondary text-center">
          <p className="text-sm text-foreground-secondary">
            No real legal documents are saved in this preview. Synthetic records
            are isolated from real legal authority.
          </p>
        </div>

        <DemoBanner />
      </main>
      <Footer />
    </div>
  );
}

function SavedItem({
  title,
  type,
  tags,
  citation,
}: {
  title: string;
  type: string;
  tags: string[];
  citation: string;
}) {
  return (
    <div className="card p-5 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <Link to="/document" className="no-underline block">
            <h3 className="font-serif font-semibold text-lg text-ink group-hover:text-accent transition-colors mb-1">
              {title}
            </h3>
            <p className="text-xs text-foreground-secondary font-mono">
              {citation}
            </p>
          </Link>
          <p className="text-xs text-foreground-muted mt-1">
            {type} • Synthetic fixture
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/document" className="btn-ghost btn-sm text-xs px-3 py-2">
            Open
          </Link>
          <button className="btn-ghost btn-sm text-xs px-3 py-2 text-foreground-muted">
            Remove
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="px-2 py-1 rounded text-xs font-medium bg-accent-muted text-accent border border-accent/30">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
