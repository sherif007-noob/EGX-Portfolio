import { createChart, createSeries, createSession } from '@ch99q/twc';
import { writeFile } from 'node:fs/promises';

type HistoryBar = [number, number, number, number, number, number?];
const TICKERS = ["AALR","ABUK","ACAMD","ACAP","ACFR","ACGC","ACTF","ADCI","ADIB","ADPC","ADRI","AFDI","AFMC","AIDC","AIFI","AIH","AJWA","ALCN","ALEX","ALUM","AMER","AMES","AMIA","AMII","AMOC","AMPI","ANCC","APPC","APSW","ARAB","ARCC","AREH","ASCM","ASPI","ATLC","ATQA","AUTO","AXPH","BIDI","BIGP","BINV","BIOC","BONY","BTFH","CAED","CANA","CCAP","CCRS","CEFM","CERA","CFGH","CICH","CIEB","CIRA","CLHO","CNFN","COMI","COPR","COSG","CPCI","CPME","CRST","CSAG","DAPH","DCCC","DCRC","DEIN","DGTZ","DOMT","DSCW","DTPP","EALR","EASB","EAST","EBSC","ECAP","EDFM","EEII","EEP","EFAC","EFIC","EFID","EFIH","EGAL","EGAS","EGBE","EGCH","EGREF","EGS30AJ1C016-EGP","EGS370O1C013","EGS385S1C012","EGS3E071C013-EGP","EGS48271C018-EGP","EGS65101C015","EGS65621C012","EGS65861C014","EGS659O1C015","EGS72L31C011","EGS73M81C012","EGSA","EGTS","EGWA","EITP","EKHO","ELEC","ELKA","ELNA","ELSH","ELWA","EMFD","ENGC","EOSB","EPCO","EPPK","ESRS","ETEL","ETRS","EXPA","FAIT","FAITA","FCMD","FIRE","FNAR","FTNS","FWRY","GBCO","GDWA","GEOS","GGCC","GGRN","GIHD","GMCI","GOUR","GPIM","GPPL","GRCA","GROV","GSSC","GTEX","GTHE","GTWL","HBCO","HDBK","HDST","HELI","HRHO","IBCT","ICFC","ICID","ICLE","IDRE","IEEC","IFAP","INEG","INFI","IRAX","IRON","ISMA","ISMQ","ISPH","JUFO","KABO","KNGC","KORA","KRDI","KRRE","KWIN","KZPC","LCSW","LKGP","LUTS","MAAL","MASR","MBEG","MBSC","MCQE","MCRO","MEGM","MENA","MEPA","MFPC","MFSC","MHOT","MICH","MILS","MIPH","MISR","MLIC","MMAT","MNHD","MOED","MOIL","MOIN","MOSC","MPCI","MPCO","MPRC","MTIE","NAHO","NARE","NBKE","NCCW","NCGC","NDRL","NEDA","NHPS","NINH","NIPH","NMIN","OBRI","OCDI","OCPH","ODIN","OFH","OIH","OLFI","ORAS","ORHD","ORWE","OTMT","PACH","PHAR","PHDC","PHGC","PHTV","PIOH","POCO","POUL","PRCL","PRDC","PRMH","QNBA","QNBE","QNBF","RACC","RAKT","RAYA","RKAZ","RMDA","RMTV","ROTO","RREI","RTVC","RUBX","SAIB","SAUD","SCEM","SCFM","SCTS","SDTI","SEIG","SEIGA","SIEG","SINA","SIPC","SKPC","SMFR","SMPP","SNFC","SNFI","SPHT","SPIN","SPMD","SUCE","SUGR","SVCE","SWDY","TALM","TANM","TAQA","TMGH","TORA","TRTO","TWSA","TYCN","UBEE","UBEG","UEFM","UEGC","UNIP","UNIT","UPMS","UTOP","VALU","VERT","VLMR","VLMRA","WATP","WCDF","WKOL","YAYT","ZEOT","ZMID"];
const ALIASES: Record<string,string> = { QNBA:'QNBF', MNHD:'MASR', AUTO:'GBCO', OTMT:'OIH', UBEG:'UBEE' };

const startDate = process.env.EGX_HISTORY_START || '2026-09-01';
const endDate = process.env.EGX_HISTORY_END || '2026-09-18';
const startTs = Math.floor(new Date(startDate+'T00:00:00Z').getTime()/1000);
const endTs = Math.floor(new Date(endDate+'T23:59:59Z').getTime()/1000);

const session = await createSession();
const output: Record<string, Array<{trading_date:string,open:number,high:number,low:number,close:number,volume:number|null}>> = {};
const failures: Record<string,string> = {};
try {
  const chart = await createChart(session);
  for (const ticker of TICKERS) {
    try {
      const resolved = await chart.resolve(ALIASES[ticker] || ticker, 'EGX');
      const series = await createSeries(session, chart, resolved, '1D', 0, [startTs,endTs]);
      try {
        output[ticker] = ((series.history || []) as HistoryBar[]).map(bar => ({
          trading_date: new Date(Number(bar[0])*1000).toISOString().slice(0,10),
          open: Number(bar[1]), high: Number(bar[2]), low: Number(bar[3]), close: Number(bar[4]),
          volume: Number.isFinite(Number(bar[5])) ? Number(bar[5]) : null
        })).filter(row => row.trading_date >= startDate && row.trading_date <= endDate && Number.isFinite(row.close) && row.close > 0);
        console.log(ticker+': '+output[ticker].length+' rows');
      } finally {
        await series.close();
      }
    } catch (error) {
      failures[ticker] = error instanceof Error ? error.message : String(error);
      console.error(ticker+': failed - '+failures[ticker]);
    }
  }
} finally {
  await session.close();
}
await writeFile('egx-history-export.json', JSON.stringify({startDate,endDate,output,failures}, null, 2));
console.log('Export complete', {successful:Object.keys(output).length, failures:Object.keys(failures).length});
