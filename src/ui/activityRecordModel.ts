import type { TradeTransaction } from '../types';
import { isCashLedgerRecord, isSecurityTrade } from '../services/ledgerRecordTypes';
import { normalizeCashFlowType, cashFlowSignedImpact } from '../services/cashFlowSemantics';
import { ipoHeldAmount } from '../services/ipoSubscriptions';
import { formatCairoExecutionTime } from './format';
import { formatActivityDate } from './SimpleActivityShared';

export type ActivityCategory = 'TRADE' | 'CASH' | 'CORPORATE' | 'IPO' | 'OPENING';
export interface ActivityRecordView {
  category: ActivityCategory;
  title: string;
  subtitle: string;
  amount: number | null;
  positive: boolean | null;
  amountCaption: string;
  details: Array<{ label: string; value: string }>;
}

const money = (value: number) => new Intl.NumberFormat('en-EG',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value) + ' EGP';
const units = (value: number) => new Intl.NumberFormat('en-EG',{maximumFractionDigits:6}).format(value);
const human = (value: string) => value.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
function cashCategory(tx:TradeTransaction) {
  const explicit=normalizeCashFlowType(tx.cashFlowType);
  if(explicit)return explicit;
  return tx.type==='SELL'?'WITHDRAWAL':'DEPOSIT'; // legacy CASH row
}

export function activityRecordView(tx: TradeTransaction): ActivityRecordView {
  if (isCashLedgerRecord(tx)) {
    const category=cashCategory(tx);
    const raw=tx.cashFlowAmount ?? tx.totalAmount;
    const signed=cashFlowSignedImpact(category,raw) ?? (tx.type==='BUY'?Math.abs(Number(raw)):-Math.abs(Number(raw)));
    return {
      category:'CASH',title:human(category),subtitle: 'Cash ledger event',
      amount:Number.isFinite(signed)?signed:null,positive:Number.isFinite(signed)?signed>=0:null,
      amountCaption:'EGP cash movement',
      details:[
        {label:'Cash event',value:human(category)},
        {label:'Amount',value:Number.isFinite(signed)?money(signed):'Unavailable'},
        {label:'Date',value:formatActivityDate(tx.date)},
        {label:'Time (Cairo)',value:formatCairoExecutionTime(tx.executedAt)},
      ],
    };
  }
  if(tx.type==='IPO_SUBSCRIPTION') {
    const ipo=tx.ipoSubscription;
    const held=ipo?ipoHeldAmount(ipo):null;
    const status=ipo?.status ?? 'UNVERIFIED';
    return {
      category:'IPO',title:tx.ticker,subtitle:`IPO subscription · ${human(status)}`,
      amount:held,positive:null,amountCaption:status==='SUBMITTED'?'EGP held':'EGP originally held',
      details:[
        {label:'Status',value:human(status)},
        {label:'Full order',value:ipo?money(ipo.requestedAmount):money(tx.totalAmount)},
        {label:'Broker cash hold',value:held===null?'Not recorded':money(held)},
        {label:'Shares requested',value:ipo?units(ipo.requestedShares):units(tx.shares)},
        {label:'Offer price',value:ipo?money(ipo.offerPrice):money(tx.price)},
        ...(ipo?.allocatedShares!==undefined?[{label:'Shares allocated',value:units(ipo.allocatedShares)}]:[]),
        ...(ipo?.refundAmount!==undefined?[{label:'Cash released',value:money(ipo.refundAmount)}]:[]),
        ...(ipo?.additionalPaymentAmount!==undefined&&ipo.additionalPaymentAmount>0?[{label:'Additional cash at settlement',value:money(ipo.additionalPaymentAmount)}]:[]),
        {label:'Order date',value:formatActivityDate(ipo?.subscriptionDate ?? tx.date)},
        {label:'Order time (Cairo)',value:formatCairoExecutionTime(tx.executedAt)},
      ],
    };
  }
  if(tx.type==='CORPORATE_ACTION') {
    const type=tx.corporateActionType??'OTHER';
    const free=type==='BONUS_SHARES'||type==='STOCK_DIVIDEND';
    return {
      category:'CORPORATE',title:tx.ticker,subtitle:free?'Free shares / corporate action':human(type),
      amount:null,positive:null,
      amountCaption:free?'free shares':'Corporate action',
      details:[
        {label:'Action',value:human(type)},
        ...(free?[{label:'Shares received',value:units(tx.shares)}]:[]),
        ...(tx.corporateActionSourceShares!==undefined?[{label:'Original shares',value:units(tx.corporateActionSourceShares)}]:[]),
        ...(tx.corporateActionRatio!==undefined?[{label:'Bonus ratio',value:String(tx.corporateActionRatio)}]:[]),
        ...(tx.corporateActionReference?[{label:'Reference',value:tx.corporateActionReference}]:[]),
        {label:'Effective date',value:tx.date},
      ],
    };
  }
  if(tx.type==='OPENING_POSITION'){
    return {category:'OPENING',title:tx.ticker,subtitle:'Opening holdings record',amount:null,positive:null,
      amountCaption:'Legacy opening position',
      details:[{label:'Opening shares',value:units(tx.shares)},{label:'Reference price',value:money(tx.price)},
        {label:'Recorded date',value:tx.date}]};
  }
  if(isSecurityTrade(tx)){
    const sell=tx.type==='SELL';
    const gross=tx.shares*tx.price;
    return {category:'TRADE',title:tx.ticker,subtitle:sell?'Sell execution':'Buy execution',
      amount:Number.isFinite(tx.totalAmount)?tx.totalAmount:gross+(sell?-(tx.fees||0):(tx.fees||0)),
      positive:null, amountCaption:'EGP executed',
      details:[
        {label:'Side',value:tx.type},
        {label:'Shares',value:units(tx.shares)},
        {label:'Price / share',value:money(tx.price)},
        {label:'Gross trade',value:money(gross)},
        {label:'Broker fees',value:money(tx.fees||0)},
        {label:sell?'Net proceeds':'Total paid',value:money(tx.totalAmount)},
        {label:'Execution date',value:formatActivityDate(tx.date)},
        {label:'Time (Cairo)',value:formatCairoExecutionTime(tx.executedAt)},
      ],
    };
  }
  return {category:'CORPORATE',title:tx.ticker,subtitle:human(tx.type),amount:null,positive:null,
    amountCaption:'Ledger record',details:[{label:'Type',value:human(tx.type)},{label:'Date',value:tx.date}]};
}
