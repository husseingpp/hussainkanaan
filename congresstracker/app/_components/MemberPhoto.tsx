/** Member headshot with a generic fallback silhouette. */
export function MemberPhoto({
  src,
  name,
  size = 40,
}: {
  src: string | null;
  name: string;
  size?: number;
}) {
  if (!src) {
    return (
      <div
        className="rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        aria-label={name}
      >
        {/* Initials fallback */}
        {name
          .split(" ")
          .slice(0, 2)
          .map((w) => w[0])
          .join("")}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
      loading="lazy"
    />
  );
}
