import React, { useState, useRef, useMemo } from 'react';
import { runVisualTransition } from '../utils/visualTransition';
import { MotionSwap, PremiumModalMotion, SurfacePresence } from './PremiumMotion';
import { createPortal } from 'react-dom';
import { AnalyticsSelect } from './AnalyticsSelect';
import { NumberStepperInput } from './NumberStepperInput';
import { CashTransaction, Position, ClosedTrade, TradeTransaction } from '../types';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Trash2,
  Edit3,
  PlusCircle,
  MinusCircle,
  AlertCircle,
  CheckCircle2,
  PieChart,
  History,
  X,
  Save,
  Check,
  Calculator,
  Layers,
  HelpCircle,
  TrendingUp,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react';
import { DateInput } from './DateInput';
import { getTodayISO } from '../utils/dateUtils';
import { buildCashHistory } from '../services/cashLedger';
import { reconcilePortfolioFromLedger } from '../services/portfolioReconciliation';

interface CashBalanceViewProps {
  cashBalance: number;
  totalPortfolioValue: number;
  onUpdateCashBalance: (newBalance: number) => void;
  positions?: Position[];
  closedTrades?: ClosedTrade[];
  tradeTransactions?: TradeTransaction[];
  capitalDeposits?: number;
  onAddCashTransaction: (amount: number, type: 'DEPOSIT' | 'WITHDRAW' | 'DIVIDEND', notes?: string, date?: string) => Promise<boolean>;
  onEditCashTransaction: (tx: CashTransaction) => Promise<boolean>;
  onDeleteCashTransaction: (id: string) => Promise<boolean>;
  onReconcileLedger?: () => void;
}

export const CashBalanceView: React.FC<CashBalanceViewProps> = ({
  cashBalance,
  totalPortfolioValue,
  onUpdateCashBalance,
  positions = [],
  closedTrades = [],
  tradeTransactions = [],
  capitalDeposits,
  onAddCashTransaction,
  onEditCashTransaction,
  onDeleteCashTransaction,
  onReconcileLedger,
}) => {
  const [activeAction, setActiveAction] = useState<'deposit' | 'withdraw'>('deposit');
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [depositMethod, setDepositMethod] = useState<string>('Bank Transfer (InstaPay/Wire)');
  const [depositNotes, setDepositNotes] = useState<string>('');
  const [depositDate, setDepositDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawDestination, setWithdrawDestination] = useState<string>('Bank Account Transfer');
  const [withdrawNotes, setWithdrawNotes] = useState<string>('');
  const [withdrawDate, setWithdrawDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL'>('ALL');

  // Edit Transaction State & Modal
  const [editingTransaction, setEditingTransaction] = useState<CashTransaction | null>(null);
  const lastEditingTransactionRef = useRef<CashTransaction | null>(editingTransaction);
  if (editingTransaction) lastEditingTransactionRef.current = editingTransaction;
  const displayEditingTransaction = editingTransaction ?? lastEditingTransactionRef.current;

  const requestCloseCashEdit = () => {
    runVisualTransition('modal-close', () => setEditingTransaction(null));
  };

  const changeActiveAction = (next: 'deposit' | 'withdraw') => {
    if (next === activeAction) return;
    runVisualTransition('cash-action', () => setActiveAction(next));
  };

  const changeHistoryFilter = (next: 'ALL' | 'DEPOSIT' | 'WITHDRAWAL') => {
    if (next === historyFilter) return;
    runVisualTransition('cash-history', () => setHistoryFilter(next));
  };
  const [editType, setEditType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  const transactions = useMemo(() => buildCashHistory({
    transactions: tradeTransactions, positions, tickers: [], capitalDeposits: capitalDeposits ?? 0,
  }), [tradeTransactions, positions, capitalDeposits]);

  const mutationPending = useRef(false);
  const saveCashChange = async (save: () => Promise<boolean>) => {
    if (mutationPending.current) return false;
    mutationPending.current = true;
    try {
      if (!await save()) throw new Error('Cash change could not be saved. Please try again.');
      return true;
    } catch (error) {
      setFeedbackMessage({ text: error instanceof Error ? error.message : 'Cash change could not be saved.', type: 'error' });
      return false;
    } finally {
      mutationPending.current = false;
    }
  };

  const formatEgp = (val: number) => {
    return new Intl.NumberFormat('en-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const cashRatio = totalPortfolioValue > 0 ? (cashBalance / totalPortfolioValue) * 100 : 0;

  const totalDeposits = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'DEPOSIT')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  const totalWithdrawals = useMemo(() => {
    return transactions
      .filter((t) => t.type === 'WITHDRAWAL')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  // 1. Net Capital Inflows: Uses authoritative capitalDeposits if available, or derives from ledger
  const netCapitalDeposited = useMemo(() => {
    if (typeof capitalDeposits === 'number' && Number.isFinite(capitalDeposits)) {
      return capitalDeposits;
    }
    return totalDeposits - totalWithdrawals;
  }, [capitalDeposits, totalDeposits, totalWithdrawals]);

  // 2. Open Positions Cost Basis & Current Market Value (including total purchase outlays with fees)
  const totalOpenPositionsCost = useMemo(() => {
    return positions.reduce((acc, pos) => acc + (pos.shares * pos.avgBuyPrice) + (pos.totalFees || 0), 0);
  }, [positions]);

  const totalOpenPositionsMarketValue = useMemo(() => {
    return positions.reduce((acc, pos) => acc + (pos.shares * (pos.currentPrice || pos.avgBuyPrice)), 0);
  }, [positions]);

  // 3. Realized Profit & Loss from Closed Trades / Cycles
  const totalRealizedPnl = useMemo(() => {
    return closedTrades.reduce((acc, ct) => acc + (ct.realizedPnlEgp || 0), 0);
  }, [closedTrades]);

  // 4. Canonical audited liquid cash comes from the same ledger-first accounting
  // engine used by portfolio reconciliation. Never clamp negative ledger cash to zero.
  const ledgerAudit = useMemo(() => {
    if (tradeTransactions.length === 0) return null;
    return reconcilePortfolioFromLedger(
      tradeTransactions,
      [],
      typeof capitalDeposits === 'number' ? capitalDeposits : 0,
      positions
    );
  }, [tradeTransactions, capitalDeposits, positions]);
  const auditedLiquidCash = ledgerAudit?.reconciledCashBalance ?? cashBalance;

  // 5. Audited Portfolio Equity (NAV)
  const auditedPortfolioNav = auditedLiquidCash + totalOpenPositionsMarketValue;

  // 6. Cash Discrepancy detection
  const cashDiscrepancy = cashBalance - auditedLiquidCash;
  const hasDiscrepancy = Math.abs(cashDiscrepancy) > 1.0;

  // Open Edit Modal for a specific transaction
  const handleStartEdit = (tx: CashTransaction) => {
    setEditingTransaction(tx);
    setEditType(tx.type);
    setEditAmount(String(tx.amount));
    setEditDate(tx.date);
    setEditNotes(tx.notes || '');
  };

  // Save changes to edited transaction
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTransaction) return;

    const newAmountNum = parseFloat(editAmount);
    if (isNaN(newAmountNum) || newAmountNum <= 0) {
      setFeedbackMessage({ text: 'Please enter a valid amount greater than 0 EGP.', type: 'error' });
      return;
    }

    if (!editDate) {
      setFeedbackMessage({ text: 'Please select a valid date.', type: 'error' });
      return;
    }

    // Calculate balance difference. Negative cash is a valid ledger state and must not be silently clamped.
    const oldContribution = displayEditingTransaction.type === 'DEPOSIT' ? displayEditingTransaction.amount : -displayEditingTransaction.amount;
    const newContribution = editType === 'DEPOSIT' ? newAmountNum : -newAmountNum;
    const delta = newContribution - oldContribution;
    const newBalance = Number((cashBalance + delta).toFixed(2));

    const updatedTx: CashTransaction = {
      ...editingTransaction,
      type: editType,
      amount: newAmountNum,
      date: editDate,
      notes: editNotes.trim(),
      balanceAfter: newBalance,
    };

    if (!await saveCashChange(() => onEditCashTransaction(updatedTx))) return;
    requestCloseCashEdit();

    setFeedbackMessage({
      text: `Transaction updated successfully! Cash balance adjusted to ${formatEgp(newBalance)} EGP.`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Handle Deposit
  const handleConfirmDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(depositAmount);
    if (!amountNum || amountNum <= 0) {
      setFeedbackMessage({ text: 'Please enter a valid deposit amount greater than 0 EGP.', type: 'error' });
      return;
    }

    const newBalance = Number((cashBalance + amountNum).toFixed(2));
    const noteText = `${depositMethod}${depositNotes ? ` - ${depositNotes}` : ''}`;
    if (!await saveCashChange(() => onAddCashTransaction(amountNum, 'DEPOSIT', noteText, depositDate || getTodayISO()))) return;
    setDepositAmount('');
    setDepositNotes('');
    setFeedbackMessage({
      text: `Successfully deposited ${formatEgp(amountNum)} EGP. New cash balance: ${formatEgp(newBalance)} EGP.`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Handle Withdrawal
  const handleConfirmWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (!amountNum || amountNum <= 0) {
      setFeedbackMessage({ text: 'Please enter a valid withdrawal amount greater than 0 EGP.', type: 'error' });
      return;
    }

    if (amountNum > cashBalance) {
      setFeedbackMessage({
        text: `Insufficient cash! You cannot withdraw more than your available balance (${formatEgp(cashBalance)} EGP).`,
        type: 'error',
      });
      return;
    }

    const newBalance = Number((cashBalance - amountNum).toFixed(2));
    const noteText = `${withdrawDestination}${withdrawNotes ? ` - ${withdrawNotes}` : ''}`;
    if (!await saveCashChange(() => onAddCashTransaction(amountNum, 'WITHDRAW', noteText, withdrawDate || getTodayISO()))) return;
    setWithdrawAmount('');
    setWithdrawNotes('');
    setFeedbackMessage({
      text: `Successfully withdrawn ${formatEgp(amountNum)} EGP. Remaining cash balance: ${formatEgp(newBalance)} EGP.`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const handleDeleteTransaction = async (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;

    let revertedBalance = cashBalance;
    if (tx.type === 'DEPOSIT') {
      revertedBalance = Number((cashBalance - tx.amount).toFixed(2));
    } else if (tx.type === 'WITHDRAWAL') {
      revertedBalance = Number((cashBalance + tx.amount).toFixed(2));
    }

    if (!await saveCashChange(() => onDeleteCashTransaction(id))) return;
    setFeedbackMessage({
      text: `${tx.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} record of ${formatEgp(tx.amount)} EGP removed. Cash balance adjusted to ${formatEgp(revertedBalance)} EGP.`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const filteredTransactions = transactions.filter((t) => {
    if (historyFilter === 'DEPOSIT') return t.type === 'DEPOSIT';
    if (historyFilter === 'WITHDRAWAL') return t.type === 'WITHDRAWAL';
    return true;
  });

  return (
    <div className="premium-dense-workflow space-y-6">
      {/* Top Banner */}
      <div className="premium-hierarchy-h2 premium-dense-summary flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl" data-hierarchy="h2">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            Cash Ledger &amp; Capital Balances
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Deposit capital, withdraw funds, and manage previous cash entries directly to match your brokerage cash.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <span className="text-[10px] text-emerald-500/80 block font-semibold">Available Liquid Cash</span>
            <span className="font-mono font-black text-sm">{formatEgp(cashBalance)} EGP</span>
          </div>
        </div>
      </div>

      {/* KPI Cards: Cash Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Available Cash */}
        <div className="premium-card premium-material-tone-emerald premium-hierarchy-h2 premium-dense-summary-card p-4 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <Wallet className="w-4 h-4" />
              Available Cash
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20">
              Liquid EGP
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white font-mono">{formatEgp(cashBalance)}</span>
            <span className="text-xs text-slate-400">EGP</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Portfolio Share:</span>
            <span className="font-mono font-bold text-emerald-400">{cashRatio.toFixed(1)}%</span>
          </div>
        </div>

        {/* Portfolio NAV */}
        <div className="premium-card premium-material-tone-blue premium-hierarchy-h3 premium-dense-summary-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-blue-400" />
              Total Portfolio Equity
            </span>
            <span className="text-[10px] text-slate-400">Cash + Equities</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white font-mono">{formatEgp(totalPortfolioValue)}</span>
            <span className="text-xs text-slate-400">EGP</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Equities Allocation:</span>
            <span className="font-mono font-bold text-blue-400">{(100 - cashRatio).toFixed(1)}%</span>
          </div>
        </div>

        {/* Cumulative Deposits */}
        <div className="premium-card premium-material-tone-emerald premium-hierarchy-h3 premium-dense-summary-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <ArrowDownLeft className="w-4 h-4" />
              Total Deposited
            </span>
            <span className="text-[10px] text-slate-400">All Time</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-400 font-mono">+{formatEgp(totalDeposits)}</span>
            <span className="text-xs text-slate-400">EGP</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Deposit Count:</span>
            <span className="font-mono font-medium text-slate-300">
              {transactions.filter((t) => t.type === 'DEPOSIT').length} deposits
            </span>
          </div>
        </div>

        {/* Cumulative Withdrawals */}
        <div className="premium-card premium-material-tone-rose premium-hierarchy-h3 premium-dense-summary-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-semibold text-rose-400 flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4" />
              Total Withdrawn
            </span>
            <span className="text-[10px] text-slate-400">All Time</span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-rose-400 font-mono">-{formatEgp(totalWithdrawals)}</span>
            <span className="text-xs text-slate-400">EGP</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Withdrawal Count:</span>
            <span className="font-mono font-medium text-slate-300">
              {transactions.filter((t) => t.type === 'WITHDRAWAL').length} withdrawals
            </span>
          </div>
        </div>
      </div>

      {/* Cash Ledger & Capital Accounting Reconciliation Audit Card */}
      <div className="premium-panel premium-hierarchy-h3 premium-dense-summary premium-radial p-5 rounded-2xl space-y-4" data-hierarchy="h3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Capital Ledger &amp; Cash Balance Audit
                {hasDiscrepancy ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Audited Balance ({formatEgp(auditedLiquidCash)} EGP)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    100% Balanced &amp; Reconciled
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Exact mathematical breakdown of account cash from your deposits, open positions cost outlays, and realized trade gains.
              </p>
            </div>
          </div>
        </div>

        {/* Audit Line-by-Line Breakdown Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* 1. Net Capital Inflow */}
          <div className="premium-subpanel p-3 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
              1. Net Capital Deposited
            </span>
            <div className="text-sm font-mono font-bold text-white">
              +{formatEgp(netCapitalDeposited)} EGP
            </div>
            <span className="text-[10px] text-slate-500 block">
              {transactions.filter((t) => t.type === 'DEPOSIT').length} deposits logged
            </span>
          </div>

          {/* 2. Open Positions Cost Outlay */}
          <div className="premium-subpanel p-3 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
              2. Open Positions Cost Basis
            </span>
            <div className="text-sm font-mono font-bold text-rose-400">
              -{formatEgp(totalOpenPositionsCost)} EGP
            </div>
            <span className="text-[10px] text-slate-500 block">
              {positions.length} active holdings bought
            </span>
          </div>

          {/* 3. Realized P&L */}
          <div className="premium-subpanel p-3 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">
              3. Closed Cycles Net P&amp;L
            </span>
            <div
              className={`text-sm font-mono font-bold ${
                totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalRealizedPnl >= 0 ? '+' : ''}
              {formatEgp(totalRealizedPnl)} EGP
            </div>
            <span className="text-[10px] text-slate-500 block">
              {closedTrades.length} completed cycles
            </span>
          </div>

          {/* 4. Audited Available Cash */}
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 space-y-1">
            <span className="text-[10px] text-emerald-300 font-semibold block uppercase tracking-wider">
              4. True Liquid Cash
            </span>
            <div className="text-sm font-mono font-black text-emerald-400">
              {formatEgp(auditedLiquidCash)} EGP
            </div>
            <span className="text-[10px] text-emerald-500/80 block">
              (1) - (2) + (3)
            </span>
          </div>

          {/* 5. True Total Portfolio NAV */}
          <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-500/40 space-y-1">
            <span className="text-[10px] text-blue-300 font-semibold block uppercase tracking-wider">
              5. True Portfolio NAV
            </span>
            <div className="text-sm font-mono font-black text-blue-400">
              {formatEgp(auditedPortfolioNav)} EGP
            </div>
            <span className="text-[10px] text-blue-400/80 block">
              Cash + {formatEgp(totalOpenPositionsMarketValue)} EGP Equities
            </span>
          </div>
        </div>

        {/* Explain Discrepancy Note if applicable */}
        {hasDiscrepancy && (
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-300">
                  Cash Balance Variance: {formatEgp(Math.abs(cashDiscrepancy))} EGP
                </span>
                <p className="mt-0.5 text-[11px] text-amber-200/80 leading-relaxed">
                  Recorded cash is <strong>{formatEgp(cashBalance)} EGP</strong>. Net capital deposited ({formatEgp(netCapitalDeposited)} EGP) minus active holdings cost ({formatEgp(totalOpenPositionsCost)} EGP) plus realized gains ({totalRealizedPnl >= 0 ? '+' : ''}{formatEgp(totalRealizedPnl)} EGP) indicates true liquid cash is <strong>{formatEgp(auditedLiquidCash)} EGP</strong>.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
              {onReconcileLedger && (
                <button
                  onClick={onReconcileLedger}
                  className="premium-action premium-action-success px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5"
                  title="Reconstruct ledger from all transactions and update cash and positions"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reconcile Ledger</span>
                </button>
              )}
              <button
                onClick={() => {
                  if (onReconcileLedger) {
                    onReconcileLedger();
                  } else {
                    onUpdateCashBalance(auditedLiquidCash);
                  }
                  setFeedbackMessage({
                    text: `Cash balance reconciled to ledger-derived amount of ${formatEgp(auditedLiquidCash)} EGP.`,
                    type: 'success',
                  });
                  setTimeout(() => setFeedbackMessage(null), 4000);
                }}
                className="premium-action premium-action-warning px-3.5 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Apply Audited Balance ({formatEgp(auditedLiquidCash)} EGP)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feedback message banner */}
      <SurfacePresence isOpen={!!feedbackMessage}>
        {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs sm:text-sm font-semibold ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
        )}
      </SurfacePresence>

      {/* Main Operations Card: Deposit or Withdraw */}
      <div className="premium-panel premium-hierarchy-h3 premium-dense-summary p-4 sm:p-5 rounded-2xl space-y-5" data-hierarchy="h3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white">Record New Cash Transfer</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Deposit new capital or record cash withdrawals.
            </p>
          </div>

          <div className="premium-selector-shell flex w-full items-center gap-1.5 sm:w-auto">
            <button
              id="action-select-deposit"
              aria-pressed={activeAction === 'deposit'}
              onClick={() => changeActiveAction('deposit')}
              className={`premium-filter-pill flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold sm:flex-none ${activeAction === 'deposit' ? 'premium-filter-active-emerald' : ''}`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Deposit Cash
            </button>
            <button
              id="action-select-withdraw"
              aria-pressed={activeAction === 'withdraw'}
              onClick={() => changeActiveAction('withdraw')}
              className={`premium-filter-pill flex min-w-0 flex-1 items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold sm:flex-none ${activeAction === 'withdraw' ? 'premium-filter-active-rose' : ''}`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Withdraw Cash
            </button>
          </div>
        </div>

        <MotionSwap motionKey={activeAction} variant="state" className="premium-cash-action-content">
        {/* Deposit Form */}
        {activeAction === 'deposit' && (
          <form onSubmit={handleConfirmDeposit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Deposit Amount */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Deposit Amount (EGP)</span>
                  <span className="text-[11px] text-slate-400">Current Balance: {formatEgp(cashBalance)} EGP</span>
                </label>
                <div className="relative">
                  <NumberStepperInput
                    id="deposit-amount-input"
                    step={0.01}
                    min={1}
                    placeholder="e.g. 50000"
                    value={depositAmount}
                    onValueChange={setDepositAmount}
                    accent="emerald"
                    required
                    className="premium-field w-full px-3.5 py-2.5 rounded-xl text-white placeholder-slate-500 text-sm font-mono focus:outline-none"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    EGP
                  </span>
                </div>

                {/* Quick Add Preset Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-400 mr-1">Quick add:</span>
                  {[5000, 10000, 25000, 50000, 100000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setDepositAmount(String((parseFloat(depositAmount) || 0) + amt))}
                      className="premium-action px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium"
                    >
                      +{amt >= 1000 ? `${amt / 1000}k` : amt}
                    </button>
                  ))}
                  {depositAmount && (
                    <button
                      type="button"
                      onClick={() => setDepositAmount('')}
                      className="premium-action premium-action-danger px-2 py-1 rounded-lg text-[11px]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Deposit Method & Date */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DateInput
                    id="deposit-date"
                    label="Deposit Date"
                    value={depositDate}
                    onChange={setDepositDate}
                    required
                  />

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Funding Method</label>
                    <AnalyticsSelect
                      value={depositMethod}
                      onChange={(value) => setDepositMethod(String(value))}
                      accent="emerald"
                      ariaLabel="Funding method"
                      options={[
                        { value: 'Bank Transfer (InstaPay/Wire)', label: 'Bank Transfer (InstaPay/Wire)' },
                        { value: 'Brokerage Account Deposit', label: 'Brokerage Account Deposit' },
                        { value: 'Initial Capital Investment', label: 'Initial Capital Investment' },
                        { value: 'Cash / ATM Deposit', label: 'Cash / ATM Deposit' },
                        { value: 'Cheque Deposit', label: 'Cheque Deposit' },
                        { value: 'Other Capital Inflow', label: 'Other Capital Inflow' },
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Notes / Reference (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. CIB Wire ref #98321 or Monthly Savings addition"
                    value={depositNotes}
                    onChange={(e) => setDepositNotes(e.target.value)}
                    className="premium-field w-full px-3 py-2 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Impact Calculation Preview */}
            {parseFloat(depositAmount) > 0 && (
              <div className="premium-modal-section p-3.5 rounded-xl border-emerald-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-300">
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                  <span>
                    Depositing <strong>{formatEgp(parseFloat(depositAmount))} EGP</strong>
                  </span>
                </div>
                <div className="text-slate-300">
                  Projected Cash Balance:{' '}
                  <strong className="font-mono text-emerald-400 text-sm font-bold">
                    {formatEgp(cashBalance + parseFloat(depositAmount))} EGP
                  </strong>
                </div>
              </div>
            )}

            <button
              id="submit-deposit-btn"
              type="submit"
              className="premium-action premium-action-success premium-shimmer-border w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Confirm Cash Deposit
            </button>
          </form>
        )}

        {/* Withdrawal Form */}
        {activeAction === 'withdraw' && (
          <form onSubmit={handleConfirmWithdrawal} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Withdrawal Amount */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Withdrawal Amount (EGP)</span>
                  <span className="text-[11px] text-emerald-400 font-mono">Available: {formatEgp(cashBalance)} EGP</span>
                </label>
                <div className="relative">
                  <NumberStepperInput
                    id="withdraw-amount-input"
                    step={0.01}
                    min={1}
                    max={cashBalance}
                    placeholder="e.g. 15000"
                    value={withdrawAmount}
                    onValueChange={setWithdrawAmount}
                    accent="rose"
                    required
                    className="premium-field w-full px-3.5 py-2.5 rounded-xl text-white placeholder-slate-500 text-sm font-mono focus:outline-none"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    EGP
                  </span>
                </div>

                {/* Quick % Withdrawal Chips */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-400 mr-1">Quick select:</span>
                  {[
                    { label: '25%', ratio: 0.25 },
                    { label: '50%', ratio: 0.5 },
                    { label: '75%', ratio: 0.75 },
                    { label: '100% (All Cash)', ratio: 1.0 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setWithdrawAmount((cashBalance * preset.ratio).toFixed(2))}
                      disabled={cashBalance <= 0}
                      className="premium-action px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium disabled:opacity-40"
                    >
                      {preset.label}
                    </button>
                  ))}
                  {withdrawAmount && (
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount('')}
                      className="premium-action premium-action-danger px-2 py-1 rounded-lg text-[11px]"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Destination & Date */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <DateInput
                    id="withdraw-date"
                    label="Withdrawal Date"
                    value={withdrawDate}
                    onChange={setWithdrawDate}
                    required
                  />

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Transfer Destination</label>
                    <AnalyticsSelect
                      value={withdrawDestination}
                      onChange={(value) => setWithdrawDestination(String(value))}
                      accent="rose"
                      ariaLabel="Withdrawal destination"
                      options={[
                        { value: 'Bank Account Transfer', label: 'Bank Account Transfer' },
                        { value: 'Profit Taking Realization', label: 'Profit Taking Realization' },
                        { value: 'Personal Living Expenses', label: 'Personal Living Expenses' },
                        { value: 'Emergency Reserve Transfer', label: 'Emergency Reserve Transfer' },
                        { value: 'Other Withdrawal', label: 'Other Withdrawal' },
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Notes / Destination Details (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Transfer to CIB checking or EGX realized profits payout"
                    value={withdrawNotes}
                    onChange={(e) => setWithdrawNotes(e.target.value)}
                    className="premium-field w-full px-3 py-2 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Impact Calculation Preview */}
            {parseFloat(withdrawAmount) > 0 && (
              <div
                className={`premium-modal-section p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                  parseFloat(withdrawAmount) > cashBalance
                    ? 'border-rose-500/40 text-rose-300'
                    : 'border-slate-700/60 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MinusCircle className="w-4 h-4 text-rose-400" />
                  <span>
                    Withdrawing <strong>{formatEgp(parseFloat(withdrawAmount))} EGP</strong>
                  </span>
                </div>
                <div>
                  {parseFloat(withdrawAmount) > cashBalance ? (
                    <span className="text-rose-400 font-bold">Error: Exceeds available cash!</span>
                  ) : (
                    <span>
                      Remaining Cash Balance:{' '}
                      <strong className="font-mono text-white text-sm font-bold">
                        {formatEgp(cashBalance - parseFloat(withdrawAmount))} EGP
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            )}

            <button
              id="submit-withdraw-btn"
              type="submit"
              disabled={parseFloat(withdrawAmount) > cashBalance || !parseFloat(withdrawAmount)}
              className="premium-action premium-action-danger w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <ArrowUpRight className="w-4 h-4" />
              Confirm Cash Withdrawal
            </button>
          </form>
        )}
        </MotionSwap>
      </div>

      {/* Cash Transaction History Ledger */}
      <div className="premium-panel premium-hierarchy-h3 premium-dense-summary p-4 sm:p-5 rounded-2xl space-y-4" data-hierarchy="h3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              Cash Deposits &amp; Withdrawals Ledger
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click the edit icon on any previous transaction to update its amount, date, or notes to match your real cash.
            </p>
          </div>

          <div className="premium-selector-shell flex w-full items-center gap-1 sm:w-auto sm:gap-1.5">
            <button
              type="button"
              aria-pressed={historyFilter === 'ALL'}
              onClick={() => changeHistoryFilter('ALL')}
              className={`premium-filter-pill min-w-0 flex-1 justify-center px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold sm:flex-none ${historyFilter === 'ALL' ? 'premium-filter-active-neutral' : ''}`}
            >
              All <span className="hidden sm:inline">({transactions.length})</span>
            </button>
            <button
              type="button"
              aria-pressed={historyFilter === 'DEPOSIT'}
              onClick={() => changeHistoryFilter('DEPOSIT')}
              className={`premium-filter-pill min-w-0 flex-1 justify-center px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold sm:flex-none ${historyFilter === 'DEPOSIT' ? 'premium-filter-active-emerald' : ''}`}
            >
              Deposits <span className="hidden sm:inline">({transactions.filter((t) => t.type === 'DEPOSIT').length})</span>
            </button>
            <button
              type="button"
              aria-pressed={historyFilter === 'WITHDRAWAL'}
              onClick={() => changeHistoryFilter('WITHDRAWAL')}
              className={`premium-filter-pill min-w-0 flex-1 justify-center px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold sm:flex-none ${historyFilter === 'WITHDRAWAL' ? 'premium-filter-active-rose' : ''}`}
            >
              Withdrawals <span className="hidden sm:inline">({transactions.filter((t) => t.type === 'WITHDRAWAL').length})</span>
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <MotionSwap motionKey={historyFilter} variant="state" className="premium-cash-history-results">
        <div className="premium-table-shell premium-hierarchy-h5 premium-dense-data overflow-x-auto overscroll-x-contain rounded-xl" data-hierarchy="h5">
          <table className="w-full min-w-[720px] text-left text-xs border-collapse">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800/70 font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Details &amp; Notes</th>
                <th className="py-3 px-4 text-right">Amount (EGP)</th>
                <th className="py-3 px-4 text-right">Balance After</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredTransactions.map((tx) => {
                const isDeposit = tx.type === 'DEPOSIT';
                return (
                  <tr key={tx.id} className="transition">
                    <td className="py-3 px-4 text-slate-300 font-sans whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isDeposit
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isDeposit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans max-w-xs truncate">
                      {tx.notes || (isDeposit ? 'Cash Deposit' : 'Cash Withdrawal')}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-bold whitespace-nowrap ${
                        isDeposit ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isDeposit ? '+' : '-'}{formatEgp(tx.amount)} EGP
                    </td>
                    <td className="py-3 px-4 text-right text-slate-200 whitespace-nowrap">
                      {formatEgp(tx.balanceAfter)} EGP
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleStartEdit(tx)}
                          title="Edit Transaction"
                          className="premium-icon-action premium-icon-edit p-1.5 rounded-lg"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          title="Delete Record"
                          className="premium-icon-action premium-icon-delete p-1.5 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                    No cash transactions found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </MotionSwap>
      </div>

      {/* Edit Transaction Modal */}
      {displayEditingTransaction && createPortal((
        <PremiumModalMotion
          isOpen={!!editingTransaction}
          backdropClassName="premium-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          panelClassName="premium-modal premium-modal-viewport relative w-full max-w-lg my-0 sm:my-6 rounded-2xl p-4 sm:p-6 text-slate-100 space-y-4"
          onBackdropClick={requestCloseCashEdit}
          panelAriaLabel="Edit cash transaction"
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Cash Transaction</h3>
                  <p className="text-xs text-slate-400">Update amount, type, date, or notes</p>
                </div>
              </div>
              <button
                onClick={requestCloseCashEdit}
                className="premium-icon-action p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Type Switcher */}
              <div className="premium-form-section p-3 rounded-xl space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Transaction Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={editType === 'DEPOSIT'}
                     onClick={() => setEditType('DEPOSIT')}
                    className={`premium-choice premium-choice-success py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 ${editType === 'DEPOSIT' ? 'premium-filter-active-emerald' : ''}`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    Deposit (+ Cash)
                  </button>
                  <button
                    type="button"
                    aria-pressed={editType === 'WITHDRAWAL'}
                     onClick={() => setEditType('WITHDRAWAL')}
                    className={`premium-choice premium-choice-danger py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 ${editType === 'WITHDRAWAL' ? 'premium-filter-active-rose' : ''}`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    Withdrawal (- Cash)
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Amount (EGP)</label>
                <div className="relative">
                  <NumberStepperInput
                    step={0.01}
                    min={0.01}
                    value={editAmount}
                    onValueChange={setEditAmount}
                    accent="blue"
                    required
                    className="premium-field premium-field-strong w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono text-sm focus:outline-none"
                    placeholder="e.g. 250000"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    EGP
                  </span>
                </div>
              </div>

              {/* Date Input */}
              <DateInput
                id="edit-cash-date"
                label="Transaction Date"
                value={editDate}
                onChange={setEditDate}
                required
              />

              {/* Notes / Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Description &amp; Notes</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Initial Capital Deposit, InstaPay transfer, etc."
                  className="premium-field w-full px-3.5 py-2.5 rounded-xl text-white placeholder-slate-500 text-xs focus:outline-none"
                />
              </div>

              {/* Live Impact Preview */}
              {parseFloat(editAmount) > 0 && (
                <div className="premium-modal-section p-3 rounded-xl space-y-1 text-xs">
                  <div className="text-slate-400">
                    Original Amount:{' '}
                    <span className="font-mono text-slate-200">
                      {displayEditingTransaction.type === 'DEPOSIT' ? '+' : '-'}
                      {formatEgp(displayEditingTransaction.amount)} EGP
                    </span>
                  </div>
                  <div className="text-slate-300 font-medium">
                    New Balance will become:{' '}
                    <span className="font-mono font-bold text-emerald-400">
                      {formatEgp(
                        cashBalance +
                          (editType === 'DEPOSIT' ? parseFloat(editAmount) : -parseFloat(editAmount)) -
                          (displayEditingTransaction.type === 'DEPOSIT'
                            ? displayEditingTransaction.amount
                            : -displayEditingTransaction.amount)
                      )}{' '}
                      EGP
                    </span>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={requestCloseCashEdit}
                  className="premium-action w-full justify-center px-4 py-2 rounded-xl text-xs font-semibold sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="premium-action premium-action-primary flex w-full items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold sm:w-auto"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </form>
        </PremiumModalMotion>
      ), document.body)}
    </div>
  );
};
