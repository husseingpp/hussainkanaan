// Prints demo content SQL for a preview database. Not part of the real seed.
// Usage: node scripts/demo-sql.mjs https://host/base-path > /tmp/demo.sql
// Remove it again with the statements at the end of supabase/demo-cleanup.sql.
const base = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!base) throw new Error("Pass the public base URL that serves /demo/*.webp");

const q = (v) => `'${String(v).replaceAll("'", "''")}'`;
const j = (v) => `${q(JSON.stringify(v))}::jsonb`;
const doc = (...paras) => ({ type: "doc", content: paras.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })) });
const img = (n) => `${base}/demo/${n}.webp`;
const DEMO = "[demo]";

const images = ["hero-1", "hero-2", "act-1", "act-2", "act-3", "act-4", "act-5", "act-6", "evt-1", "evt-2"];
const alt = { ar: "صورة توضيحية", en: "Illustrative image" };

const posts = [
  {
    slug: "demo-olive-harvest", kind: "activity", cover: "act-1", album: ["act-1", "act-3", "act-5", "hero-2"], sectors: ["agriculture"], featured: true, days: 5,
    title: { ar: "يوم تطوعي لقطاف الزيتون مع المزارعين", en: "Volunteer day for the olive harvest" },
    excerpt: { ar: "شارك متطوعونا المزارعين المحليين موسم قطاف الزيتون ودعم الإنتاج المحلي.", en: "Our volunteers joined local farmers for the olive harvest, supporting local production." },
    body: {
      ar: doc("نظّمت الجمعية يومًا تطوعيًا شارك فيه عشرات الشباب إلى جانب المزارعين في قطاف الزيتون.", "هذا محتوى تجريبي للعرض فقط، ويمكن حذفه أو تعديله من لوحة التحكم."),
      en: doc("The organization held a volunteer day where dozens of young people helped farmers with the olive harvest.", "This is demo content for preview only and can be edited or deleted in the admin."),
    },
  },
  {
    slug: "demo-coastal-cleanup", kind: "activity", cover: "act-2", album: ["act-2", "act-6", "act-4"], sectors: ["environment"], days: 18,
    title: { ar: "حملة تنظيف الشاطئ وفرز النفايات", en: "Beach clean-up and waste sorting campaign" },
    excerpt: { ar: "جمعنا النفايات من الشاطئ وقدّمنا ورشة عن الفرز وإعادة التدوير.", en: "We cleared litter from the beach and ran a workshop on sorting and recycling." },
    body: {
      ar: doc("شارك في الحملة طلاب وعائلات من المنطقة، وتم فرز النفايات لإعادة تدويرها.", "محتوى تجريبي للعرض."),
      en: doc("Students and families from the area took part, and the waste was sorted for recycling.", "Demo content for preview."),
    },
  },
  {
    slug: "demo-health-awareness", kind: "activity", cover: "act-4", album: ["act-4", "act-3"], sectors: ["health", "women-children"], days: 40,
    title: { ar: "جلسة توعية صحية للأمهات", en: "Health awareness session for mothers" },
    excerpt: { ar: "جلسة حول الوقاية الصحية وتغذية الأطفال بالتعاون مع ممرضات متطوعات.", en: "A session on prevention and child nutrition with volunteer nurses." },
    body: { ar: doc("قدّمت ممرضات متطوعات نصائح عملية حول الوقاية والتغذية السليمة.", "محتوى تجريبي للعرض."), en: doc("Volunteer nurses shared practical advice on prevention and healthy nutrition.", "Demo content for preview.") },
  },
  {
    slug: "demo-digital-skills", kind: "activity", cover: "act-5", album: ["act-5", "act-1", "act-6"], sectors: ["education", "ai"], days: 75,
    title: { ar: "دورة المهارات الرقمية للشباب", en: "Digital skills course for youth" },
    excerpt: { ar: "دورة من أربعة أسابيع حول أساسيات الحاسوب وأدوات الذكاء الاصطناعي.", en: "A four-week course on computer basics and AI tools." },
    body: { ar: doc("تعلّم المشاركون استخدام أدوات رقمية تساعدهم في الدراسة والعمل.", "محتوى تجريبي للعرض."), en: doc("Participants learned digital tools that help with study and work.", "Demo content for preview.") },
  },
  {
    slug: "demo-rural-tourism-forum", kind: "event", cover: "evt-1", album: ["evt-1", "hero-1"], sectors: ["tourism"], days: 10, eventIn: 21,
    title: { ar: "المشاركة في منتدى السياحة الريفية", en: "Taking part in the Rural Tourism Forum" },
    excerpt: { ar: "دعوة للمشاركة في منتدى إقليمي حول تنمية السياحة الريفية.", en: "An invitation to a regional forum on developing rural tourism." },
    location: { ar: "بيروت", en: "Beirut" },
    body: { ar: doc("ستشارك الجمعية بعرض عن تجاربها في دعم السياحة الريفية.", "محتوى تجريبي للعرض."), en: doc("The organization will present its experience supporting rural tourism.", "Demo content for preview.") },
  },
  {
    slug: "demo-climate-conference", kind: "event", cover: "evt-2", album: ["evt-2"], sectors: ["environment"], days: 50, eventIn: -45,
    title: { ar: "مؤتمر العمل المناخي المحلي", en: "Local Climate Action Conference" },
    excerpt: { ar: "شاركنا في جلسة حوارية حول دور الجمعيات في العمل المناخي.", en: "We joined a panel on the role of NGOs in climate action." },
    location: { ar: "صيدا", en: "Saida" },
    body: { ar: doc("ناقش المشاركون حلولًا محلية للتكيّف مع التغير المناخي.", "محتوى تجريبي للعرض."), en: doc("Participants discussed local solutions for adapting to climate change.", "Demo content for preview.") },
  },
  {
    slug: "demo-new-website", kind: "news", cover: "hero-1", album: [], sectors: [], days: 1,
    title: { ar: "إطلاق الموقع الجديد للجمعية", en: "Launching our new website" },
    excerpt: { ar: "موقعنا الجديد متاح بالعربية والإنجليزية.", en: "Our new website is available in Arabic and English." },
    body: { ar: doc("نسخة تجريبية من الموقع الجديد."), en: doc("A preview of the new website.") },
  },
];

const day = (n) => `now() - interval '${n} days'`;
const date = (n) => `(current_date + ${n})`;
const out = [];
out.push("-- DEMO CONTENT for the preview site. Generated by scripts/demo-sql.mjs.");
out.push("begin;");
out.push(`insert into public.media (storage_path, url, width, height, alt) values\n${images.map((n) => `  (${q(`${DEMO}/${n}`)}, ${q(img(n))}, 1600, 1000, ${j(alt)})`).join(",\n")}\non conflict (storage_path) do update set url = excluded.url;`);
out.push(`insert into public.hero_slides (image_url, title, subtitle, cta_label, cta_link, overlay_opacity, text_position, sort_order) values
  (${q(img("hero-1"))}, ${j({ ar: "معًا من أجل مجتمعات أقوى", en: "Together for stronger communities" })}, ${j({ ar: "نسخة تجريبية من الموقع — المحتوى المعروض للعرض فقط", en: "Preview site — the content shown is for demonstration only" })}, ${j({ ar: "تصفّح أنشطتنا", en: "Browse our activities" })}, '/activities', 35, 'start', 1),
  (${q(img("hero-2"))}, ${j({ ar: "ندعم المزارعين والإنتاج المحلي", en: "Supporting farmers and local production" })}, ${j({ ar: "من الحقل إلى المائدة", en: "From the field to the table" })}, ${j({ ar: "القطاع الزراعي", en: "Agriculture" })}, '/sectors/agriculture', 40, 'start', 2);`);
for (const p of posts) {
  out.push(`with p as (
  insert into public.posts (kind, slug, title, excerpt, body, cover_media_id, event_date, location, status, published_at, is_featured)
  values ('${p.kind}', ${q(p.slug)}, ${j(p.title)}, ${j(p.excerpt)}, ${j(p.body)},
    (select id from public.media where storage_path = ${q(`${DEMO}/${p.cover}`)}),
    ${p.eventIn != null ? date(p.eventIn) : "null"}, ${p.location ? j(p.location) : "null"}, 'published', ${day(p.days)}, ${p.featured ? "true" : "false"})
  returning id
), s as (
  insert into public.post_sectors (post_id, sector_id) select p.id, sec.id from p, public.sectors sec where sec.slug = any(array[${p.sectors.map(q).join(", ") || "''"}])
)
insert into public.post_media (post_id, media_id, sort_order, caption)
select p.id, m.id, a.ord, ${j({ ar: "صورة من النشاط", en: "Photo from the activity" })}
from p, unnest(array[${p.album.map((n) => q(`${DEMO}/${n}`)).join(", ") || "''"}]) with ordinality as a(path, ord)
join public.media m on m.storage_path = a.path;`);
}
out.push(`insert into public.pages (slug, title, body, status, show_in_nav) values ('about', ${j({ ar: "من نحن", en: "About us" })}, ${j({
  ar: doc("جمعية أهلية تعمل على التنمية المستدامة في الزراعة والسياحة والبيئة والصحة والتعليم وحقوق المرأة والطفل.", "هذا نص تجريبي يمكن استبداله من لوحة التحكم."),
  en: doc("A community organization working on sustainable development in agriculture, tourism, the environment, health, education, and women's and children's rights.", "This is placeholder text that can be replaced in the admin."),
})}, 'published', false) on conflict (slug) do nothing;`);
out.push(`update public.page_sections set settings = ${j({ items: [
  { value: "120+", label: { ar: "نشاطًا ميدانيًا", en: "Field activities" }, icon: "calendar-check" },
  { value: "8", label: { ar: "قطاعات عمل", en: "Sectors" }, icon: "layout-grid" },
  { value: "900+", label: { ar: "متطوعًا ومتطوعة", en: "Volunteers" }, icon: "users" },
  { value: "35", label: { ar: "بلدة وقرية", en: "Towns and villages" }, icon: "map-pin" },
] })} where page_key = 'home' and section_type = 'stats';`);
out.push("commit;");
console.log(out.join("\n\n"));
