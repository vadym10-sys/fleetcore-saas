import Link from "next/link";
import type { ReactNode } from "react";

export const legalLinks = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/cookies", label: "Cookie Policy" },
  { href: "/data-processing", label: "Data Processing" },
  { href: "/data-requests", label: "Data Requests" },
];

export function LegalPage({ children, eyebrow, title }: { children: ReactNode; eyebrow: string; title: string }) {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <Link className="legal-back" href="/">FleetCore</Link>
        <span className="legal-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="legal-updated">Last updated: June 22, 2026</p>
        <div className="legal-body">{children}</div>
        <nav className="legal-footer-links" aria-label="Legal pages">
          {legalLinks.map((link) => (
            <Link href={link.href} key={link.href}>{link.label}</Link>
          ))}
        </nav>
      </section>
    </main>
  );
}
