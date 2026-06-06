import { Icons } from "@/components/Icons";
import { data } from "@/data/portfolio";

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="made">
          Designed &amp; built by <strong>{data.name}</strong>
        </div>
        <div className="footer-social">
          <a
            className="icon-btn"
            href={"mailto:" + data.email}
            aria-label="Email"
          >
            <Icons.mail />
          </a>
          <a
            className="icon-btn"
            href={data.linkedin}
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
          >
            <Icons.linkedin />
          </a>
          <a
            className="icon-btn"
            href={data.github}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
          >
            <Icons.github />
          </a>
        </div>
        <div className="small">
          © {new Date().getFullYear()} · All rights reserved
        </div>
      </div>
    </footer>
  );
}
