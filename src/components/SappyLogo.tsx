import React, { useId } from 'react';

interface SappyEmblemProps {
  className?: string;
}

/**
 * SAPPY circular geometric monogram:
 * outer thick ring, V-nib, flowing horizontal S-curve, right loop, and upper-center dot.
 */
export const SappyEmblem: React.FC<SappyEmblemProps> = ({
  className = 'w-full h-full text-[#324729]',
}) => {
  const clipId = useId();

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="SAPPY circular geometric emblem"
      className={className}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="41" />
        </clipPath>
      </defs>
      <g
        clipPath={`url(#${clipId})`}
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 25.5 15 L 50 90 L 74.5 15" strokeWidth="5.6" />
        <path d="M 16.5 22 C 16 41, 22 51.5, 37 51.5 L 63 51.5 C 79 51.5, 86 60, 85 75" strokeWidth="5.6" />
        <path d="M 73 17.5 C 82 32, 81 59, 56 71.5" strokeWidth="5.4" />
      </g>
      <circle cx="50" cy="32.5" r="4.4" fill="currentColor" />
      <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" strokeWidth="6" />
    </svg>
  );
};

interface SappyLogoProps {
  variant?: 'wordmark' | 'icon' | 'badge' | 'stacked';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export const SappyLogo: React.FC<SappyLogoProps> = ({
  variant = 'wordmark',
  className = '',
  size = 'md',
  showSubtitle = false,
}) => {
  const iconDimensions = {
    sm: 'w-7 h-7 p-0.5 rounded-lg',
    md: 'w-9 h-9 p-1 rounded-xl',
    lg: 'w-12 h-12 p-1 rounded-xl',
    xl: 'w-16 h-16 p-1.5 rounded-2xl',
  };

  if (variant === 'icon') {
    return (
      <div
        className={`relative inline-flex items-center justify-center overflow-hidden shadow-md border border-[#ded6c1] bg-[#f3efe4] shrink-0 ${iconDimensions[size]} ${className}`}
      >
        <SappyEmblem className="w-full h-full text-[#324729]" />
      </div>
    );
  }

  if (variant === 'stacked') {
    const emblemSize =
      size === 'sm'
        ? 'w-11 h-11'
        : size === 'lg'
          ? 'w-18 h-18'
          : size === 'xl'
            ? 'w-22 h-22'
            : 'w-14 h-14';
    const titleSize =
      size === 'sm'
        ? 'text-lg tracking-[0.12em]'
        : size === 'lg'
          ? 'text-2xl tracking-[0.14em]'
          : size === 'xl'
            ? 'text-3xl tracking-[0.16em]'
            : 'text-2xl tracking-[0.14em]';
    const taglineSize =
      size === 'sm' ? 'text-[10px]' : size === 'lg' || size === 'xl' ? 'text-xs' : 'text-[11px]';

    return (
      <div
        className={`inline-flex flex-col items-center justify-center text-center bg-[#f3efe4] border border-[#ded6c1] rounded-2xl px-7 py-4 shadow-md ${className}`}
        style={{
          backgroundImage:
            'radial-gradient(rgba(50,71,41,0.035) 1px, transparent 0), radial-gradient(rgba(50,71,41,0.025) 1px, transparent 0)',
          backgroundSize: '14px 14px',
          backgroundPosition: '0 0, 7px 7px',
        }}
      >
        <div className={`${emblemSize} mb-2`}>
          <SappyEmblem className="w-full h-full text-[#324729]" />
        </div>
        <span className={`font-sans font-semibold uppercase text-[#324729] leading-none ${titleSize}`}>
          SAPPY
        </span>
        <span
          className={`font-serif lowercase text-[#324729]/95 leading-tight mt-1 ${taglineSize}`}
        >
          stationery &amp; printing.
        </span>
      </div>
    );
  }

  // Horizontal lockup for top Navbar & slide-over drawer
  const wordmarkTitleSize =
    size === 'sm'
      ? 'text-sm tracking-[0.14em]'
      : size === 'lg'
        ? 'text-xl tracking-[0.16em]'
        : 'text-base tracking-[0.16em]';

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div
        className={`relative inline-flex items-center justify-center overflow-hidden shadow-md border border-[#ded6c1] bg-[#f3efe4] shrink-0 ${iconDimensions[size === 'xl' ? 'lg' : size]}`}
      >
        <SappyEmblem className="w-full h-full text-[#324729]" />
      </div>
      <div className="flex flex-col text-left">
        <span className={`font-sans font-bold uppercase text-white leading-none ${wordmarkTitleSize}`}>
          SAPPY
        </span>
        {showSubtitle ? (
          <span className="font-serif lowercase text-[11px] text-forest-300 leading-tight mt-0.5">
            stationery &amp; printing.
          </span>
        ) : (
          <span className="font-serif lowercase text-[10px] text-charcoal-400 leading-tight mt-0.5">
            stationery &amp; printing.
          </span>
        )}
      </div>
    </div>
  );
};

export const SappyBrandIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-5 h-5',
}) => {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md bg-[#f3efe4] border border-[#ded6c1] p-0.5 shrink-0 ${className}`}
    >
      <SappyEmblem className="w-full h-full text-[#324729]" />
    </span>
  );
};
