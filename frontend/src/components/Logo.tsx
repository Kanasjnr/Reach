export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      aria-label="Reach"
    >
      <defs>
        <linearGradient id="reach-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--gradient-from)" />
          <stop offset="1" stopColor="var(--gradient-to)" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill="url(#reach-logo-gradient)" />
      <g transform="rotate(-45 256 256)">
        <rect x="150" y="234" width="140" height="44" rx="22" fill="white" />
        <polygon points="270,190 396,256 270,322" fill="white" />
      </g>
    </svg>
  );
}
