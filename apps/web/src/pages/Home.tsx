import React from "react";
import { Link } from "react-router-dom";
import { Nav, Footer, DemoBanner, PageHeader, StatCard } from "../components/layout";

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-foreground">
      <Nav active="/" />
      <main className="flex-1 container pt-12 pb-16">
        <PageHeader
          title="Philippine Legal Intelligence Platform"
          subtitle="A professional legal research platform for Philippine law. Search court decisions, statutes, regulations, and other legal authorities with verified provenance and clear citation tracking."
        />

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <StatCard value="0" label="Counsel Determinations" delta="Synthetic only" />
          <StatCard value="350" label="UNKNOWN Cells" delta="Authorization boundary" />
          <StatCard value="4" label="Blocked Pilot Documents" delta="No real corpus access" />
        </div>

        <SectionGrid />

        <DemoBanner />
      </main>
      <Footer />
    </div>
  );
}

function SectionGrid() {
  return (
    <section className="grid md:grid-cols-3 gap-6 mb-12">
      <CapabilityCard
        title="Search & Retrieval"
        description="Search Philippine legal authorities with lexical retrieval, metadata filtering, and point-in-time version selection."
        items={[
          "Lexical search across statutes and decisions",
          "Metadata filtering by court, year, jurisdiction",
          "Point-in-time version selection",
        ]}
      />
      <CapabilityCard
        title="Document Views"
        description="Open detailed views of court decisions, statutes, and regulations with provision-level navigation and citation relationships."
        items={[
          "Provision-level document structure",
          "Citation relationship mapping",
          "Version history tracking",
        ]}
      />
      <CapabilityCard
        title="Citation & Authority"
        description="Inspect citation relationships, version history, and authority state explanations with provenance tracking."
        items={[
          "Authority state: authorized / unauthorized / unknown",
          "Provenance and verification tracking",
          "Citation network visualization",
        ]}
      />
    </section>
  );
}

function CapabilityCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="card flex flex-col h-full">
      <div className="card-body flex-1">
        <h3 className="font-serif font-semibold text-2xl text-ink mb-4">{title}</h3>
        <p className="text-sm text-foreground-secondary mb-6 leading-relaxed">
          {description}
        </p>
        <ul className="space-y-3 text-sm">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-foreground-secondary">
              <span className="text-ink shrink-0">▹</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
