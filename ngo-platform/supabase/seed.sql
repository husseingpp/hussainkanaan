-- Seed content (BLUEPRINT Appendix A). The owner edits all of it in the admin.
-- UI strings are seeded separately from src/lib/i18n/defaults (seeds/ui_strings.sql).

-- Languages ---------------------------------------------------------------
insert into public.locales (code, name, dir, is_default, is_enabled, sort_order) values
  ('ar', 'العربية', 'rtl', true, true, 0),
  ('en', 'English', 'ltr', false, true, 1);

-- Settings & theme ----------------------------------------------------------
insert into public.site_settings (id, org_name, tagline, socials, footer_text, modules) values (
  1,
  '{"ar": "اسم الجمعية", "en": "Organization Name"}',
  '{"ar": "معًا من أجل تنمية مستدامة لمجتمعاتنا", "en": "Together for the sustainable development of our communities"}',
  '{"facebook": "https://www.facebook.com/share/14spsC744tT/"}',
  '{}',
  '{"requests": false, "donate": true, "facebook_feed": false}'
);

-- Placeholder green/earth palette; column defaults hold the same values.
insert into public.theme (id) values (1);

-- Sectors (القطاعات) ---------------------------------------------------------
insert into public.sectors (slug, name, sort_order, icon) values
  ('agriculture',    '{"ar": "القطاع الزراعي", "en": "Agriculture"}', 1, 'sprout'),
  ('tourism',        '{"ar": "القطاع السياحي", "en": "Tourism"}', 2, 'mountain'),
  ('environment',    '{"ar": "القطاع البيئي", "en": "Environment"}', 3, 'leaf'),
  ('women-children', '{"ar": "حقوق المرأة والطفل", "en": "Women''s & Children''s Rights"}', 4, 'heart-handshake'),
  ('social',         '{"ar": "القطاع الاجتماعي", "en": "Social"}', 5, 'users'),
  ('health',         '{"ar": "القطاع الصحي", "en": "Health"}', 6, 'heart-pulse'),
  ('education',      '{"ar": "القطاع التربوي", "en": "Education"}', 7, 'graduation-cap'),
  ('ai',             '{"ar": "الذكاء الاصطناعي", "en": "Artificial Intelligence"}', 8, 'cpu');

-- Objectives (أهدافنا) — 11 and 12 have no matching sector yet ---------------
insert into public.objectives (sort_order, sector_id, text)
select o.sort_order, s.id, o.text::jsonb
from (values
  (1,  'agriculture',    '{"ar": "تعزيز الأمن الغذائي ودعم الإنتاج المحلي.", "en": "Strengthening food security and supporting local production."}'),
  (2,  'tourism',        '{"ar": "تنمية القطاع السياحي وتعزيز السياحة الريفية.", "en": "Developing the tourism sector and promoting rural tourism."}'),
  (3,  'environment',    '{"ar": "حماية البيئة وصون الموارد الطبيعية.", "en": "Protecting the environment and conserving natural resources."}'),
  (4,  'environment',    '{"ar": "إدارة النفايات وتعزيز إعادة التدوير.", "en": "Waste management and promoting recycling."}'),
  (5,  'social',         '{"ar": "تعزيز السلامة والحماية الاجتماعية والتماسك المجتمعي.", "en": "Promoting safety, social protection and community cohesion."}'),
  (6,  'women-children', '{"ar": "تمكين المرأة والشباب وتعزيز مشاركتهم في التنمية.", "en": "Empowering women and youth and strengthening their role in development."}'),
  (7,  'women-children', '{"ar": "حماية حقوق المرأة والطفل وتعزيز المساواة وتكافؤ الفرص والحد من جميع أشكال التمييز والعنف.", "en": "Protecting women''s and children''s rights, promoting equality and equal opportunity, and reducing all forms of discrimination and violence."}'),
  (8,  'health',         '{"ar": "تعزيز الرعاية الصحية والتوعية والوقاية الصحية.", "en": "Promoting healthcare, health awareness and prevention."}'),
  (9,  'education',      '{"ar": "التعليم والتدريب المهني والحرفي وتنمية المهارات.", "en": "Education, vocational and craft training, and skills development."}'),
  (10, 'ai',             '{"ar": "توظيف الذكاء الاصطناعي والتحول الرقمي في التنمية.", "en": "Harnessing artificial intelligence and digital transformation for development."}'),
  (11, null,             '{"ar": "الحد من مخاطر الكوارث وتعزيز القدرة على الاستجابة وحالات الطوارئ.", "en": "Reducing disaster risk and strengthening emergency response capacity."}'),
  (12, null,             '{"ar": "تعزيز الطاقة المتجددة وكفاءة استخدام الطاقة.", "en": "Promoting renewable energy and energy efficiency."}')
) as o (sort_order, sector_slug, text)
left join public.sectors s on s.slug = o.sector_slug;

-- Homepage sections (default order) -----------------------------------------
insert into public.page_sections (page_key, section_type, sort_order, is_active, title, subtitle, settings) values
  ('home', 'hero_slider', 1, true, '{}', '{}',
    '{"slide_ids": [], "autoplay": true, "interval": 6000}'),
  ('home', 'about_intro', 2, true,
    '{"ar": "من نحن", "en": "About us"}', '{}',
    '{"image_url": null, "body": {"ar": "نبذة قصيرة عن الجمعية ورسالتها. يمكن تعديل هذا النص من لوحة التحكم.", "en": "A short introduction to the organization and its mission. Edit this text in the admin."}, "cta": {"label": {"ar": "تعرّف علينا", "en": "About us"}, "link": "/p/about"}}'),
  ('home', 'objectives', 3, true,
    '{"ar": "أهدافنا", "en": "Our objectives"}', '{}',
    '{"layout": "grid", "show_icons": true}'),
  ('home', 'sectors_grid', 4, true,
    '{"ar": "القطاعات", "en": "Sectors"}', '{}',
    '{"columns": 4}'),
  ('home', 'latest_activities', 5, true,
    '{"ar": "أحدث الأنشطة", "en": "Latest activities"}', '{}',
    '{"count": 6, "sector_id": null}'),
  ('home', 'events_strip', 6, true,
    '{"ar": "دعوات ومؤتمرات", "en": "Invitations & conferences"}', '{}',
    '{"count": 4}'),
  ('home', 'stats', 7, true,
    '{"ar": "أثرنا بالأرقام", "en": "Our impact in numbers"}', '{}',
    '{"items": []}'),
  ('home', 'partners', 8, false,
    '{"ar": "شركاؤنا", "en": "Our partners"}', '{}',
    '{"media_ids": []}'),
  ('home', 'facebook_feed', 9, false,
    '{"ar": "تابعونا على فيسبوك", "en": "Follow us on Facebook"}', '{}',
    '{}'),
  ('home', 'cta_banner', 10, true, '{}', '{}',
    '{"image_url": null, "text": {"ar": "هل لديك سؤال أو ترغب بالتعاون معنا؟", "en": "Have a question or want to work with us?"}, "button_label": {"ar": "تواصل معنا", "en": "Contact us"}, "link": "/contact"}');

-- Menu ------------------------------------------------------------------------
insert into public.nav_items (label, link_type, target, sort_order) values
  ('{"ar": "الرئيسية", "en": "Home"}', 'route', '/', 1),
  ('{"ar": "الأنشطة", "en": "Activities"}', 'route', '/activities', 2),
  ('{"ar": "دعوات ومؤتمرات", "en": "Invitations & conferences"}', 'route', '/events', 3),
  ('{"ar": "القطاعات", "en": "Sectors"}', 'route', '/sectors', 4),
  ('{"ar": "أهدافنا", "en": "Our objectives"}', 'route', '/objectives', 5),
  ('{"ar": "تواصل معنا", "en": "Contact"}', 'route', '/contact', 6);
