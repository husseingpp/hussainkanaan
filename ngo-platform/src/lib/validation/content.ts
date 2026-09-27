import { z } from "zod";
import { SLUG_PATTERN } from "@/lib/slug";

// Shared by the admin forms (and, on Cloudflare, by server actions).
// The DB constraints remain the last line of defence.
const i18n = z.record(z.string(), z.string());
const doc = z.record(z.string(), z.unknown());
const slug = z.string().regex(SLUG_PATTERN, "slug").max(120);
const uuid = z.uuid();

export const postSchema = z
  .object({
    id: uuid.optional(),
    kind: z.enum(["activity", "event", "news"]),
    slug,
    title: i18n,
    excerpt: i18n,
    body: doc,
    cover_media_id: uuid.nullable(),
    event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    location: i18n.nullable(),
    status: z.enum(["draft", "published"]),
    is_featured: z.boolean(),
    sector_ids: z.array(uuid),
    album: z.array(z.object({ media_id: uuid, caption: i18n })).max(200),
  })
  .refine((p) => Object.values(p.title).some((v) => v.trim()), { path: ["title"], message: "required" });

export const sectorSchema = z
  .object({
    id: uuid.optional(),
    slug,
    name: i18n,
    description: i18n,
    icon: z.string().max(40).nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable(),
    cover_image: z.string().url().nullable(),
    is_active: z.boolean(),
  })
  .refine((s) => Object.values(s.name).some((v) => v.trim()), { path: ["name"], message: "required" });

export const objectiveSchema = z
  .object({
    id: uuid.optional(),
    text: i18n,
    icon: z.string().max(40).nullable(),
    sector_id: uuid.nullable(),
    is_active: z.boolean(),
  })
  .refine((o) => Object.values(o.text).some((v) => v.trim()), { path: ["text"], message: "required" });

export const pageSchema = z
  .object({
    id: uuid.optional(),
    slug,
    title: i18n,
    body: doc,
    cover_image: z.string().url().nullable(),
    show_in_nav: z.boolean(),
    status: z.enum(["draft", "published"]),
    seo_description: i18n,
  })
  .refine((p) => Object.values(p.title).some((v) => v.trim()), { path: ["title"], message: "required" });

export type PostInput = z.infer<typeof postSchema>;
export type SectorInput = z.infer<typeof sectorSchema>;
export type ObjectiveInput = z.infer<typeof objectiveSchema>;
export type PageInput = z.infer<typeof pageSchema>;

const phone = z.string().regex(/^\+[1-9][0-9]{6,14}$/, "phone").nullable();
const url = z.url().nullable();
export const SOCIAL_KEYS = ["facebook", "instagram", "x", "youtube", "tiktok", "linkedin"] as const;

export const settingsSchema = z
  .object({
    org_name: i18n,
    tagline: i18n,
    logo_url: url,
    logo_dark_url: url,
    favicon_url: url,
    phone,
    whatsapp: phone,
    email: z.email().nullable(),
    address: i18n,
    map_embed_url: url,
    socials: z.partialRecord(z.enum(SOCIAL_KEYS), z.url()),
    donate_info: i18n,
    footer_text: i18n,
    modules: z.object({ requests: z.boolean(), donate: z.boolean(), facebook_feed: z.boolean() }),
  })
  .refine((v) => Object.values(v.org_name).some((x) => x.trim()), { path: ["org_name"], message: "required" });

export type SettingsInput = z.infer<typeof settingsSchema>;
