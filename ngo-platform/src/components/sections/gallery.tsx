import { getAlbum, getMediaByIds } from "@/lib/data/content";
import { tr } from "@/lib/i18n/tr";
import { AlbumGallery } from "@/components/public/album-gallery";
import { SectionHeading } from "@/components/public/section-heading";
import { SectionShell } from "./section-shell";
import type { SectionProps } from "./types";

export async function GallerySection({ section, settings, locale, defaultLocale }: SectionProps<"gallery">) {
  const x = (v: unknown) => tr(v, locale, defaultLocale);
  const items = settings.album_post_id
    ? await getAlbum(settings.album_post_id)
    : (await getMediaByIds(settings.media_ids)).map((media) => ({ media, caption: {} }));
  if (!items.length) return null;
  const id = `s-${section.id}`;

  return (
    <SectionShell labelledBy={id}>
      <SectionHeading id={id} title={x(section.title)} subtitle={x(section.subtitle)} />
      <AlbumGallery
        images={items.map(({ media, caption }) => ({
          src: media.url,
          alt: x(media.alt),
          caption: x(caption),
          width: media.width,
          height: media.height,
        }))}
      />
    </SectionShell>
  );
}
