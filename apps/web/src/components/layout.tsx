import React from "react";
import { Link } from "react-router-dom";

interface NavProps {
  active?: string;
}

export function Nav({ active }: NavProps = {}) {
  return (
    <header className="border-b border-surface-border bg-surface sticky top-0 z-50 shadow-sm">
      <div className="container flex items-center justify-between h-full px-6 py-4">
        <div className="flex items-center gap-4 flex-shrink-0">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <div className="flex items-center gap-2 bg-ink p-2 rounded-md">
              <span className="text-xs font-bold tracking-wider text-white">PH</span>
            </div>
            <div>
              <span className="font-serif font-bold text-xl tracking-tight text-ink">PHLI</span>
              <span className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Philippine Legal Intelligence
              </span>
            </div>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <Link
            to="/"
            className={`text-sm font-medium transition-colors ${
              active === "/" ? "text-ink border-b-2 border-ink pb-1" : "text-foreground-secondary hover:text-ink border-b-2 border-transparent pb-1"
            }`}
          >
            Home
          </Link>
          <Link
            to="/search"
            className={`text-sm font-medium transition-colors ${
              active === "/search" ? "text-ink border-b-2 border-ink pb-1" : "text-foreground-secondary hover:text-ink border-b-2 border-transparent pb-1"
            }`}
          >
            Search
          </Link>
          <Link
            to="/research"
            className={`text-sm font-medium transition-colors ${
              active === "/research" ? "text-ink border-b-2 border-ink pb-1" : "text-foreground-secondary hover:text-ink border-b-2 border-transparent pb-1"
            }`}
          >
            Research
          </Link>
          <Link
            to="/saved"
            className={`text-sm font-medium transition-colors ${
              active === "/saved" ? "text-ink border-b-2 border-ink pb-1" : "text-foreground-secondary hover:text-ink border-b-2 border-transparent pb-1"
            }`}
          >
            Saved
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <button className="btn-ghost btn-sm md:hidden">
            <span className="sr-only">Open menu</span>
            ☰
          </button>
          <Link to="/search" className="btn-primary btn-sm hidden md:block">
            Search
          </Link>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-surface-border bg-surface mt-auto">
      <div className="container flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="bg-ink p-1.5 rounded-sm">
            <span className="text-[10px] font-bold tracking-wider text-white">PH</span>
          </div>
          <span className="text-sm font-semibold text-ink">PHLI</span>
        </div>
        <p className="text-sm text-foreground-muted">
          Philippine Legal Intelligence Platform — Preview. Synthetic data only.
        </p>
        <nav className="flex items-center gap-6 text-sm text-foreground-muted">
          <a href="#" className="hover:text-ink transition-colors">
            About
          </a>
          <a href="#" className="hover:text-ink transition-colors">
            Privacy
          </a>
          <a href="#" className="hover:text-ink transition-colors">
            Terms
          </a>
        </nav>
      </div>
    </footer>
  );
}

export function DemoBanner() {
  return (
    <section className="alert alert-info no-print">
      <div className="flex items-start gap-3">
        <span className="text-xs font-medium uppercase tracking-wider text-synthetic-text">
          Demo Mode
        </span>
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-synthetic-text mb-1">
            Synthetic Data — Not Legal Authority
          </h4>
          <p className="text-xs text-synthetic-text">
            This preview uses explicitly synthetic records to demonstrate the
            platform architecture. No real legal documents are exposed, and no
            synthetic content should be treated as verified legal authority or
            legal advice.
          </p>
        </div>
      </div>
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 className="font-serif font-bold text-4xl text-ink mb-2">{title}</h1>
        {subtitle && <p className="text-lg text-foreground-secondary">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-3">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif font-semibold text-3xl text-ink mb-6">
      {children}
    </h2>
  );
}

export function StatCard({
  value,
  label,
  delta,
}: {
  value: string;
  label: string;
  delta?: string;
}) {
  return (
    <div className="card p-6">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-sm text-foreground-muted uppercase tracking-wider font-semibold">
            {label}
          </p>
          <div className="font-serif font-bold text-3xl text-ink">{value}</div>
        </div>
        {delta && (
          <span className="text-xs font-medium bg-secondary text-foreground px-2 py-1 rounded-md">
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
