import { Icons } from "@/components/Icons";
import { data } from "@/data/portfolio";

export function Skills() {
  return (
    <section
      className="section"
      id="skills"
      style={{ background: "var(--surface-2)" }}
    >
      <div className="wrap">
        <div className="section-head reveal">
          <span className="section-num">02 — Skills</span>
          <h2 className="h2">What I work with.</h2>
        </div>
        <div className="skills-grid">
          {data.skills.map((s, i) => {
            const Ico = Icons[s.icon] ?? Icons.code;
            return (
              <div
                key={s.title}
                className={"card skill-card reveal" + (s.wide ? " wide" : "")}
                data-d={(i % 3) + 1}
              >
                <div className="sc-head">
                  <span className="sc-ico">
                    <Ico />
                  </span>
                  <h3>{s.title}</h3>
                </div>
                <div className="chips">
                  {s.items.map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
