import React, { useState } from 'react';
import { Position } from '../types';
import { StockLogo } from './StockLogo';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Edit2,
  Trash2,
  Target,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  Layers,
  Plus,
} from 'lucide-react';

interface PositionsTableProps {
  positions: Position[];
  onSellPosition: (position: Position) => void;
  onEditPosition: (position: Position) => void;
  onDeletePosition: (positionId: string) => void;
  onAddNewTrade: () => void;
  onBuyMore: (position: Position) => void;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({
  positions,
  onSellPosition,
  onEditPosition,
  onDeletePosition,
  onAddNewTrade,
  onBuyMore,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [positionToDelete, setPositionToDelete] = useState<Position | null>(null);

  const filteredPositions = positions.filter((pos) => {
    const matchesSearch =
      pos.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pos.companyName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSector = selectedSector === 'ALL' || pos.sector === selectedSector;
    return matchesSearch && matchesSector;
  });

  const sectors = Array.from(new Set(positions.map((p) => p.sector)));

  const formatEgp = (val: number) => {
    return new Intl.NumberFormat('en-EG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar: Search, Filter, and Add Position */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 p-3.5 sm:p-4 rounded-xl border border-slate-800 shadow-sm">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker (e.g. COMI) or company..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 text-slate-100 placeholder-slate-400 text-xs sm:text-sm border border-slate-700 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Sector filter */}
          <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Sectors ({positions.length})</option>
              {sectors.map((sec) => (
                <option key={sec} value={sec} className="bg-slate-800 text-white">
                  {sec}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onAddNewTrade}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-950/40 transition active:scale-95 ml-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Trade</span>
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800 font-medium">
              <th className="py-3 px-4">Ticker &amp; Security</th>
              <th className="py-3 px-3">Sector</th>
              <th className="py-3 px-3 text-right">Shares</th>
              <th className="py-3 px-3 text-right">Avg Buy (EGP)</th>
              <th className="py-3 px-3 text-right">Current Price</th>
              <th className="py-3 px-3 text-right">Market Value</th>
              <th className="py-3 px-3 text-right">Unrealized P&amp;L</th>
              <th className="py-3 px-3 text-center">Targets / SL</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {filteredPositions.map((pos) => {
              const totalCost = pos.shares * pos.avgBuyPrice;
              const currentValue = pos.shares * pos.currentPrice;
              const pnlEgp = currentValue - totalCost;
              const pnlPercent = totalCost > 0 ? (pnlEgp / totalCost) * 100 : 0;
              const isProfit = pnlEgp >= 0;

              return (
                <tr key={pos.id} className="hover:bg-slate-800/40 transition">
                  {/* Ticker & Name */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <StockLogo
                        ticker={pos.ticker}
                        companyName={pos.companyName}
                        sector={pos.sector}
                        size="sm"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white tracking-wide">{pos.ticker}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 max-w-[160px] truncate">
                          {pos.companyName}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Sector */}
                  <td className="py-3 px-3">
                    <span className="text-[11px] text-slate-300 font-medium truncate block max-w-[130px]">
                      {pos.sector}
                    </span>
                  </td>

                  {/* Shares */}
                  <td className="py-3 px-3 text-right font-medium text-slate-200">
                    <div>{pos.shares.toLocaleString()}</div>
                    {pos.totalFees ? (
                      <span className="text-[10px] text-slate-400" title="Total entry brokerage fees paid">
                        Fees: {pos.totalFees.toFixed(1)} EGP
                      </span>
                    ) : null}
                  </td>

                  {/* Avg Buy */}
                  <td className="py-3 px-3 text-right text-slate-300 font-mono">
                    {formatEgp(pos.avgBuyPrice)}
                  </td>

                  {/* Current Price */}
                  <td className="py-3 px-3 text-right font-mono font-bold text-white">
                    {formatEgp(pos.currentPrice)}
                  </td>

                  {/* Market Value */}
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-100">
                    {formatEgp(currentValue)} EGP
                  </td>

                  {/* Unrealized P&L */}
                  <td className="py-3 px-3 text-right">
                    <div
                      className={`font-mono font-bold ${
                        isProfit ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isProfit ? '+' : ''}{formatEgp(pnlEgp)} EGP
                    </div>
                    <div
                      className={`text-[11px] font-semibold flex items-center justify-end gap-0.5 ${
                        isProfit ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {isProfit ? (
                        <ArrowUpRight className="w-3 h-3 inline" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 inline" />
                      )}
                      <span>
                        {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </span>
                    </div>
                  </td>

                  {/* Targets & SL */}
                  <td className="py-3 px-3 text-center">
                    <div className="flex flex-col items-center gap-0.5 text-[11px] font-mono">
                      {pos.targetPrice && (
                        <span className="text-emerald-400 font-medium">
                          T: {pos.targetPrice.toFixed(2)}
                        </span>
                      )}
                      {pos.stopLoss && (
                        <span className="text-rose-400 font-medium">
                          SL: {pos.stopLoss.toFixed(2)}
                        </span>
                      )}
                      {!pos.targetPrice && !pos.stopLoss && (
                        <span className="text-slate-500">—</span>
                      )}
                    </div>
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* DCA / Buy More Button */}
                      <button
                        onClick={() => onBuyMore(pos)}
                        title="Buy more shares of this stock (DCA / Accumulate)"
                        className="px-2.5 py-1 rounded bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 text-[11px] font-semibold flex items-center gap-1 transition"
                      >
                        <Layers className="w-3 h-3 text-blue-400" />
                        Buy More
                      </button>

                      {/* Sell Button */}
                      <button
                        onClick={() => onSellPosition(pos)}
                        title="Sell Shares / Book P&L"
                        className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 text-[11px] font-semibold flex items-center gap-1 transition"
                      >
                        <DollarSign className="w-3 h-3" />
                        Sell
                      </button>

                      <button
                        onClick={() => onEditPosition(pos)}
                        title="Edit Position / Targets"
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setPositionToDelete(pos)}
                        title="Delete Position Record"
                        className="p-1 rounded bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredPositions.length === 0 && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-slate-400">
                  <p className="text-sm font-semibold">No stock positions match your filters.</p>
                  <p className="text-xs text-slate-500 mt-1">Add a trade or clear the sector filter to see holdings.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="lg:hidden space-y-3">
        {filteredPositions.map((pos) => {
          const totalCost = pos.shares * pos.avgBuyPrice;
          const currentValue = pos.shares * pos.currentPrice;
          const pnlEgp = currentValue - totalCost;
          const pnlPercent = totalCost > 0 ? (pnlEgp / totalCost) * 100 : 0;
          const isProfit = pnlEgp >= 0;

          return (
            <div
              key={pos.id}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <StockLogo
                    ticker={pos.ticker}
                    companyName={pos.companyName}
                    sector={pos.sector}
                    size="sm"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{pos.ticker}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate max-w-[200px]">{pos.companyName}</p>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-mono font-bold text-sm ${
                      isProfit ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {isProfit ? '+' : ''}{formatEgp(pnlEgp)} EGP
                  </div>
                  <div
                    className={`text-xs font-semibold ${
                      isProfit ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {isProfit ? '+' : ''}{pnlPercent.toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Stats details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs py-2 px-3 rounded-lg bg-slate-950/60 border border-slate-800">
                <div>
                  <span className="text-slate-500 text-[10px] block">Shares</span>
                  <span className="font-mono text-slate-200">{pos.shares.toLocaleString()}</span>
                  {pos.totalFees ? (
                    <span className="text-[9px] text-slate-400 block">Fee: {pos.totalFees.toFixed(1)}</span>
                  ) : null}
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Avg Buy</span>
                  <span className="font-mono text-slate-200">{formatEgp(pos.avgBuyPrice)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Current</span>
                  <span className="font-mono text-white font-bold">{formatEgp(pos.currentPrice)}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Mkt Value</span>
                  <span className="font-mono text-white font-bold">{formatEgp(currentValue)}</span>
                </div>
              </div>

              {/* Targets / SL */}
              {(pos.targetPrice || pos.stopLoss) && (
                <div className="flex items-center gap-4 text-xs">
                  {pos.targetPrice && (
                    <div className="flex items-center gap-1 text-emerald-400 font-mono">
                      <Target className="w-3.5 h-3.5" />
                      <span>Target: {pos.targetPrice.toFixed(2)} EGP</span>
                    </div>
                  )}
                  {pos.stopLoss && (
                    <div className="flex items-center gap-1 text-rose-400 font-mono">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Stop: {pos.stopLoss.toFixed(2)} EGP</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action row */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                <span className="text-[11px] text-slate-400">{pos.sector}</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <button
                    onClick={() => onBuyMore(pos)}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/40 text-xs font-semibold flex items-center gap-1"
                  >
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    Buy More (DCA)
                  </button>
                  <button
                    onClick={() => onSellPosition(pos)}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold flex items-center gap-1"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    Sell
                  </button>
                  <button
                    onClick={() => onEditPosition(pos)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setPositionToDelete(pos)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredPositions.length === 0 && (
          <div className="p-8 text-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-sm">
            No stock positions match your filters.
          </div>
        )}
      </div>

      {/* Confirm Delete Position Modal */}
      <ConfirmDeleteModal
        isOpen={!!positionToDelete}
        onClose={() => setPositionToDelete(null)}
        onConfirm={() => {
          if (positionToDelete) {
            onDeletePosition(positionToDelete.id);
            setPositionToDelete(null);
          }
        }}
        title="Delete Open Position"
        description="Are you sure you want to delete this open position? This will remove the position holding from your portfolio dashboard."
        itemDetails={
          positionToDelete
            ? {
                ticker: positionToDelete.ticker,
                type: 'OPEN POSITION',
                shares: positionToDelete.shares,
                amount: `${(positionToDelete.shares * positionToDelete.avgBuyPrice).toFixed(2)} EGP Cost Basis`,
                date: positionToDelete.buyDate,
              }
            : undefined
        }
      />
    </div>
  );
};
