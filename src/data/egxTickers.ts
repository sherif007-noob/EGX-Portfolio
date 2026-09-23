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
  ORAS: { nameEn: 'Orascom Construction PLC', nameAr: 'أوراسكوم كونستراكشون', sector: 'Contracting & Construction', isin: 'EGS95001C011' },
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
  CIEB: { nameEn: 'Credit Agricole Egypt', nameAr: 'كريدي أجريكول مصر', sector: 'Banking', isin: 'EGS60041C018' },
  HDBK: { nameEn: 'Housing & Development Bank', nameAr: 'بنك التعمير والإسكان', sector: 'Banking', isin: 'EGS60041C018' },
  QNBE: { nameEn: 'Qatar National Bank', nameAr: 'بنك قطر الوطني', sector: 'Banking', isin: 'EGS60081C014' },
  QNBF: { nameEn: 'Qatar National Bank', nameAr: 'بنك قطر الوطني', sector: 'Banking', isin: 'EGS60081C014' },
  QNBA: { nameEn: 'Qatar National Bank', nameAr: 'بنك قطر الوطني', sector: 'Banking', isin: 'EGS60081C014' },
  SAUD: { nameEn: 'Al Baraka Bank Egypt', nameAr: 'بنك البركة مصر', sector: 'Banking', isin: 'EGS60101C010' },
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
  RAYA: { nameEn: 'Raya Holding for Financial Investments', nameAr: 'راية القابضة للاستثمارات المالية', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS69091C012' },
  RACC: { nameEn: 'Raya Customer Experience', nameAr: 'راية لخدمات مراكز الاتصالات', sector: 'Industrial Goods & Services', isin: 'EGS74081C010' },
  ACAMD: { nameEn: 'Arab Co. for Asset Management', nameAr: 'العربية لإدارة وتطوير الأصول', sector: 'Real Estate & Construction', isin: 'EGS65601C014' },
  TAQA: { nameEn: 'TAQA Arabia', nameAr: 'طاقة عربية', sector: 'Energy & Oil Services', isin: 'EGS738J1C019' },
  UBEE: { nameEn: 'The United Bank', nameAr: 'المصرف المتحد', sector: 'Banking', isin: 'EGS60151C015' },
  UBEG: { nameEn: 'The United Bank', nameAr: 'المصرف المتحد', sector: 'Banking', isin: 'EGS60151C015' },
  DOMT: { nameEn: 'Arabian Food Industries (Domty)', nameAr: 'الصناعات الغذائية العربية - دومتي', sector: 'Food, Beverage & Tobacco', isin: 'EGS30931C017' },
  OBRI: { nameEn: 'El Ebour Co. for Real Estate Investment', nameAr: 'العبور للاستثمار العقاري', sector: 'Real Estate & Construction', isin: 'EGS65551C011' },
  ECAP: { nameEn: 'El Ezz Porcelain (Gemma)', nameAr: 'العز للسيراميك والبورسلين - الجوهرة', sector: 'Building Materials & Cement', isin: 'EGS3C071C015' },
  EFIC: { nameEn: 'Egyptian Financial and Industrial SAE', nameAr: 'المالية والصناعية المصرية', sector: 'Petrochemicals & Fertilizers', isin: 'EGS38181C011' },
  PRDC: { nameEn: 'Pioneers Properties for Urban Development', nameAr: 'بايونيرز بروبرتيز للتنمية العمرانية', sector: 'Real Estate & Construction', isin: 'EGS65621C012' },
  ASPI: { nameEn: 'Aspire Capital Holding for Financial Investments', nameAr: 'أسباير كابيتال القابضة للاستثمارات المالية', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS691L1C018' },
  PIOH: { nameEn: 'Aspire Capital Holding for Financial Investments', nameAr: 'أسباير كابيتال القابضة للاستثمارات المالية', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS691L1C018' },
  ASCM: { nameEn: 'Asek Company for Mining (ASCOM)', nameAr: 'أسيك للتعدين - أسكوم', sector: 'Basic Resources & Steel', isin: 'EGS10021C011' },
  MTIE: { nameEn: 'MM Group for Industry & International Trade', nameAr: 'إم إم جروب للصناعة والتجارة العالمية', sector: 'Trade & Distributors', isin: 'EGS3G111C010' },
  CSAG: { nameEn: 'Canal Shipping Agencies', nameAr: 'القناة للتوكيلات الملاحية', sector: 'Transport & Logistics', isin: 'EGS42031C010' },
  SPMD: { nameEn: 'Speed Medical', nameAr: 'سبيد ميديكال', sector: 'Healthcare & Pharmaceuticals', isin: 'EGS729S1C019' },
  AIHC: { nameEn: 'Arabia Investments Holding', nameAr: 'عربية للاستثمارات القابضة', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS21351C019' },
  AIH: { nameEn: 'Arabia Investments Holding', nameAr: 'عربية للاستثمارات القابضة', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS21351C019' },
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
  NARE: { nameEn: 'Naeem Real Estate Holding Group', nameAr: 'النعيم القابضة للاستثمارات العقارية', sector: 'Real Estate & Construction', isin: 'EGS69191C012' },
  KRRE: { nameEn: 'Legacy / inactive security', nameAr: 'ورقة مالية تاريخية', sector: 'Other', isin: 'EGS691Y1C011' },
  CIRA: { nameEn: 'Cairo Investment & Real Estate Development (CIRA Education)', nameAr: 'القاهرة للاستثمار والتنمية العقارية', sector: 'Education & Services', isin: 'EGS73861C012' },
  TALM: { nameEn: 'Taaleem Management Services', nameAr: 'تعليم لخدمات الإدارة', sector: 'Education & Services', isin: 'EGS738H1C013' },
  MOIL: { nameEn: 'Maridive & Oil Services', nameAr: 'الخدمات الملاحية والبترولية - ماريديف', sector: 'Energy & Oil Services', isin: 'EGS49022C015' },
  BINV: { nameEn: 'B Investments Holding', nameAr: 'بي إنفستمنتس القابضة', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS691Z1C010' },
  VALU: { nameEn: 'valU Financial Technologies', nameAr: 'فاليو لخدمات التمويل الاستهلاكي', sector: 'Non-Bank Financial Services & Fintech', isin: 'EGS745M1C013' },
  MPCO: { nameEn: 'Mansoura Poultry', nameAr: 'المنصورة للدواجن', sector: 'Food, Beverage & Tobacco', isin: 'EGS30371C012' },
  UEGC: { nameEn: 'El-Saeed Contracting & Real Estate Investment Co. (SCCD)', nameAr: 'الصعيد العامة للمقاولات والاستثمار العقاري', sector: 'Real Estate & Construction', isin: 'EGS65511C015' },
  SCEM: { nameEn: 'Sinai Cement Co.', nameAr: 'أسمنت سيناء', sector: 'Building Materials & Cement', isin: 'EGS3C051C015' },
  KORA: { nameEn: 'Korra for Energy and Investment Projects', nameAr: 'قرة لمشروعات الطاقة والاستثمار', sector: 'Contracting & Construction', isin: 'EGS07911C018' },
  NAPR: { nameEn: 'National Printing', nameAr: 'الوطنية للطباعة', sector: 'Paper & Packaging', isin: 'EGS370O1C013' },
  CANA: { nameEn: 'Suez Canal Bank', nameAr: 'بنك قناة السويس', sector: 'Banking', isin: 'EGS60091C013' },
  ZMID: { nameEn: 'Zahraa Maadi Investment & Development', nameAr: 'زهراء المعادي للاستثمار والتعمير', sector: 'Real Estate & Construction', isin: 'EGS65101C016' },
  LUTS: { nameEn: 'Lotus For Agricultural Investments & Development', nameAr: 'لوتس للتنمية والاستثمار الزراعي', sector: 'Food, Beverage & Tobacco', isin: 'EGS07271C019' },
  AFMC: { nameEn: 'Alexandria Flour Mills Co.', nameAr: 'مطاحن ومخابز الإسكندرية', sector: 'Food, Beverage & Tobacco', isin: 'EGS30441C013' },
  MCRO: { nameEn: 'Macro Group Pharmaceutical (Macro Capital)', nameAr: 'ماكرو جروب للمستحضرات الطبية - ماكرو كابيتال', sector: 'Healthcare & Pharmaceuticals', isin: 'EGS729R1C010' },
  BONY: { nameEn: 'Bonyan for Development and Trade', nameAr: 'بنيان للتنمية والتجارة', sector: 'Real Estate & Construction', isin: 'EGS65671C017' }
};

/**
 * Historical/renamed symbols accepted when importing old portfolio data.
 * The values are the currently active EGX symbols; legacy keys are never
 * seeded as separate active directory rows.
 */
export const LEGACY_TICKER_ALIASES: Record<string, string> = {
  QNBA: 'QNBE',
  QNBF: 'QNBE',
  MNHD: 'MASR',
  AUTO: 'GBCO',
  OTMT: 'OIH',
  UBEG: 'UBEE',
  AIH: 'AIHC',
  PIOH: 'ASPI',
  REAC: 'NARE',
};

/** Static fallback rows that should not be advertised as active equities. */
export const RETIRED_BASELINE_TICKERS = new Set([
  'ESRS', // delisting process / no longer part of current active universe
  'EKHO', // renamed to Valmore Holding; live scanner discovers VLMR/VLMRA
  'KRRE',
  ...Object.keys(LEGACY_TICKER_ALIASES),
]);

export function mapMarketClassificationToSector(
  marketSector?: string,
  industry?: string,
  fallback: Sector = 'Other',
): Sector {
  const value = `${marketSector || ''} ${industry || ''}`.toLowerCase();

  if (/bank/.test(value)) return 'Banking';
  if (/real estate|property/.test(value)) return 'Real Estate & Construction';
  if (/engineering|construction|contracting/.test(value)) return 'Contracting & Construction';
  if (/paper|packag|printing/.test(value)) return 'Paper & Packaging';
  if (/cement|ceramic|porcelain|building material/.test(value)) return 'Building Materials & Cement';
  if (/steel|alumin|mining|metal/.test(value)) return 'Basic Resources & Steel';
  if (/fertili|petrochem|chemical/.test(value)) return 'Petrochemicals & Fertilizers';
  if (/pharma|health|hospital|medical/.test(value)) return 'Healthcare & Pharmaceuticals';
  if (/food|beverage|tobacco|poultry|flour|agri/.test(value)) return 'Food, Beverage & Tobacco';
  if (/education|school/.test(value)) return 'Education & Services';
  if (/hotel|tourism|leisure|resort/.test(value)) return 'Tourism & Leisure';
  if (/telecom|communication|media/.test(value)) return 'Telecommunications & Media';
  if (/shipping|transport|logistic|marine/.test(value)) return 'Transport & Logistics';
  if (/textile|apparel|carpet|consumer durable/.test(value)) return 'Textiles & Consumer Durables';
  if (/retail|distribut|wholesale|trade/.test(value)) return 'Trade & Distributors';
  if (/oil|drilling|energy service/.test(value)) return 'Energy & Oil Services';
  if (/utilit/.test(value)) return 'Utilities';
  if (/finance|financial|investment|insurance|leasing|broker/.test(value)) {
    return 'Non-Bank Financial Services & Fintech';
  }
  if (/industrial|manufactur|electrical|automobile|auto /.test(value)) return 'Industrial Goods & Services';

  return fallback;
}

export function canonicalizeEGXSymbol(symbol: string): string {
  const cleaned = symbol.trim().toUpperCase().replace(/^EGX:/, '').replace(/\.CA$/, '');
  const migrated = LEGACY_TICKER_ALIASES[cleaned] || cleaned;
  if (EGX_STOCK_DICTIONARY[migrated]) return migrated;

  const isinMatch = Object.entries(EGX_STOCK_DICTIONARY).find(
    ([ticker, metadata]) =>
      !RETIRED_BASELINE_TICKERS.has(ticker) &&
      metadata.isin?.toUpperCase() === migrated,
  );
  return isinMatch?.[0] || migrated;
}

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
  logoIdOrUrl?: string,
  changeAbs?: number,
  marketSector?: string,
  industry?: string,
  scannerIsin?: string,
): EGXTicker {
  const upper = canonicalizeEGXSymbol(ticker);
  const dict = EGX_STOCK_DICTIONARY[upper];

  const hasLiveMetadata = Boolean(description || marketSector || industry || scannerIsin);
  const nameEn = (hasLiveMetadata && description) || dict?.nameEn || description || `${upper} Corp`;
  const nameAr = dict?.nameAr || `${upper} مصر`;
  const sector = mapMarketClassificationToSector(
    marketSector,
    industry,
    dict?.sector || 'Other',
  );
  const isin = scannerIsin || dict?.isin || '';
  const logoUrl = getTradingViewLogoUrl(upper, logoIdOrUrl);

  // Use exact change_abs from TradingView/Exchange if available;
  // otherwise calculate exact previous close difference: (price - prevClose)
  let change = 0;
  if (changeAbs !== undefined && !isNaN(changeAbs)) {
    change = Math.round(changeAbs * 100) / 100;
  } else if (changePercent !== 0 && price > 0) {
    const prevClose = price / (1 + changePercent / 100);
    change = Math.round((price - prevClose) * 100) / 100;
  }

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
    logoUrl,
    marketSector,
    industry,
    metadataSource: hasLiveMetadata ? 'tradingview' : 'baseline',
  };
}

export const INITIAL_EGX_TICKERS: EGXTicker[] = Object.keys(EGX_STOCK_DICTIONARY)
  .filter((sym) => !RETIRED_BASELINE_TICKERS.has(sym))
  .map((sym) => createEGXTickerRecord(sym, 0, 0, 0));

export function mergeTickerDirectoryWithBaseline(existing: EGXTicker[]): EGXTicker[] {
  const byTicker = new Map<string, EGXTicker>();

  for (const ticker of existing || []) {
    const canonical = canonicalizeEGXSymbol(ticker.ticker);
    byTicker.set(canonical, { ...ticker, ticker: canonical });
  }

  for (const baseline of INITIAL_EGX_TICKERS) {
    const current = byTicker.get(baseline.ticker);
    if (!current) {
      byTicker.set(baseline.ticker, baseline);
      continue;
    }

    const liveMetadata = current.metadataSource === 'tradingview';
    byTicker.set(baseline.ticker, {
      ...baseline,
      ...current,
      ticker: baseline.ticker,
      nameEn: liveMetadata ? current.nameEn : baseline.nameEn,
      nameAr: baseline.nameAr || current.nameAr,
      sector: liveMetadata ? current.sector : baseline.sector,
      isin: liveMetadata ? (current.isin || baseline.isin) : (baseline.isin || current.isin),
      marketSector: current.marketSector,
      industry: current.industry,
      metadataSource: liveMetadata ? 'tradingview' : 'baseline',
    });
  }

  return Array.from(byTicker.values()).sort((a, b) => a.ticker.localeCompare(b.ticker));
}
