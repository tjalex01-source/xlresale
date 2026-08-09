export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 font-display text-2xl font-extrabold tracking-[-0.02em] ${className}`}
    >
      <svg viewBox="0 0 20 26" className="h-[26px] w-5 shrink-0" aria-hidden>
        <path
          d="M10 0C4.5 0 0 4.3 0 9.6 0 16.8 10 26 10 26s10-9.2 10-16.4C20 4.3 15.5 0 10 0z"
          fill="var(--color-pink)"
        />
        <circle cx="10" cy="9.5" r="4" fill="#fff" />
      </svg>
      XLResale
    </span>
  );
}
