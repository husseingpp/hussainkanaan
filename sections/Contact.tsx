import { Icons } from "@/components/Icons";
import { data } from "@/data/portfolio";

export function Contact() {
  return (
    <section className="section contact" id="contact">
      <div className="wrap">
        <div className="reveal">
          <span
            className="section-num"
            style={{ display: "block", textAlign: "center" }}
          >
            05 — Contact
          </span>
          <h2 className="contact-big">
            Let&apos;s build
            <br />
            something <a href={"mailto:" + data.email}>together</a>.
          </h2>
        </div>
        <p className="contact-sub reveal" data-d="1">
          Whether you have a question, a project, or just want to say hi — my
          inbox is always open.
        </p>
        <div className="contact-links reveal" data-d="2">
          <a className="cl" href={"mailto:" + data.email}>
            <Icons.mail /> {data.email}
          </a>
          <a
            className="cl"
            href={data.linkedin}
            target="_blank"
            rel="noreferrer"
          >
            <Icons.linkedin /> {data.linkedinLabel}
          </a>
          <a className="cl" href={"tel:" + data.phoneHref}>
            <Icons.phone /> {data.phone}
          </a>
        </div>
        <div
          className="reveal"
          data-d="3"
          style={{
            marginTop: 34,
            color: "var(--text-faint)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            letterSpacing: ".1em",
          }}
        >
          <Icons.pin
            style={{ width: 14, height: 14, verticalAlign: "-2px", marginRight: 6 }}
          />
          {data.location}
        </div>
      </div>
    </section>
  );
}
