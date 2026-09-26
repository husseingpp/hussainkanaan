import type { ComponentType } from "react";
import { sectionSchemas, type SectionType } from "@/lib/validation/sections";
import type { SectionProps } from "./types";
import { HeroSliderSection } from "./hero-slider";
import { AboutIntroSection } from "./about-intro";
import { ObjectivesSection } from "./objectives";
import { SectorsGridSection } from "./sectors-grid";
import { LatestActivitiesSection } from "./latest-activities";
import { EventsStripSection } from "./events-strip";
import { StatsSection } from "./stats";
import { GallerySection } from "./gallery";
import { PartnersSection } from "./partners";
import { CtaBannerSection } from "./cta-banner";
import { FacebookFeedSection } from "./facebook-feed";
import { RequestCtaSection } from "./request-cta";
import { RichTextSection } from "./rich-text";

type Entry<T extends SectionType> = {
  schema: (typeof sectionSchemas)[T];
  Component: ComponentType<SectionProps<T>>;
};

/** section_type → settings schema + component. Adding a type: enum + schema + component + entry + admin form + seed. */
export const sectionRegistry: { [T in SectionType]: Entry<T> } = {
  hero_slider: { schema: sectionSchemas.hero_slider, Component: HeroSliderSection },
  about_intro: { schema: sectionSchemas.about_intro, Component: AboutIntroSection },
  objectives: { schema: sectionSchemas.objectives, Component: ObjectivesSection },
  sectors_grid: { schema: sectionSchemas.sectors_grid, Component: SectorsGridSection },
  latest_activities: { schema: sectionSchemas.latest_activities, Component: LatestActivitiesSection },
  events_strip: { schema: sectionSchemas.events_strip, Component: EventsStripSection },
  stats: { schema: sectionSchemas.stats, Component: StatsSection },
  gallery: { schema: sectionSchemas.gallery, Component: GallerySection },
  partners: { schema: sectionSchemas.partners, Component: PartnersSection },
  cta_banner: { schema: sectionSchemas.cta_banner, Component: CtaBannerSection },
  facebook_feed: { schema: sectionSchemas.facebook_feed, Component: FacebookFeedSection },
  request_cta: { schema: sectionSchemas.request_cta, Component: RequestCtaSection },
  rich_text: { schema: sectionSchemas.rich_text, Component: RichTextSection },
};
