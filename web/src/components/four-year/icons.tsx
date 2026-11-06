/* The board's icons: 12–14px, one stroke weight, currentColor. */

export function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      {[3, 6, 9].flatMap((y) => [4, 8].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />))}
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg className="fy-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon() {
  return (
    <svg className="fy-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M7 1.75 12.6 11.5H1.4L7 1.75Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M7 5.5v2.75" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="7" cy="9.9" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function InfoIcon() {
  return (
    <svg className="fy-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 6.3v3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="7" cy="4.4" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg className="fy-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="m4.6 7.2 1.7 1.7 3.2-3.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
