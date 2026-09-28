/** The seal that signs every page in the series. */
export function Monogram({ size = 34, label = "Finn Lakin" }: { size?: number; label?: string | null }) {
  return (
    <svg
      className="monogram"
      width={size}
      height={size}
      viewBox="0 0 34 34"
      role={label ? "img" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="17" cy="17" r="15.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17" cy="17" r="12.5" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.6" />
      <text
        x="17"
        y="21.6"
        textAnchor="middle"
        fontFamily='"IBM Plex Serif", Georgia, serif'
        fontStyle="italic"
        fontWeight="600"
        fontSize="12.5"
        fill="currentColor"
      >
        FL
      </text>
    </svg>
  );
}
