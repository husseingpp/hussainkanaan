"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Icons } from "@/components/Icons";
import { Rich } from "@/components/Rich";
import { data } from "@/data/portfolio";

const PORTRAIT_KEY = "portfolio:portrait";

/** Drop-zone for a headshot; previews and persists the image locally. */
function Portrait() {
  const [src, setSrc] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(PORTRAIT_KEY);
      if (saved) setSrc(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function load(file?: File | null) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      setSrc(url);
      try {
        localStorage.setItem(PORTRAIT_KEY, url);
      } catch {
        /* image too large to persist — still shown for this session */
      }
    };
    reader.readAsDataURL(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    load(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="portrait-wrap reveal">
      <div className="portrait-frame" />
      <div className="portrait">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`${data.name} headshot`} />
        ) : (
          <button
            type="button"
            className={"portrait-drop" + (drag ? " drag" : "")}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            aria-label="Add a headshot"
          >
            <Icons.arrowUpRight />
            Drop your headshot
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => load(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

export function About() {
  return (
    <section className="section" id="about">
      <div className="wrap">
        <div className="section-head reveal">
          <span className="section-num">01 — About</span>
          <h2 className="h2">
            Bridging IT operations
            <br />
            and software quality.
          </h2>
        </div>
        <div className="about-grid">
          <Portrait />
          <div className="about-body reveal" data-d="1">
            {data.about.map((p, i) => (
              <p key={i}>
                <Rich text={p} />
              </p>
            ))}
            <div className="facts">
              <div className="fact">
                <div className="k">Location</div>
                <div className="v">{data.location}</div>
              </div>
              <div className="fact">
                <div className="k">Email</div>
                <div className="v">{data.email}</div>
              </div>
              <div className="fact">
                <div className="k">Phone</div>
                <div className="v">{data.phone}</div>
              </div>
              <div className="fact">
                <div className="k">Languages</div>
                <div className="v">English · Arabic</div>
              </div>
            </div>
            <div style={{ marginTop: 28 }}>
              <a className="btn btn-primary" href="#contact">
                Get In Touch <Icons.arrow className="ar" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
