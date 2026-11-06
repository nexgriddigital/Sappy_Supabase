import React, { useState } from 'react';

interface SappyLogoProps {
  variant?: 'wordmark' | 'icon' | 'badge';
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
  const [imgError, setImgError] = useState(false);

  // Height mappings based on size
  const heightClasses = {
    sm: variant === 'icon' ? 'w-7 h-7' : 'h-7',
    md: variant === 'icon' ? 'w-9 h-9' : 'h-9',
    lg: variant === 'icon' ? 'w-12 h-12' : 'h-12',
    xl: variant === 'icon' ? 'w-16 h-16' : 'h-16',
  };

  if (variant === 'icon') {
    return (
      <div className={`relative inline-flex items-center justify-center rounded-xl overflow-hidden shadow-md border border-amber-600/40 bg-charcoal-950 shrink-0 ${heightClasses[size]} ${className}`}>
        {!imgError ? (
          <img
            src="/icon.jpg"
            alt="Sappy Icon"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-serif font-black text-amber-400 text-lg leading-none">
            S
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div className={`relative overflow-hidden rounded-lg flex items-center justify-center shrink-0 ${heightClasses[size]}`}>
        {!imgError ? (
          <img
            src="/logo.jpg"
            alt="SAPPY"
            onError={() => setImgError(true)}
            className="h-full w-auto max-w-[140px] sm:max-w-[170px] object-contain rounded-md"
          />
        ) : (
          <div className="flex flex-col">
            <span className="font-serif tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 font-extrabold text-lg">
              SAPPY
            </span>
          </div>
        )}
      </div>
      {showSubtitle && (
        <div className="hidden sm:block text-left">
          <span className="text-[10px] text-amber-400/90 font-mono block leading-tight font-bold tracking-wider">
            POS Terminal
          </span>
          <span className="text-[9px] text-charcoal-400 font-sans block leading-none">
            Stationery & Books
          </span>
        </div>
      )}
    </div>
  );
};

export const SappyBrandIcon: React.FC<{ className?: string; size?: number }> = ({
  className = 'w-5 h-5',
}) => {
  return (
    <img
      src="/icon.jpg"
      alt="Sappy"
      className={`rounded-md object-cover inline-block border border-amber-600/30 ${className}`}
      onError={(e) => {
        // Fallback to text icon if image unavailable
        (e.currentTarget as HTMLElement).style.display = 'none';
      }}
    />
  );
};
