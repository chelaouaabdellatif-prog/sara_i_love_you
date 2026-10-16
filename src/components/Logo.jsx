// Croix de pharmacie bleue avec la coupe d'Hygie (coupe + serpent).
export default function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Pharmacie">
      <path
        fill="var(--primary-600)"
        d="M24 4h16a4 4 0 0 1 4 4v12h12a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H44v12a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4V44H8a4 4 0 0 1-4-4V24a4 4 0 0 1 4-4h12V8a4 4 0 0 1 4-4z"
      />
      <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path fill="#fff" d="M23 33h18a9 8 0 0 1-18 0z" />
        <path d="M32 41v6M27 49h10" />
        <path d="M30 32c-4-3-3-7 1-8s6-4 2-7c-2-1.5-4-.5-4 1" />
      </g>
      <circle cx="29" cy="18.6" r="1.6" fill="#fff" />
    </svg>
  );
}
