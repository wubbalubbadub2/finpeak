/**
 * FinPeak logo — abstract twin peaks that double as an upward chart line.
 * The taller indigo peak is the brand; the emerald inner peak signals growth.
 */
export function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-label="FinPeak"
    >
      {/* Background tile */}
      <rect width="40" height="40" rx="9" fill="url(#fp-bg)" />

      {/* Inner emerald peak (smaller, behind) */}
      <path
        d="M9 27 L17 16 L21 21 L17 27 Z"
        fill="#34d399"
        fillOpacity="0.95"
      />

      {/* Main white peak path — bold mountain mark */}
      <path
        d="M7 30 L16 14 L22 23 L26 18 L33 30 Z"
        fill="#ffffff"
      />

      {/* Subtle baseline shadow under peaks */}
      <rect x="7" y="29.5" width="26" height="1.2" rx="0.6" fill="#ffffff" fillOpacity="0.35" />

      <defs>
        <linearGradient id="fp-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#3730a3" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Full logo with wordmark beside the icon */
export function LogoFull({
  size = 32,
  className = "",
  showSubtitle = false,
}: {
  size?: number;
  className?: string;
  showSubtitle?: boolean;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <div className="flex flex-col leading-tight">
        <span className="text-base font-bold text-gray-900 tracking-tight">
          Fin<span className="text-indigo-600">Peak</span>
        </span>
        {showSubtitle && (
          <span className="text-[10px] text-gray-400 -mt-0.5">Финансовая аналитика</span>
        )}
      </div>
    </div>
  );
}
