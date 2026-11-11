/**
 * Hand-built line illustrations for the problem section.
 * Shared stroke language: 1.5px ink outlines, brand/warm fills.
 */

const INK = "#111827";
const BRAND = "#4F6EF7";
const BRAND_SOFT = "#E1E7FE";
const BRAND_LINE = "#C7D1FD";
const WARM = "#F5C451";
const WARM_SOFT = "#FDEEC4";
const SUCCESS = "#16A36A";

const common = {
  viewBox: "0 0 120 80",
  fill: "none",
  "aria-hidden": true,
  className: "h-full w-full",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** A paper register with handwritten rows and a pencil. */
export function RegisterIllustration() {
  return (
    <svg {...common}>
      <rect x="27" y="12" width="62" height="60" rx="4" fill={BRAND_SOFT} transform="rotate(-6 58 42)" />
      <rect x="30" y="9" width="62" height="60" rx="4" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <line x1="42" y1="9" x2="42" y2="69" stroke={WARM} strokeWidth="1.5" />
      {[20, 32, 44, 56].map((y) => (
        <circle key={y} cx="35.5" cy={y} r="1.7" fill={INK} />
      ))}
      {[22, 30, 38, 46, 54, 62].map((y) => (
        <line key={y} x1="46" y1={y} x2="87" y2={y} stroke={BRAND_LINE} strokeWidth="1" />
      ))}
      <path d="M47 20c2-3 4-3 5 0s3 3 5 0 4-3 5 0 3 2 5-1" stroke={INK} strokeWidth="1.3" />
      <path d="M47 28c2-2.5 4-2.5 5 0s3 2.5 5 0 3-2 5 0" stroke={INK} strokeWidth="1.3" />
      <path d="M47 36c2-3 4-3 5 0s3 3 5 0 4-3 5 0 3 3 5 0 3-2 4 0" stroke={INK} strokeWidth="1.3" />
      <path d="M46 34.5h28" stroke={WARM} strokeWidth="2" opacity="0.9" />
      <path d="M47 44c2-2.5 4-2.5 5 0s3 2.5 5 0" stroke={INK} strokeWidth="1.3" opacity="0.55" />
      <g transform="translate(78 62) rotate(-52)">
        <path d="M0 0 6.5-3.6v7.2Z" fill={WARM_SOFT} stroke={INK} strokeWidth="1.3" />
        <path d="M0 0 2.4-1.3v2.6Z" fill={INK} />
        <rect x="6.5" y="-3.6" width="26" height="7.2" fill={WARM} stroke={INK} strokeWidth="1.3" />
        <rect x="32.5" y="-3.6" width="6" height="7.2" rx="1.5" fill={BRAND} stroke={INK} strokeWidth="1.3" />
      </g>
    </svg>
  );
}

/** A "who paid?" list with uncertain statuses, a question bubble and a rupee coin. */
export function PaymentConfusionIllustration() {
  const rows = [
    { y: 24, state: "paid" },
    { y: 38, state: "unknown" },
    { y: 52, state: "unknown" },
  ] as const;
  return (
    <svg {...common}>
      <rect x="14" y="11" width="66" height="58" rx="6" fill="#fff" stroke={INK} strokeWidth="1.5" />
      {rows.map(({ y, state }) => (
        <g key={y}>
          <circle cx="25" cy={y} r="4.5" fill={BRAND_SOFT} stroke={INK} strokeWidth="1.2" />
          <line x1="34" y1={y - 1.5} x2="56" y2={y - 1.5} stroke={INK} strokeWidth="1.5" />
          <line x1="34" y1={y + 2.5} x2="48" y2={y + 2.5} stroke={BRAND_LINE} strokeWidth="1.5" />
          {state === "paid" ? (
            <>
              <rect x="60" y={y - 4.5} width="13" height="9" rx="4.5" fill="#E9F8F0" stroke={SUCCESS} strokeWidth="1.2" />
              <path d={`M63.5 ${y}l2 2 4-4`} stroke={SUCCESS} strokeWidth="1.4" />
            </>
          ) : (
            <>
              <rect x="60" y={y - 4.5} width="13" height="9" rx="4.5" fill={WARM_SOFT} stroke={INK} strokeWidth="1.2" strokeDasharray="2 2" />
              <path d={`M64.8 ${y - 1.4}a1.8 1.8 0 1 1 2.4 1.7v.9`} stroke={INK} strokeWidth="1.1" />
              <circle cx="67.2" cy={y + 2.6} r="0.6" fill={INK} />
            </>
          )}
        </g>
      ))}
      {/* question bubble */}
      <path d="M88 10h16a6 6 0 0 1 6 6v10a6 6 0 0 1-6 6h-9l-5 5v-5h-2a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6Z" fill={BRAND} stroke={INK} strokeWidth="1.5" />
      <path d="M92.6 17.6a3.6 3.6 0 1 1 4.8 3.4c-.9.4-1.4 1-1.4 2v.9" stroke="#fff" strokeWidth="1.8" />
      <circle cx="96" cy="27.4" r="1.1" fill="#fff" />
      {/* rupee coin */}
      <circle cx="96" cy="56" r="12" fill={WARM} stroke={INK} strokeWidth="1.5" />
      <circle cx="96" cy="56" r="8.5" stroke={INK} strokeWidth="1" opacity="0.35" />
      <path d="M91.5 50.5h9M91.5 54h9M93 50.5h2.2a3.5 3.5 0 0 1 0 7H92.6l6.4 5.5" stroke={INK} strokeWidth="1.5" />
    </svg>
  );
}

/** An electricity bill receipt next to a bulb with a bolt. */
export function ElectricityIllustration() {
  return (
    <svg {...common}>
      <path
        d="M20 9h46v54l-5.75 4-5.75-4-5.75 4-5.75-4-5.75 4-5.75-4-5.75 4-5.75-4Z"
        fill="#fff"
        stroke={INK}
        strokeWidth="1.5"
      />
      <rect x="27" y="16" width="20" height="5" rx="2.5" fill={BRAND_SOFT} />
      {[29, 36, 43].map((y, i) => (
        <g key={y}>
          <line x1="27" y1={y} x2={i === 1 ? 44 : 48} y2={y} stroke={INK} strokeWidth="1.3" opacity="0.7" />
          <line x1="53" y1={y} x2="59" y2={y} stroke={INK} strokeWidth="1.3" />
        </g>
      ))}
      <line x1="27" y1="50" x2="59" y2="50" stroke={INK} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
      <rect x="45" y="53.5" width="15" height="6" rx="1.5" fill={WARM} />
      {/* bulb */}
      <path
        d="M90 14a16 16 0 0 0-9.5 28.9c1.6 1.2 2.5 3 2.5 5V51h14v-3.1c0-2 .9-3.8 2.5-5A16 16 0 0 0 90 14Z"
        fill={WARM_SOFT}
        stroke={INK}
        strokeWidth="1.5"
      />
      <path d="M92.5 21 84.5 33h6l-3 10 9-13h-6.2l2.2-9Z" fill={WARM} stroke={INK} strokeWidth="1.3" />
      <path d="M83 55h14M84.5 59h11" stroke={INK} strokeWidth="1.5" />
      <path d="M87 63h6" stroke={INK} strokeWidth="1.5" />
      <path d="M110 18l4-3M111 30h5M70 18l-4-3" stroke={BRAND} strokeWidth="1.5" />
    </svg>
  );
}

/** Loose papers, a spreadsheet and a sticky note pulling in different directions. */
export function ScatteredIllustration() {
  return (
    <svg {...common}>
      <path d="M38 40c10 14 30 18 46 6" stroke={BRAND} strokeWidth="1.3" strokeDasharray="3 3" />
      <g transform="rotate(-12 30 38)">
        <rect x="12" y="16" width="34" height="44" rx="3" fill="#fff" stroke={INK} strokeWidth="1.5" />
        {[25, 31, 37, 43].map((y) => (
          <line key={y} x1="18" y1={y} x2={y === 43 ? 32 : 40} y2={y} stroke={BRAND_LINE} strokeWidth="1.5" />
        ))}
      </g>
      <g transform="rotate(5 64 36)">
        <rect x="46" y="10" width="38" height="46" rx="3" fill="#fff" stroke={INK} strokeWidth="1.5" />
        <rect x="46" y="10" width="38" height="8" rx="3" fill={BRAND_SOFT} stroke={INK} strokeWidth="1.5" />
        {[26, 34, 42].map((y) => (
          <line key={y} x1="46" y1={y} x2="84" y2={y} stroke={INK} strokeWidth="1" opacity="0.25" />
        ))}
        <line x1="59" y1="18" x2="59" y2="56" stroke={INK} strokeWidth="1" opacity="0.25" />
        <line x1="72" y1="18" x2="72" y2="56" stroke={INK} strokeWidth="1" opacity="0.25" />
        <rect x="61" y="28" width="9" height="4" rx="1" fill={BRAND} />
      </g>
      <g transform="rotate(9 98 54)">
        <path d="M86 42h24v18l-6 6H86Z" fill={WARM} stroke={INK} strokeWidth="1.5" />
        <path d="M104 66v-6h6" fill={WARM_SOFT} stroke={INK} strokeWidth="1.5" />
        <line x1="90" y1="49" x2="104" y2="49" stroke={INK} strokeWidth="1.3" />
        <line x1="90" y1="54" x2="100" y2="54" stroke={INK} strokeWidth="1.3" />
      </g>
      <circle cx="102" cy="16" r="6" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <path d="M102 13v3.2l2 1.4" stroke={INK} strokeWidth="1.3" />
    </svg>
  );
}
