import { z } from "zod";
import type { Database } from "@/types/database";

export type SectionType = Database["public"]["Enums"]["section_type"];

// A locale map ({"ar": "…", "en": "…"}); anything malformed degrades to {}.
const i18n = z.record(z.string(), z.string()).catch({});
const uuids = z.array(z.uuid()).catch([]);
const optionalUrl = z.string().min(1).nullish().catch(null);
const link = z.string().max(500).catch("/");

/**
 * Settings schema per section type (BLUEPRINT §6). The admin form is generated
 * from these; the public renderer parses with them so bad data never crashes a page.
 */
export const sectionSchemas = {
  hero_slider: z.object({
    slide_ids: uuids.default([]),
    autoplay: z.boolean().catch(true).default(true),
    interval: z.number().int().min(2000).max(20000).catch(6000).default(6000),
  }),
  about_intro: z.object({
    image_url: optionalUrl,
    body: i18n.default({}),
    cta: z.object({ label: i18n.default({}), link }).nullish().catch(null),
  }),
  objectives: z.object({
    layout: z.enum(["grid", "list"]).catch("grid").default("grid"),
    show_icons: z.boolean().catch(true).default(true),
  }),
  sectors_grid: z.object({
    columns: z.number().int().min(2).max(4).catch(4).default(4),
  }),
  latest_activities: z.object({
    count: z.number().int().min(1).max(12).catch(6).default(6),
    sector_id: z.uuid().nullish().catch(null),
  }),
  events_strip: z.object({
    count: z.number().int().min(1).max(12).catch(4).default(4),
  }),
  stats: z.object({
    items: z
      .array(z.object({ value: z.string().max(20), label: i18n.default({}), icon: z.string().nullish().catch(null) }))
      .catch([])
      .default([]),
  }),
  gallery: z.object({
    album_post_id: z.uuid().nullish().catch(null),
    media_ids: uuids.default([]),
  }),
  partners: z.object({
    media_ids: uuids.default([]),
  }),
  cta_banner: z.object({
    image_url: optionalUrl,
    text: i18n.default({}),
    button_label: i18n.default({}),
    link: link.default("/contact"),
  }),
  facebook_feed: z.object({}),
  request_cta: z.object({}),
  rich_text: z.object({
    body: z.record(z.string(), z.unknown()).catch({}).default({}),
  }),
} satisfies Record<SectionType, z.ZodType>;

export type SectionSettings<T extends SectionType> = z.infer<(typeof sectionSchemas)[T]>;
