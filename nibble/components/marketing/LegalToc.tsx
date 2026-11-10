"use client";

import { useEffect, useState } from "react";

type Entry = { id: string; label: string };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Índice de un documento legal: lee los <h2> del artículo, les asigna un id
 * y marca la sección visible. Sin JavaScript no aparece y el documento se lee
 * igual, así que el contenido sigue siendo JSX plano en cada página.
 */
export function LegalToc({ articleId }: { articleId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const article = document.getElementById(articleId);
    if (!article) return;
    const headings = [...article.querySelectorAll<HTMLHeadingElement>("h2")];
    const list = headings.map((h) => {
      if (!h.id) h.id = slugify(h.textContent ?? "");
      return { id: h.id, label: h.textContent ?? "" };
    });
    setEntries(list);

    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [articleId]);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="En este documento" className="text-sm">
      <p className="font-semibold text-mk-ink">En este documento</p>
      <ol className="mt-3">
        {entries.map((e) => {
          const current = e.id === active;
          return (
            <li key={e.id}>
              <a
                href={`#${e.id}`}
                aria-current={current ? "location" : undefined}
                className={`flex min-h-9 items-center gap-2.5 py-1 leading-snug transition-colors ${
                  current ? "font-semibold text-mk-ink" : "text-mk-muted hover:text-mk-ink"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-1.5 shrink-0 rounded-full transition-colors ${
                    current ? "bg-mk-magenta" : "bg-[color:var(--line-strong)]"
                  }`}
                />
                {e.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
