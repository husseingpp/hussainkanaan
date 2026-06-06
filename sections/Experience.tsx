import { data } from "@/data/portfolio";

export function Experience() {
  return (
    <section
      className="section"
      id="experience"
      style={{ background: "var(--surface-2)" }}
    >
      <div className="wrap">
        <div className="section-head reveal">
          <span className="section-num">04 — Experience</span>
          <h2 className="h2">Where I&apos;ve been.</h2>
        </div>
        <div className="exp-grid">
          <div className="exp-block reveal">
            <h3 className="exp-cat">Experience</h3>
            <div className="timeline">
              {data.experience.map((e, i) => (
                <div className="tl-item" key={i}>
                  <div className="tl-top">
                    <h4 className="tl-title">{e.title}</h4>
                    <span className="tl-date">{e.date}</span>
                  </div>
                  <div className="tl-org">
                    {e.orgUrl ? (
                      <a href={e.orgUrl} target="_blank" rel="noreferrer">
                        {e.org}
                      </a>
                    ) : (
                      e.org
                    )}
                  </div>
                  <ul className="tl-list">
                    {e.points.map((pt, j) => (
                      <li key={j}>{pt}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="exp-block reveal" data-d="1">
            <h3 className="exp-cat">Education</h3>
            <div className="timeline">
              {data.education.map((e, i) => (
                <div className="tl-item" key={i}>
                  <div className="tl-top">
                    <h4 className="tl-title">{e.title}</h4>
                    <span className="tl-date">{e.date}</span>
                  </div>
                  <div className="tl-org">{e.org}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="exp-block reveal" data-d="2">
            <h3 className="exp-cat">Certifications</h3>
            <div className="timeline">
              {data.certifications.map((c, i) => (
                <div className="tl-item" key={i}>
                  <div className="tl-top">
                    <h4 className="tl-title">{c.title}</h4>
                  </div>
                  <div className="cert-id">{c.id}</div>
                  <div className="tl-meta">{c.meta}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
