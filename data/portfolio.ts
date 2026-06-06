/**
 * Central content config for the portfolio — Hussein Kanaan.
 * Edit anything here (bio, jobs, skills, projects, links) and the site updates.
 */

export type IconKey =
  | "server"
  | "tools"
  | "database"
  | "code"
  | "spark"
  | "sun"
  | "map";

export type SkillGroup = {
  title: string;
  icon: IconKey;
  items: string[];
  /** spans the full grid width */
  wide?: boolean;
};

export type Project = {
  title: string;
  tag: string;
  glyph: IconKey;
  feature?: boolean;
  desc: string;
  stack: string[];
  github?: string;
  demo?: string;
  /** Internal route to a dedicated project page (rendered via next/link). */
  route?: string;
};

export type ExperienceItem = {
  title: string;
  date: string;
  org: string;
  orgUrl?: string;
  points: string[];
};

export type EducationItem = {
  title: string;
  date: string;
  org: string;
};

export type Certification = {
  title: string;
  id: string;
  meta: string;
};

export type NavItem = { label: string; href: string };

export const data = {
  name: "Hussein Kanaan",
  monogram: "HK",
  greeting: "Hello, I'm",
  roles: ["IT Support Specialist", "Aspiring QA Engineer", "Database Administrator"],
  tagline:
    "IT Support Specialist with 2+ years supporting POS & ERP systems across 20+ F&B brands in Lebanon — now expanding into QA Engineering & Database Administration.",
  location: "Beirut, Lebanon",
  email: "kanaanbh@gmail.com",
  phone: "(961) 71-632417",
  phoneHref: "+96171632417",
  linkedin: "https://linkedin.com/in/hussain-kanaan",
  linkedinLabel: "hussain-kanaan",
  github: "https://github.com/husseingpp",
  githubLabel: "husseingpp",
  /** Path to your CV in /public. Drop a real file here to enable a download link. */
  cv: "/hussein-kanaan-cv.pdf",

  about: [
    "IT Support Specialist with 2+ years of hands-on experience supporting **Omega POS and ERP solutions** deployed across 20+ F&B brands in Lebanon, including high-volume enterprise accounts such as **Dunkin'** and **Burger King**.",
    "Adept at diagnosing complex system issues, configuring **Windows / Linux server environments**, and delivering end-user training. Certified in **Google IT Support**. Bilingual in English and Arabic.",
    "Actively expanding into **QA Engineering** and **Database Administration** — building toward a role where I can bridge operational IT knowledge with software quality and data reliability.",
  ],

  skills: [
    {
      title: "IT Support & Infrastructure",
      icon: "server",
      items: [
        "Windows / Linux / macOS",
        "LAN / WAN / TCP·IP",
        "DNS & DHCP",
        "Hardware Troubleshooting",
        "POS Systems",
        "Omega ERP",
        "Server Maintenance",
        "Backup & Recovery",
        "System Monitoring",
        "Cybersecurity Fundamentals",
      ],
    },
    {
      title: "Tools & Platforms",
      icon: "tools",
      items: [
        "Active Directory",
        "Office 365",
        "TeamViewer / AnyDesk",
        "Git",
        "Jira",
        "Slack",
        "Zoom",
        "IntelliJ",
        "Android Studio",
        "Bootstrap",
      ],
    },
    {
      title: "Databases",
      icon: "database",
      items: [
        "SQL",
        "SQLite",
        "PostgreSQL",
        "Supabase",
        "Database Troubleshooting",
        "Data Integrity",
      ],
    },
    {
      title: "Programming & Scripting",
      icon: "code",
      items: [
        "Java",
        "Python",
        "JavaScript",
        "SQL",
        "HTML / CSS",
        "React.js",
        "Bash",
        "Automation Scripts",
      ],
    },
    {
      title: "AI & Automation",
      icon: "spark",
      wide: true,
      items: ["AI-Assisted Development", "No-Code / Low-Code", "Workflow Automation"],
    },
  ] satisfies SkillGroup[],

  projects: [
    {
      title: "SunSpot · Golden Hour Explorer",
      tag: "Featured",
      glyph: "sun",
      feature: true,
      desc: "A community app for discovering, rating and sharing the best sunrise & sunset photography spots. Interactive maps, local golden-hour solar math, a live sky-suitability score from weather data, and community submissions — backed by a real Supabase (Postgres) database with row-level security. No AI; runs on free tiers.",
      stack: ["React Native", "Expo", "Supabase", "PostgreSQL", "MapLibre", "TanStack Query"],
      github: "https://github.com/husseingpp/hussainkanaan/tree/main/golden-hour-explorer",
      route: "/sunspot",
    },
    {
      title: "Google Maps Scraper",
      tag: "Tooling",
      glyph: "map",
      desc: "Python automation tool that collects structured business data from Google Maps — names, contacts, and locations — for research and lead workflows.",
      stack: ["Python", "Automation"],
      github: "https://github.com/husseingpp/google_maps_scraper",
    },
  ] satisfies Project[],

  experience: [
    {
      title: "IT Support Specialist",
      date: "2024 – Present",
      org: "Omega Software · Beirut, Lebanon",
      orgUrl: "https://omegapos.com",
      points: [
        "Provided end-to-end POS & ERP support for Omega Software — Lebanon's dominant F&B systems provider — with clients including Dunkin', Burger King, Lakkis, Grand Factory and Boneless, covering POS front-end, back-office and inventory modules.",
        "Handled high ticket volume across remote and on-site channels with consistently strong client satisfaction in operationally critical environments.",
        "Conducted on-site training for staff and managers on POS workflows, inventory control and back-office reporting.",
        "Configured, maintained and troubleshot Windows and Linux servers — ensuring uptime, data integrity and security compliance.",
        "Collaborated with development teams to test, validate and roll out software fixes and upgrades — gaining hands-on QA and regression testing exposure.",
      ],
    },
  ] satisfies ExperienceItem[],

  education: [
    {
      title: "B.Sc. in Computer Science",
      date: "Expected 2027",
      org: "Lebanese International University (LIU) · Beirut, Lebanon",
    },
  ] satisfies EducationItem[],

  certifications: [
    {
      title: "Google IT Support Professional Certificate",
      id: "ID: DXAB8348WM86",
      meta: "Network Protocols · Cloud Infrastructure · Debugging · IT Security · Customer Service",
    },
  ] satisfies Certification[],

  nav: [
    { label: "About", href: "#about" },
    { label: "Skills", href: "#skills" },
    { label: "Projects", href: "#projects" },
    { label: "Experience", href: "#experience" },
    { label: "Contact", href: "#contact" },
  ] satisfies NavItem[],
};

export type PortfolioData = typeof data;
