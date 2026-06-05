/**
 * Central content config for the portfolio.
 * Edit anything here — bio, jobs, skills, projects, links — and the site updates.
 */

export type SkillGroup = {
  category: string;
  /** monospace label shown above the group */
  label: string;
  items: string[];
};

export type Experience = {
  role: string;
  company: string;
  period: string;
  location: string;
  summary: string;
  highlights: string[];
};

export type Project = {
  title: string;
  description: string;
  tech: string[];
  links: { label: string; href: string }[];
  /** Tailwind gradient classes used for the card's accent glow */
  accent: string;
};

export type SocialLink = {
  label: string;
  href: string;
  /** key used to pick an icon in the UI */
  icon: "github" | "linkedin" | "mail";
};

export type Certification = {
  name: string;
  issuer: string;
  year: string;
};

export const personal = {
  name: "Hussein Kanaan",
  shortName: "Hussein",
  roles: ["IT Support Specialist", "Full-Stack Developer", "Problem Solver"],
  tagline:
    "I keep systems running and ship clean, fast web apps — bridging hands-on IT support with modern full-stack development.",
  location: "Lebanon",
  email: "kanaanbh@gmail.com",
  /** Path to your CV in /public. Drop a real file here to enable the download. */
  cv: "/hussein-kanaan-cv.pdf",
  initials: "HK",
};

export const about = {
  heading: "About",
  body: [
    "I'm a final-year Computer Science student at the Lebanese International University, based in Lebanon. I split my time between keeping people's tech working and building software that's a pleasure to use.",
    "On the support side, I've spent 2+ years troubleshooting Windows and macOS, fixing hardware and software issues, and keeping POS and ERP systems healthy. On the development side, I build full-stack web and mobile apps with React, Next.js, and Node — backed by Supabase, Firebase, and Postgres.",
    "I like problems that sit between systems and code: the kind where understanding the whole stack — from the help desk to the database — is what actually gets things fixed.",
  ],
  facts: [
    { label: "Location", value: "Lebanon" },
    { label: "Education", value: "Final-year CS @ LIU" },
    { label: "Focus", value: "IT Support + Full-Stack" },
    { label: "Open to", value: "Work & collaboration" },
  ],
};

export const experiences: Experience[] = [
  {
    role: "IT Support Specialist",
    company: "Omega Software",
    period: "2022 — Present",
    location: "Lebanon",
    summary:
      "Front-line technical support across hardware, software, and business-critical retail systems.",
    highlights: [
      "Diagnosed and resolved Windows and macOS issues for end users, reducing recurring tickets through documentation and quick fixes.",
      "Maintained and troubleshot hardware and software, from workstations and peripherals to network connectivity.",
      "Supported POS and ERP systems used in live retail environments, ensuring minimal downtime during business hours.",
      "Acted as the bridge between non-technical staff and technical resolution — translating problems into fixes.",
    ],
  },
];

export const skillGroups: SkillGroup[] = [
  {
    category: "Languages",
    label: "// languages",
    items: ["Python", "JavaScript", "TypeScript", "SQL"],
  },
  {
    category: "Frameworks",
    label: "// frameworks",
    items: ["React", "Next.js", "Node.js", "Express"],
  },
  {
    category: "Tools",
    label: "// tools",
    items: ["Git", "Supabase", "Firebase", "Expo"],
  },
  {
    category: "IT / Support",
    label: "// it & support",
    items: ["POS Systems", "ERP Systems", "Windows", "macOS"],
  },
];

export const certifications: Certification[] = [
  {
    name: "Google IT Support Professional Certificate",
    issuer: "Google",
    year: "2023",
  },
];

export const projects: Project[] = [
  {
    title: "SunSpot",
    description:
      "A mobile-first app for discovering the best spots to catch sunrises and sunsets, with location-aware recommendations and golden-hour timing.",
    tech: ["Next.js", "Expo", "Supabase", "PostGIS", "Mapbox"],
    links: [{ label: "View project", href: "#" }],
    accent: "from-accent-sunset to-accent-violet",
  },
  {
    title: "Jardin D'Amin Sales Dashboard",
    description:
      "An interactive sales analytics dashboard turning raw transaction data into clear, real-time charts and KPIs for decision-making.",
    tech: ["React", "Recharts", "JavaScript"],
    links: [{ label: "View project", href: "#" }],
    accent: "from-accent-blue to-accent-violet",
  },
  {
    title: "Notion Job Tracker",
    description:
      "A streamlined job-application tracker built on Notion — capturing applications, stages, and follow-ups in one organized workflow.",
    tech: ["Notion API", "JavaScript", "Automation"],
    links: [{ label: "View project", href: "#" }],
    accent: "from-accent-violet to-accent-blue",
  },
];

export const socials: SocialLink[] = [
  { label: "GitHub", href: "https://github.com/husseingpp", icon: "github" },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/",
    icon: "linkedin",
  },
  { label: "Email", href: "mailto:kanaanbh@gmail.com", icon: "mail" },
];

export const navLinks = [
  { label: "About", href: "#about" },
  { label: "Experience", href: "#experience" },
  { label: "Skills", href: "#skills" },
  { label: "Projects", href: "#projects" },
  { label: "Contact", href: "#contact" },
];
