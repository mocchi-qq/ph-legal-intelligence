import React from "react";

export default function SavedPage() {
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
            <a href="/research" className="text-sm font-medium text-foreground-secondary hover:text-foreground px-3 py-2 border-b-2 border-transparent hover:border-accent transition-colors">
              Research
            </a>
            <a href="/saved" className="text-sm font-medium text-foreground px-3 py-2 border-b-2 border-accent transition-colors">
              Saved
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1 container py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold mb-2">Saved Research</h1>
            <p className="text-sm text-foreground-secondary">
              Your saved documents, citations, and research notes. This preview
              uses synthetic data only.
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800">
              This is a <strong>demo environment</strong>. All saved items below
              are explicitly synthetic records for demonstration purposes only.
            </p>
          </div>

          <div className="space-y-4">
            <SavedItem title="Synthetic Republic Act No. 99001" type="Document" tags={["Republic Act", "Registration"]} />
            <SavedItem title="Synthetic GR No. 88001" type="Court Decision" tags={["Contract", "Interpretation"]} />
            <SavedItem title="Synthetic Provisions §1-§4" type="Provision Set" tags={["RA 99001", "Sections"]} />
          </div>

          <p className="text-sm text-foreground-muted mt-8">
            No real legal documents are saved in this preview. Synthetic records
            are isolated from real legal authority.
          </p>
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

function SavedItem({ title, type, tags }: { title: string; type: string; tags: string[] }) {
  return (
    <div className="border border-surface-border rounded-lg p-4 bg-surface shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-serif text-lg font-semibold">{title}</h3>
          <p className="text-xs text-foreground-secondary">{type}</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-sm font-medium text-accent hover:text-accent-hover border border-surface-border rounded-md bg-background hover:bg-secondary transition-colors">
            Open
          </button>
          <button className="px-3 py-1.5 text-sm font-medium text-foreground-secondary hover:text-foreground border border-surface-border rounded-md bg-background hover:bg-secondary transition-colors">
            Remove
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {tags.map((tag) => (
          <span key={tag} className="px-2 py-1 rounded text-xs font-medium bg-accent-muted text-accent border border-accent/30">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
