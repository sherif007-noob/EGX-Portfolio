import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { DateInput } from './DateInput';
import { getTodayISO } from '../utils/dateUtils';

interface CashBalanceViewProps {
  cashBalance: number;
  totalPortfolioValue: number;
  onUpdateCashBalance: (newBalance: number) => void;
  positions?: Position[];
  closedTrades?: ClosedTrade[];
  tradeTransactions?: TradeTransaction[];
}

const STORAGE_KEY_TRANSACTIONS = 'egx_cash_transactions_v2_reconciled';

export const CashBalanceView: React.FC<CashBalanceViewProps> = ({
  cashBalance,
  totalPortfolioValue,
  onUpdateCashBalance,
  positions = [],
  closedTrades = [],
  tradeTransactions = [],
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
  const [editType, setEditType] = useState<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  // Transactions Ledger State
  const [transactions, setTransactions] = useState<CashTransaction[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    // Seed default initial balance transaction
    return [
      {
        id: 'init-cash-seed',
        type: 'DEPOSIT',
        amount: 70029,
        date: '2026-01-01',
        notes: 'Initial Account Cash Allocation',
        balanceAfter: 70029,
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
    } catch {
      // ignore
    }
  }, [transactions]);

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

  // 1. Net Capital Inflows
  const netCapitalDeposited = totalDeposits - totalWithdrawals;

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

  // 4. Exact Audited Liquid Available Cash
  // Formula: Net Capital Inflows - Cost of Active Holdings + Net Realized P&L
  const auditedLiquidCash = Math.max(0, netCapitalDeposited - totalOpenPositionsCost + totalRealizedPnl);

  // 5. Audited Portfolio Equity (NAV)
  // Formula: Liquid Cash + Open Positions Market Value = Net Capital Deposited + Realized P&L + Unrealized P&L
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
  const handleSaveEdit = (e: React.FormEvent) => {
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

    // Calculate balance difference
    const oldContribution = editingTransaction.type === 'DEPOSIT' ? editingTransaction.amount : -editingTransaction.amount;
    const newContribution = editType === 'DEPOSIT' ? newAmountNum : -newAmountNum;
    const delta = newContribution - oldContribution;
    const newBalance = Math.max(0, cashBalance + delta);

    const updatedTx: CashTransaction = {
      ...editingTransaction,
      type: editType,
      amount: newAmountNum,
      date: editDate,
      notes: editNotes.trim(),
      balanceAfter: newBalance,
    };

    const updatedList = transactions.map((t) => (t.id === editingTransaction.id ? updatedTx : t));
    setTransactions(updatedList);
    onUpdateCashBalance(newBalance);
    setEditingTransaction(null);

    setFeedbackMessage({
      text: `Transaction updated successfully! Cash balance adjusted to ${formatEgp(newBalance)} EGP.`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Handle Deposit
  const handleConfirmDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(depositAmount);
    if (!amountNum || amountNum <= 0) {
      setFeedbackMessage({ text: 'Please enter a valid deposit amount greater than 0 EGP.', type: 'error' });
      return;
    }

    const newBalance = cashBalance + amountNum;
    const newTx: CashTransaction = {
      id: `dep-${Date.now()}`,
      type: 'DEPOSIT',
      amount: amountNum,
      date: depositDate || new Date().toISOString().slice(0, 10),
      notes: `${depositMethod}${depositNotes ? ` - ${depositNotes}` : ''}`,
      balanceAfter: newBalance,
    };

    setTransactions([newTx, ...transactions]);
    onUpdateCashBalance(newBalance);
    setDepositAmount('');
    setDepositNotes('');
    setFeedbackMessage({
      text: `Successfully deposited ${formatEgp(amountNum)} EGP. New cash balance: ${formatEgp(newBalance)} EGP.`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Handle Withdrawal
  const handleConfirmWithdrawal = (e: React.FormEvent) => {
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

    const newBalance = cashBalance - amountNum;
    const newTx: CashTransaction = {
      id: `wdr-${Date.now()}`,
      type: 'WITHDRAWAL',
      amount: amountNum,
      date: withdrawDate || new Date().toISOString().slice(0, 10),
      notes: `${withdrawDestination}${withdrawNotes ? ` - ${withdrawNotes}` : ''}`,
      balanceAfter: newBalance,
    };

    setTransactions([newTx, ...transactions]);
    onUpdateCashBalance(newBalance);
    setWithdrawAmount('');
    setWithdrawNotes('');
    setFeedbackMessage({
      text: `Successfully withdrawn ${formatEgp(amountNum)} EGP. Remaining cash balance: ${formatEgp(newBalance)} EGP.`,
      type: 'success',
    });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const handleDeleteTransaction = (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (!tx) return;

    let revertedBalance = cashBalance;
    if (tx.type === 'DEPOSIT') {
      revertedBalance = Math.max(0, cashBalance - tx.amount);
    } else if (tx.type === 'WITHDRAWAL') {
      revertedBalance = cashBalance + tx.amount;
    }

    setTransactions(transactions.filter((t) => t.id !== id));
    onUpdateCashBalance(revertedBalance);
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
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 border border-slate-800">
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
        <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-500/30 shadow-sm relative overflow-hidden">
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
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
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
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
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
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
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
      <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/30 border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
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
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
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
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
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
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
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
            <button
              onClick={() => {
                onUpdateCashBalance(auditedLiquidCash);
                setFeedbackMessage({
                  text: `Cash balance adjusted to audited liquid amount of ${formatEgp(auditedLiquidCash)} EGP.`,
                  type: 'success',
                });
                setTimeout(() => setFeedbackMessage(null), 4000);
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 shadow-md shadow-amber-950/40 transition active:scale-95 flex items-center gap-1.5 self-start sm:self-auto"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply Audited Balance ({formatEgp(auditedLiquidCash)} EGP)</span>
            </button>
          </div>
        )}
      </div>

      {/* Feedback message banner */}
      {feedbackMessage && (
        <div
          className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs sm:text-sm font-semibold animate-in fade-in duration-200 ${
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

      {/* Main Operations Card: Deposit or Withdraw */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white">Record New Cash Transfer</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Deposit new capital or record cash withdrawals.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              id="action-select-deposit"
              onClick={() => setActiveAction('deposit')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeAction === 'deposit'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Deposit Cash
            </button>
            <button
              id="action-select-withdraw"
              onClick={() => setActiveAction('withdraw')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeAction === 'withdraw'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Withdraw Cash
            </button>
          </div>
        </div>

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
                  <input
                    id="deposit-amount-input"
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 50000"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 text-white placeholder-slate-500 text-sm font-mono border border-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
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
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono font-medium border border-slate-700 transition"
                    >
                      +{amt >= 1000 ? `${amt / 1000}k` : amt}
                    </button>
                  ))}
                  {depositAmount && (
                    <button
                      type="button"
                      onClick={() => setDepositAmount('')}
                      className="px-2 py-1 rounded-lg text-rose-400 hover:bg-rose-950/30 text-[11px] transition"
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
                    <select
                      value={depositMethod}
                      onChange={(e) => setDepositMethod(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 text-white text-xs border border-slate-700 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Bank Transfer (InstaPay/Wire)">Bank Transfer (InstaPay/Wire)</option>
                      <option value="Brokerage Account Deposit">Brokerage Account Deposit</option>
                      <option value="Initial Capital Investment">Initial Capital Investment</option>
                      <option value="Cash / ATM Deposit">Cash / ATM Deposit</option>
                      <option value="Cheque Deposit">Cheque Deposit</option>
                      <option value="Other Capital Inflow">Other Capital Inflow</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Notes / Reference (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. CIB Wire ref #98321 or Monthly Savings addition"
                    value={depositNotes}
                    onChange={(e) => setDepositNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 text-white placeholder-slate-500 text-xs border border-slate-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Impact Calculation Preview */}
            {parseFloat(depositAmount) > 0 && (
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs">
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
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-950/40 transition active:scale-95 flex items-center justify-center gap-2"
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
                  <input
                    id="withdraw-amount-input"
                    type="number"
                    step="0.01"
                    min="1"
                    max={cashBalance}
                    placeholder="e.g. 15000"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 text-white placeholder-slate-500 text-sm font-mono border border-slate-700 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
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
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-mono font-medium border border-slate-700 transition disabled:opacity-40"
                    >
                      {preset.label}
                    </button>
                  ))}
                  {withdrawAmount && (
                    <button
                      type="button"
                      onClick={() => setWithdrawAmount('')}
                      className="px-2 py-1 rounded-lg text-rose-400 hover:bg-rose-950/30 text-[11px] transition"
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
                    <select
                      value={withdrawDestination}
                      onChange={(e) => setWithdrawDestination(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 text-white text-xs border border-slate-700 focus:outline-none focus:border-rose-500"
                    >
                      <option value="Bank Account Transfer">Bank Account Transfer</option>
                      <option value="Profit Taking Realization">Profit Taking Realization</option>
                      <option value="Personal Living Expenses">Personal Living Expenses</option>
                      <option value="Emergency Reserve Transfer">Emergency Reserve Transfer</option>
                      <option value="Other Withdrawal">Other Withdrawal</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Notes / Destination Details (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Transfer to CIB checking or EGX realized profits payout"
                    value={withdrawNotes}
                    onChange={(e) => setWithdrawNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 text-white placeholder-slate-500 text-xs border border-slate-700 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            </div>

            {/* Impact Calculation Preview */}
            {parseFloat(withdrawAmount) > 0 && (
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                  parseFloat(withdrawAmount) > cashBalance
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300'
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
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-lg shadow-rose-950/40 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <ArrowUpRight className="w-4 h-4" />
              Confirm Cash Withdrawal
            </button>
          </form>
        )}
      </div>

      {/* Cash Transaction History Ledger */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
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

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setHistoryFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                historyFilter === 'ALL'
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All ({transactions.length})
            </button>
            <button
              onClick={() => setHistoryFilter('DEPOSIT')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                historyFilter === 'DEPOSIT'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Deposits ({transactions.filter((t) => t.type === 'DEPOSIT').length})
            </button>
            <button
              onClick={() => setHistoryFilter('WITHDRAWAL')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                historyFilter === 'WITHDRAWAL'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Withdrawals ({transactions.filter((t) => t.type === 'WITHDRAWAL').length})
            </button>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 font-semibold">
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
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
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
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          title="Delete Record"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 transition"
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
      </div>

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Cash Transaction</h3>
                  <p className="text-xs text-slate-400">Update amount, type, date, or notes</p>
                </div>
              </div>
              <button
                onClick={() => setEditingTransaction(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Edit Form */}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Type Switcher */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Transaction Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditType('DEPOSIT')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition ${
                      editType === 'DEPOSIT'
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    Deposit (+ Cash)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditType('WITHDRAWAL')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition ${
                      editType === 'WITHDRAWAL'
                        ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
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
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 text-white font-mono text-sm border border-slate-700 focus:outline-none focus:border-blue-500"
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 text-white placeholder-slate-500 text-xs border border-slate-700 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Live Impact Preview */}
              {parseFloat(editAmount) > 0 && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
                  <div className="text-slate-400">
                    Original Amount:{' '}
                    <span className="font-mono text-slate-200">
                      {editingTransaction.type === 'DEPOSIT' ? '+' : '-'}
                      {formatEgp(editingTransaction.amount)} EGP
                    </span>
                  </div>
                  <div className="text-slate-300 font-medium">
                    New Balance will become:{' '}
                    <span className="font-mono font-bold text-emerald-400">
                      {formatEgp(
                        Math.max(
                          0,
                          cashBalance +
                            (editType === 'DEPOSIT' ? parseFloat(editAmount) : -parseFloat(editAmount)) -
                            (editingTransaction.type === 'DEPOSIT'
                              ? editingTransaction.amount
                              : -editingTransaction.amount)
                        )
                      )}{' '}
                      EGP
                    </span>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-950/40 transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
