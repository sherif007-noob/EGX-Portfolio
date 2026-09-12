import { EGXTicker, Sector, TrendStatus } from '../types';
import { getTradingViewLogoUrl } from '../services/tradingviewLogos';

/**
 * Extensive dictionary of Arabic and English company names and sectors for Egyptian Exchange equities.
 */
export const EGX_STOCK_DICTIONARY: Record<
  string,
  { nameEn: string; nameAr: string; sector: Sector; isin?: string }
> = {
  COMI: { nameEn: 'Commercial International Bank (CIB)', nameAr: 'البنك التجاري الدولي - مصر', sector: 'Banking', isin: 'EGS60121C018' },
  ESRS: { nameEn: 'Ezz Steel', nameAr: 'حديد عز', sector: 'Basic Resources & Steel', isin: 'EGS30021C013' },
  TMGH: { nameEn: 'Talaat Moustafa Group Holding', nameAr: 'مجموعة طلعت مصطفى القابضة', sector: 'Real Estate & Construction', isin: 'EGS691S1C011' },
  ABUK: { nameEn: 'Abu Qir Fertilizers', nameAr: 'أبو قير للأسمدة والصناعات الكيماوية', sector: 'Petrochemicals & Fertilizers', isin: 'EGS38191C010' },
  MFPC: { nameEn: 'Misr Fertilizers Production (MOPCO)', nameAr: 'مصر لإنتاج الأسمدة - موبكو', sector: 'Petrochemicals & Fertilizers', isin: 'EGS39021C014' },
  SWDY: { nameEn: 'Elsewedy Electric', nameAr: 'السويدي إليكتريك', sector: 'Industrial Goods & Services', isin: 'EGS3G0Z1C014' },
  FWRY: { nameEn: 'Fawry for Banking & Payment Tech', nameAr: 'فوري لتكنولوجيا البنوك والمدفوعات', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS745L1C014' },
  ETEL: { nameEn: 'Telecom Egypt (WE)', nameAr: 'المصرية للاتصالات', sector: 'Telecommunications & Media', isin: 'EGS48031C016' },
  EKHO: { nameEn: 'Egypt Kuwait Holding', nameAr: 'القابضة المصرية الكويتية', sector: 'Industrial Goods & Services', isin: 'EGS69082C013' },
  AMOC: { nameEn: 'Alexandria Mineral Oils (AMOC)', nameAr: 'الإسكندرية للزيوت المعدنية - أموك', sector: 'Energy & Oil Services', isin: 'EGS38321C014' },
  ISPH: { nameEn: 'Ibnsina Pharma', nameAr: 'ابن سينا فارما', sector: 'Healthcare & Pharmaceuticals', isin: 'EGS729K1C019' },
  HRHO: { nameEn: 'EFG Holding', nameAr: 'مجموعة إي إف چي القابضة', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS69101C018' },
  ORAS: { nameEn: 'Orascom Construction PLC', nameAr: 'أوراسكوم كونستراكشون', sector: 'Real Estate & Construction', isin: 'EGS693V1C014' },
  EAST: { nameEn: 'Eastern Company', nameAr: 'الشرقية - إيسترن كومباني', sector: 'Food, Beverage & Tobacco', isin: 'EGS37091C013' },
  JUFO: { nameEn: 'Juhayna Food Industries', nameAr: 'جهينة للصناعات الغذائية', sector: 'Food, Beverage & Tobacco', isin: 'EGS30901C010' },
  ORHD: { nameEn: 'Orascom Development Egypt', nameAr: 'أوراسكوم للتنمية مصر', sector: 'Tourism & Leisure', isin: 'EGS69071C015' },
  MASR: { nameEn: 'Madinet Masr for Housing & Development', nameAr: 'مدينة مصر للإسكان والتعمير', sector: 'Real Estate & Construction', isin: 'EGS65591C017' },
  MNHD: { nameEn: 'Madinet Masr for Housing & Development', nameAr: 'مدينة مصر للإسكان والتعمير', sector: 'Real Estate & Construction', isin: 'EGS65591C017' },
  HELI: { nameEn: 'Heliopolis Housing & Development', nameAr: 'مصر الجديدة للإسكان والتعمير', sector: 'Real Estate & Construction', isin: 'EGS65581C018' },
  PHDC: { nameEn: 'Palm Hills Developments', nameAr: 'بالم هيلز للتعمير', sector: 'Real Estate & Construction', isin: 'EGS691R1C012' },
  OCDI: { nameEn: 'SODIC (Sixth of October Development)', nameAr: 'السادس من أكتوبر للتنمية والاستثمار - سوديك', sector: 'Real Estate & Construction', isin: 'EGS65531C013' },
  EFIH: { nameEn: 'e-finance for Digital & Financial Investments', nameAr: 'إي فاينانس للاستثمارات المالية والرقمية', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS745E1C019' },
  ADIB: { nameEn: 'Abu Dhabi Islamic Bank - Egypt', nameAr: 'مصرف أبو ظبي الإسلامي - مصر', sector: 'Banking', isin: 'EGS60061C016' },
  CIEB: { nameEn: 'Credit Agricole Egypt', nameAr: 'بنك كريدي أجر Cole مصر', sector: 'Banking', isin: 'EGS60081C014' },
  HDBK: { nameEn: 'Housing & Development Bank', nameAr: 'بنك التعمير والإسكان', sector: 'Banking', isin: 'EGS60041C018' },
  QNBF: { nameEn: 'QNB Alahli', nameAr: 'بنك قطر الوطني الأهلي', sector: 'Banking', isin: 'EGS60131C017' },
  QNBA: { nameEn: 'QNB Alahli', nameAr: 'بنك قطر الوطني الأهلي', sector: 'Banking', isin: 'EGS60131C017' },
  SAUD: { nameEn: 'Faisal Islamic Bank of Egypt', nameAr: 'بنك فيصل الإسلامي المصري', sector: 'Banking', isin: 'EGS60071C015' },
  EGAL: { nameEn: 'Egypt Aluminum', nameAr: 'مصر للألومنيوم', sector: 'Basic Resources & Steel', isin: 'EGS30041C011' },
  SKPC: { nameEn: 'Sidi Kerir Petrochemicals (SIDPEC)', nameAr: 'سيدي كرير للبتروكيماويات - سيدبك', sector: 'Petrochemicals & Fertilizers', isin: 'EGS38201C019' },
  GBCO: { nameEn: 'GB Corp (Ghabbour Auto)', nameAr: 'جي بي كوربوريشن (غبور)', sector: 'Consumer Goods & Automobiles', isin: 'EGS673T1C012' },
  AUTO: { nameEn: 'GB Corp (Ghabbour Auto)', nameAr: 'جي بي كوربوريشن (غبور)', sector: 'Consumer Goods & Automobiles', isin: 'EGS673T1C012' },
  ALCN: { nameEn: 'Alexandria Container & Cargo Handling', nameAr: 'الإسكندرية لتداول الحاويات والبضائع', sector: 'Transport & Logistics', isin: 'EGS42021C011' },
  CCAP: { nameEn: 'Qalaa Holdings', nameAr: 'القلعة للاستشارات المالية', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS691T1C010' },
  OIH: { nameEn: 'Orascom Investment Holding', nameAr: 'أوراسكوم للاستثمار القابضة', sector: 'Telecommunications & Media', isin: 'EGS693S1C017' },
  OTMT: { nameEn: 'Orascom Investment Holding', nameAr: 'أوراسكوم للاستثمار القابضة', sector: 'Telecommunications & Media', isin: 'EGS693S1C017' },
  BTFH: { nameEn: 'Beltone Financial Holding', nameAr: 'بلتون المالية القابضة', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS691G1C015' },
  CLHO: { nameEn: 'Cleopatra Hospital Group', nameAr: 'مجموعة مستشفيات كليوباترا', sector: 'Healthcare & Pharmaceuticals', isin: 'EGS729N1C016' },
  MCQE: { nameEn: 'Misr Cement - Qena', nameAr: 'مصر للأسمنت قنا', sector: 'Building Materials & Cement', isin: 'EGS3C311C018' },
  SVCE: { nameEn: 'South Valley Cement', nameAr: 'أسمنت جنوب الوادي', sector: 'Building Materials & Cement', isin: 'EGS3C341C015' },
  ARCC: { nameEn: 'Arabian Cement Company', nameAr: 'الأسمنت العربية', sector: 'Building Materials & Cement', isin: 'EGS3C381C011' },
  RAYA: { nameEn: 'Raya Holding for Financial Investments', nameAr: 'راية القابضة للاستثمارات المالية', sector: 'Telecommunications & Media', isin: 'EGS69091C012' },
  RACC: { nameEn: 'Raya Customer Experience', nameAr: 'راية لخدمات مراكز الاتصالات', sector: 'Industrial Goods & Services', isin: 'EGS74081C010' },
  ACAMD: { nameEn: 'Arab Co. for Asset Management', nameAr: 'العربية لإدارة وتطوير الأصول', sector: 'Real Estate & Construction', isin: 'EGS65601C014' },
  TAQA: { nameEn: 'TAQA Arabia', nameAr: 'طاقة عربية', sector: 'Energy & Oil Services', isin: 'EGS738J1C019' },
  UBEE: { nameEn: 'The United Bank', nameAr: 'المصرف المتحد', sector: 'Banking', isin: 'EGS60151C015' },
  UBEG: { nameEn: 'The United Bank', nameAr: 'المصرف المتحد', sector: 'Banking', isin: 'EGS60151C015' },
  DOMT: { nameEn: 'Arabian Food Industries (Domty)', nameAr: 'الصناعات الغذائية العربية - دومتي', sector: 'Food, Beverage & Tobacco', isin: 'EGS30931C017' },
  OBRI: { nameEn: 'Al Ezz Ceramics & Porcelain (Gemma)', nameAr: 'العز للسيراميك والبورسلين - الجوهرة', sector: 'Building Materials & Cement', isin: 'EGS3C041C016' },
  PRDC: { nameEn: 'Pioneers Properties for Urban Development', nameAr: 'بايونيرز بروبرتيز للتنمية العمرانية', sector: 'Real Estate & Construction', isin: 'EGS65621C012' },
  PIOH: { nameEn: 'Pioneers Holding', nameAr: 'بايونيرز القابضة', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS691A1C011' },
  ASCM: { nameEn: 'Asek Company for Mining (ASCOM)', nameAr: 'أسيك للتعدين - أسكوم', sector: 'Basic Resources & Steel', isin: 'EGS10021C011' },
  MTIE: { nameEn: 'MM Group for Industry & Int. Trade', nameAr: 'إم إم جروب للصناعة والتجارة العالمية', sector: 'Consumer Goods & Automobiles', isin: 'EGS3G111C010' },
  CSAG: { nameEn: 'Canal Shipping Agencies', nameAr: 'القناة للتوكيلات الملاحية', sector: 'Transport & Logistics', isin: 'EGS42031C010' },
  SPMD: { nameEn: 'Speed Medical', nameAr: 'سبيد ميديكال', sector: 'Healthcare & Pharmaceuticals', isin: 'EGS729S1C019' },
  AIH: { nameEn: 'Arabia Investments Holding', nameAr: 'عربية للاستثمارات والتنمية', sector: 'Industrial Goods & Services', isin: 'EGS69131C015' },
  DSCW: { nameEn: 'Dice Sport & Casual Wear', nameAr: 'دايس للملابس الجاهزة', sector: 'Textiles & Consumer Durables', isin: 'EGS34051C014' },
  ORWE: { nameEn: 'Oriental Weavers', nameAr: 'النساجون الشرقيون للسجاد', sector: 'Textiles & Consumer Durables', isin: 'EGS34021C017' },
  ELSH: { nameEn: 'El Shams Housing & Urbanization', nameAr: 'الشمس للإسكان والتعمير', sector: 'Real Estate & Construction', isin: 'EGS65081C018' },
  UNIT: { nameEn: 'United Housing & Development', nameAr: 'المتحدة للإسكان والتعمير', sector: 'Real Estate & Construction', isin: 'EGS65071C019' },
  RMDA: { nameEn: 'Rameda Pharmaceuticals', nameAr: 'راميدا للصناعات الدوائية', sector: 'Healthcare & Pharmaceuticals', isin: 'EGS729J1C011' },
  ATQA: { nameEn: 'Misr National Steel (Ataqa)', nameAr: 'مصر الوطنية للصلب - عتاقة', sector: 'Basic Resources & Steel', isin: 'EGS30091C015' },
  IRON: { nameEn: 'Egyptian Iron & Steel', nameAr: 'الحديد والصلب المصرية', sector: 'Basic Resources & Steel', isin: 'EGS30011C014' },
  POUL: { nameEn: 'Cairo Poultry', nameAr: 'القاهرة للدواجن', sector: 'Food, Beverage & Tobacco', isin: 'EGS30361C013' },
  ISMA: { nameEn: 'Ismailia Misr Poultry', nameAr: 'الإسماعيلية مصر للدواجن', sector: 'Food, Beverage & Tobacco', isin: 'EGS30351C014' },
  OLFI: { nameEn: 'Obour Land for Food Industries', nameAr: 'عبور لاند للصناعات الغذائية', sector: 'Food, Beverage & Tobacco', isin: 'EGS30951C015' },
  SNFC: { nameEn: 'Sharkia National Food', nameAr: 'الشرقية الوطنية للأمن الغذائي', sector: 'Food, Beverage & Tobacco', isin: 'EGS30471C010' },
  AJWA: { nameEn: 'Ajwa Group for Food Industries', nameAr: 'أجواء للصناعات الغذائية', sector: 'Food, Beverage & Tobacco', isin: 'EGS30791C011' },
  KRRE: { nameEn: 'Khabary (Reacap Financial)', nameAr: 'ريكاب للاستثمارات المالية', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS691Y1C011' },
  CIRA: { nameEn: 'Cairo Investment & Real Estate Development (CIRA Education)', nameAr: 'القاهرة للاستثمار والتنمية العقارية', sector: 'Education & Services', isin: 'EGS73861C012' },
  TALM: { nameEn: 'Taaleem Management Services', nameAr: 'تعليم لخدمات الإدارة', sector: 'Education & Services', isin: 'EGS738H1C013' },
  MOIL: { nameEn: 'Maridive & Oil Services', nameAr: 'الخدمات الملاحية والبترولية - ماريديف', sector: 'Energy & Oil Services', isin: 'EGS49022C015' },
  BINV: { nameEn: 'B Investments Holding', nameAr: 'بي إنفستمنتس القابضة', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS691Z1C010' },
  VALU: { nameEn: 'valU Financial Technologies', nameAr: 'فاليو لخدمات التمويل الاستهلاكي', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS745M1C013' }
};

/**
 * Creates an EGXTicker record from symbol, price, and metadata with sensible defaults.
 */
export function createEGXTickerRecord(
  ticker: string,
  price: number,
  changePercent: number = 0,
  volume: number = 0,
  dayHigh?: number,
  dayLow?: number,
  yearHigh?: number,
  yearLow?: number,
  rsi?: number,
  description?: string,
  logoIdOrUrl?: string
): EGXTicker {
  const upper = ticker.trim().toUpperCase().replace('.CA', '').replace('EGX:', '');
  const dict = EGX_STOCK_DICTIONARY[upper];

  const nameEn = dict?.nameEn || description || `${upper} Corp`;
  const nameAr = dict?.nameAr || `${upper} مصر`;
  const sector = dict?.sector || 'Other';
  const isin = dict?.isin;
  const logoUrl = getTradingViewLogoUrl(upper, logoIdOrUrl);

  const change = Math.round((price * (changePercent / 100)) * 100) / 100;
  const high = dayHigh || Math.round(price * 1.02 * 100) / 100;
  const low = dayLow || Math.round(price * 0.98 * 100) / 100;
  const yHigh = yearHigh || Math.round(price * 1.35 * 100) / 100;
  const yLow = yearLow || Math.round(price * 0.65 * 100) / 100;
  const rsiVal = rsi !== undefined && !isNaN(rsi) ? Math.round(rsi * 10) / 10 : 52.0;

  const support = Math.round(price * 0.94 * 100) / 100;
  const resistance = Math.round(price * 1.08 * 100) / 100;
  const targetPrice = Math.round(price * 1.18 * 100) / 100;
  const stopLoss = Math.round(price * 0.91 * 100) / 100;

  let trendStatus: TrendStatus = 'Rangebound Neutral';
  if (changePercent >= 2.5 || rsiVal >= 65) trendStatus = 'Strong Uptrend';
  else if (changePercent > 0.5) trendStatus = 'Bullish Pullback';
  else if (changePercent <= -2.5 || rsiVal <= 35) trendStatus = 'Bearish Breakdown';
  else if (changePercent < -0.5) trendStatus = 'Rangebound Neutral';

  return {
    ticker: upper,
    nameEn,
    nameAr,
    isin,
    sector,
    lastPrice: price,
    change,
    changePercent,
    dayHigh: high,
    dayLow: low,
    yearHigh: yHigh,
    yearLow: yLow,
    volume,
    valueEgp: volume * price,
    trendStatus,
    rsi14: rsiVal,
    support,
    resistance,
    targetPrice,
    stopLoss,
    notes: `Active EGX equity traded in EGP on the Cairo exchange.`,
    lastUpdated: new Date().toISOString(),
    logoUrl
  };
}

export const INITIAL_EGX_TICKERS: EGXTicker[] = Object.keys(EGX_STOCK_DICTIONARY).map((sym) => {
  const samplePrices: Record<string, { price: number; change: number; vol: number }> = {
    COMI: { price: 88.50, change: 1.43, vol: 3850200 },
    ESRS: { price: 118.20, change: 2.96, vol: 2150000 },
    TMGH: { price: 62.40, change: -0.95, vol: 4120000 },
    ABUK: { price: 72.80, change: 1.53, vol: 1680000 },
    MFPC: { price: 54.50, change: 0.74, vol: 1120000 },
    SWDY: { price: 48.90, change: 3.16, vol: 2450000 },
    FWRY: { price: 7.82, change: -1.26, vol: 12500000 },
    ETEL: { price: 34.75, change: 0.43, vol: 1420000 },
    EKHO: { price: 42.10, change: 1.20, vol: 980000 },
    AMOC: { price: 10.35, change: -0.48, vol: 5320000 },
    ISPH: { price: 3.95, change: 2.86, vol: 9800000 },
    HRHO: { price: 22.15, change: 2.07, vol: 3100000 },
    ORAS: { price: 245.00, change: 1.87, vol: 320000 },
    EAST: { price: 32.50, change: 0.62, vol: 1850000 },
    JUFO: { price: 28.90, change: -0.34, vol: 890000 },
    MASR: { price: 4.85, change: 2.11, vol: 8500000 },
    HELI: { price: 11.40, change: 1.33, vol: 4100000 },
    PHDC: { price: 4.92, change: 3.58, vol: 11200000 },
    OCDI: { price: 52.80, change: 0.96, vol: 650000 },
    EFIH: { price: 24.30, change: 1.67, vol: 2100000 },
    ADIB: { price: 48.70, change: 2.31, vol: 1450000 },
    CIEB: { price: 21.80, change: 0.46, vol: 920000 },
    HDBK: { price: 56.00, change: 1.08, vol: 430000 },
    QNBF: { price: 38.50, change: 0.52, vol: 850000 },
    EGAL: { price: 135.00, change: 4.25, vol: 980000 },
    SKPC: { price: 31.40, change: 1.95, vol: 2400000 },
    GBCO: { price: 14.80, change: -0.67, vol: 3200000 },
    ALCN: { price: 28.50, change: 1.42, vol: 1890000 },
    CCAP: { price: 3.25, change: 3.17, vol: 24500000 },
    OIH: { price: 0.42, change: 2.44, vol: 38000000 },
    BTFH: { price: 3.12, change: 0.97, vol: 19800000 },
    TAQA: { price: 13.90, change: 0.72, vol: 1750000 },
    UBEE: { price: 18.25, change: 1.39, vol: 4200000 },
    DOMT: { price: 21.00, change: 0.48, vol: 720000 },
    ORWE: { price: 26.80, change: 1.52, vol: 1150000 },
    CIRA: { price: 16.40, change: 0.00, vol: 340000 }
  };

  const sample = samplePrices[sym] || { price: 25.00, change: 1.00, vol: 1000000 };
  return createEGXTickerRecord(sym, sample.price, sample.change, sample.vol);
});
