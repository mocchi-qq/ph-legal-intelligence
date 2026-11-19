import React from "react";
import { Link } from "react-router-dom";
import { Nav, Footer, PageHeader, DemoBanner } from "../components/layout";

export default function ResearchPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-foreground">
      <Nav active="/research" />
      <main className="flex-1 container pt-12 pb-16">
        <PageHeader
          title="Research Workspace"
          subtitle="Save research sessions, track citations, and organize legal authorities for extended research work."
        />

        <div className="grid lg:grid-cols-4 gap-6 mb-8">
          <div className="lg:col-span-3 space-y-6">
            <ActiveResearchCard />
            <SavedCitationsCard />
            <RecentActivityCard />
          </div>

          <aside className="lg:col-span-1 space-y-6">
            <WorkspaceInfoCard />
          </aside>
        </div>

        <DemoBanner />
      </main>
      <Footer />
    </div>
  );
}

function ActiveResearchCard() {
  const items = [
    {
      title: "Synthetic Republic Act No. 99001",
      preview: "Registration duty for covered entities",
      type: "Republic Act",
    },
    {
      title: "Synthetic G.R. No. 88001",
      preview: "Contract interpretation case",
      type: "Court Decision",
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-serif font-semibold text-2xl text-ink">Active Research</h3>
      </div>
      <div className="card-body space-y-4">
        {items.map((item) => (
          <ResearchItem key={item.title} item={item} />
        ))}
        <div className="pt-4 border-t border-surface-border">
          <p className="text-xs text-foreground-muted">
            No real legal documents in active research.
          </p>
        </div>
      </div>
    </div>
  );
}

function SavedCitationsCard() {
  const items = [
    "Synthetic Republic Act No. 99001, §1",
    "Synthetic G.R. No. 88001, ¶3",
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-serif font-semibold text-2xl text-ink">Saved Citations</h3>
      </div>
      <div className="card-body space-y-3">
        {items.map((citation) => (
          <CitationItem key={citation} citation={citation} />
        ))}
      </div>
    </div>
  );
}

function RecentActivityCard() {
  const items = [
    { action: "Viewed document", target: "Synthetic Republic Act No. 99001", time: "2 hours ago" },
    { action: "Saved citation", target: "Synthetic G.R. No. 88001", time: "5 hours ago" },
    { action: "Opened document", target: "Synthetic Executive Order No. 77001", time: "1 day ago" },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="font-serif font-semibold text-2xl text-ink">Recent Activity</h3>
      </div>
      <div className="card-body space-y-3">
        {items.map((item) => (
          <ActivityItem key={item.target} item={item} />
        ))}
      </div>
    </div>
  );
}

function WorkspaceInfoCard() {
  return (
    <div className="card p-5">
      <h3 className="font-serif font-semibold text-xl text-ink mb-4">Workspace Info</h3>
      <div className="space-y-4 text-sm text-foreground-secondary">
        <div className="flex justify-between items-start">
          <span className="text-foreground-muted">Synthetic Records:</span>
          <span className="font-mono text-ink">3</span>
        </div>
        <div className="flex justify-between items-start">
          <span className="text-foreground-muted">Real Documents:</span>
          <span className="font-mono text-ink">0</span>
        </div>
        <div className="flex justify-between items-start">
          <span className="text-foreground-muted">Authorization State:</span>
          <span className="badge badge-unknown">UNKNOWN</span>
        </div>
        <div className="pt-4 border-t border-surface-border">
          <p className="text-xs text-foreground-muted">
            All content in this workspace is explicitly synthetic and isolated
            from real legal authority.
          </p>
        </div>
      </div>
    </div>
  );
}

function ResearchItem({ item }: { item: { title: string; preview: string; type: string } }) {
  return (
    <div className="p-4 border border-surface-border rounded-lg bg-secondary hover:bg-tertiary transition-colors cursor-pointer group">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-serif font-semibold text-sm text-ink group-hover:text-accent transition-colors">
          {item.title}
        </h4>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
          {item.type}
        </span>
      </div>
      <p className="text-xs text-foreground-secondary">{item.preview}</p>
    </div>
  );
}

function CitationItem({ citation }: { citation: string }) {
  return (
    <div className="flex items-center justify-between p-3 border border-surface-border rounded-md bg-surface">
      <code className="font-mono text-xs text-ink">{citation}</code>
      <button className="text-xs text-accent hover:text-accent-hover underline decoration-1 decoration-dashed">
        Remove
      </button>
    </div>
  );
}

function ActivityItem({ item }: { item: { action: string; target: string; time: string } }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <div className="w-24 text-foreground-secondary font-medium">
        {item.action}
      </div>
      <div className="flex-1 text-foreground">{item.target}</div>
      <span className="text-foreground-muted">{item.time}</span>
    </div>
  );
}
