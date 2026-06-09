import Link from "next/link";
import { Icons } from "@/components/Icons";
import { data, type Project } from "@/data/portfolio";

export function Projects() {
  return (
    <section className="section" id="projects">
      <div className="wrap">
        <div className="section-head reveal">
          <span className="section-num">03 — Projects</span>
          <h2 className="h2">Things I&apos;ve built.</h2>
        </div>
        <div className="proj-grid">
          {data.projects.map((p: Project, i) => {
            const Glyph = Icons[p.glyph] ?? Icons.code;
            return (
              <article
                key={p.title}
                className={"card proj reveal" + (p.feature ? " feature" : "")}
                data-d={i + 1}
              >
                <div className="proj-visual">
                  <div className="proj-mesh" />
                  <div className="proj-pat" />
                  <span className="proj-tag">{p.tag}</span>
                  <div className="proj-glyph">
                    <Glyph />
                  </div>
                </div>
                <div className="proj-body">
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                  <div className="proj-stack">
                    {p.stack.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="proj-links">
                    {p.route && (
                      <Link className="proj-link" href={p.route}>
                        <Icons.arrowUpRight /> View Project
                      </Link>
                    )}
                    {p.github && (
                      <a
                        className="proj-link"
                        href={p.github}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Icons.github /> Source
                      </a>
                    )}
                    {p.demo && (
                      <a
                        className="proj-link"
                        href={p.demo}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Icons.external /> Live Demo
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          <a
            className="card proj cta reveal"
            data-d="3"
            href={data.github}
            target="_blank"
            rel="noreferrer"
          >
            <Icons.github
              style={{ width: 30, height: 30, color: "var(--accent)" }}
            />
            <div className="big">More on GitHub</div>
            <p>Experiments, scripts &amp; works in progress.</p>
            <span className="btn btn-ghost">
              @{data.githubLabel} <Icons.arrowUpRight className="ar" />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
