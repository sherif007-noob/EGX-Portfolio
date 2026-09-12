import React, { useState, useEffect } from 'react';
import { getTradingViewLogoUrl } from '../services/tradingviewLogos';

interface StockLogoProps {
  ticker: string;
  companyName?: string;
  sector?: string;
  logoUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-5 h-5 text-[10px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-11 h-11 text-base',
  xl: 'w-14 h-14 text-lg',
};

const SECTOR_GRADIENTS: Record<string, string> = {
  'Banking': 'from-blue-600 to-indigo-800 text-blue-100 border-blue-500/30',
  'Real Estate & Construction': 'from-emerald-600 to-teal-800 text-emerald-100 border-emerald-500/30',
  'Basic Resources & Steel': 'from-slate-600 to-zinc-800 text-slate-100 border-slate-500/30',
  'Petrochemicals & Fertilizers': 'from-cyan-600 to-blue-800 text-cyan-100 border-cyan-500/30',
  'Non-Bank Financial Services & Fintech': 'from-amber-600 to-orange-800 text-amber-100 border-amber-500/30',
  'Telecommunications & Tech': 'from-purple-600 to-indigo-900 text-purple-100 border-purple-500/30',
  'Telecommunications & Media': 'from-purple-600 to-indigo-900 text-purple-100 border-purple-500/30',
  'Food, Beverage & Agribusiness': 'from-lime-600 to-emerald-800 text-lime-100 border-lime-500/30',
  'Food, Beverage & Tobacco': 'from-lime-600 to-emerald-800 text-lime-100 border-lime-500/30',
  'Healthcare & Pharmaceuticals': 'from-rose-600 to-pink-800 text-rose-100 border-rose-500/30',
  'Industrial Goods & Services': 'from-stone-600 to-zinc-800 text-stone-100 border-stone-500/30',
  'Building Materials & Cement': 'from-orange-600 to-amber-800 text-orange-100 border-orange-500/30',
  'Energy & Petrochemicals': 'from-yellow-600 to-amber-800 text-yellow-100 border-yellow-500/30',
  'Energy & Oil Services': 'from-yellow-600 to-amber-800 text-yellow-100 border-yellow-500/30',
  'Utilities & Logistics': 'from-teal-600 to-cyan-800 text-teal-100 border-teal-500/30',
  'Transport & Logistics': 'from-teal-600 to-cyan-800 text-teal-100 border-teal-500/30',
  'Consumer Goods & Automobiles': 'from-violet-600 to-purple-800 text-violet-100 border-violet-500/30',
  'Tourism & Leisure': 'from-fuchsia-600 to-pink-800 text-fuchsia-100 border-fuchsia-500/30',
  'Textiles & Consumer Durables': 'from-sky-600 to-blue-800 text-sky-100 border-sky-500/30',
  'Education & Services': 'from-indigo-600 to-violet-800 text-indigo-100 border-indigo-500/30',
};

const DEFAULT_GRADIENT = 'from-blue-600 to-slate-800 text-blue-100 border-blue-500/30';

export const StockLogo: React.FC<StockLogoProps> = ({
  ticker,
  companyName,
  sector = '',
  logoUrl,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);
  const cleanTicker = ticker ? ticker.trim().toUpperCase().replace('.CA', '').replace('EGX:', '') : 'STK';
  const resolvedLogoUrl = getTradingViewLogoUrl(cleanTicker, logoUrl);

  // Reset error if URL changes
  useEffect(() => {
    setImageError(false);
  }, [resolvedLogoUrl, cleanTicker]);

  const sizeStyle = SIZE_MAP[size] || SIZE_MAP.md;
  const sectorGradient = SECTOR_GRADIENTS[sector] || DEFAULT_GRADIENT;

  // Fallback initial badge text (e.g., "CO" or "UE")
  const initials = cleanTicker.slice(0, 2);

  if (imageError || !resolvedLogoUrl) {
    return (
      <div
        className={`shrink-0 rounded-full bg-gradient-to-br ${sectorGradient} border flex items-center justify-center font-bold tracking-tight shadow-sm select-none ${sizeStyle} ${className}`}
        title={`${companyName || cleanTicker} (${sector || 'EGX Equity'})`}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 rounded-full overflow-hidden bg-slate-900 border border-slate-700/60 p-0.5 shadow-sm flex items-center justify-center select-none ${sizeStyle} ${className}`}
      title={`${companyName || cleanTicker} - TradingView Logo`}
    >
      <img
        src={resolvedLogoUrl}
        alt={`${cleanTicker} TradingView Logo`}
        referrerPolicy="no-referrer"
        loading="lazy"
        className="w-full h-full object-contain rounded-full bg-slate-950"
        onError={() => setImageError(true)}
      />
    </div>
  );
};
