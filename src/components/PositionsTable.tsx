import React, { useEffect, useMemo, useState } from 'react';
import { runVisualTransition } from '../utils/visualTransition';
import { MotionSwap } from './PremiumMotion';
import { Position } from '../types';
import { StockLogo } from './StockLogo';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { AnalyticsSelect } from './AnalyticsSelect';
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

const DESKTOP_LAYOUT_QUERY = '(min-width: 1024px)';
const EGP_FORMATTER = new Intl.NumberFormat('en-EG', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function useDesktopLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_LAYOUT_QUERY).matches : true,
  );

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_LAYOUT_QUERY);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isDesktop;
}

function formatEgp(val: number): string {
  return EGP_FORMATTER.format(val);
}

interface PositionsTableProps {
  positions: Position[];
  onSellPosition: (position: Position) => void;
  onEditPosition: (position: Position) => void;
  onDeletePosition: (positionId: string) => void;
  onAddNewTrade: () => void;
  onBuyMore: (position: Position) => void;
  onOpenPriceAlerts?: () => void;
}

export const PositionsTable: React.FC<PositionsTableProps> = ({
  positions,
  onSellPosition,
  onEditPosition,
  onDeletePosition,
  onAddNewTrade,
  onBuyMore,
  onOpenPriceAlerts,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [positionToDelete, setPositionToDelete] = useState<Position | null>(null);
  const isDesktop = useDesktopLayout();

  const changeSelectedSector = (next: string) => {
    if (next === selectedSector) return;
    runVisualTransition('positions-filter', () => setSelectedSector(next));
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredPositions = useMemo(() => positions.filter((pos) => {
    const matchesSearch =
      pos.ticker.toLowerCase().includes(normalizedSearch) ||
      pos.companyName.toLowerCase().includes(normalizedSearch);
    const matchesSector = selectedSector === 'ALL' || pos.sector === selectedSector;
    return matchesSearch && matchesSector;
  }), [positions, normalizedSearch, selectedSector]);

  const sectors = useMemo(
    () => Array.from(new Set(positions.map((p) => p.sector))),
    [positions],
  );

  return (
    <div className="premium-dense-workflow space-y-4">
      <div className="premium-hierarchy-h3 premium-dense-context flex items-center justify-between gap-3 rounded-xl px-3 py-2.5" data-hierarchy="h3">
        <div>
          <div className="premium-type-section-title">Open Positions</div>
          <div className="premium-type-metadata mt-0.5">
            {filteredPositions.length === positions.length
              ? `${positions.length} active holdings`
              : `${filteredPositions.length} of ${positions.length} holdings visible`}
          </div>
        </div>
        <span className="premium-chip shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold text-cyan-300">
          Live holdings
        </span>
      </div>

      {/* Controls Bar: Search, Filter, and Add Position */}
      <div className="premium-panel premium-hierarchy-h4 premium-dense-toolbar relative z-30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl" data-hierarchy="h4">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker (e.g. COMI) or company..."
              className="premium-field w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900/75 text-slate-100 placeholder-slate-500 text-xs sm:text-sm border border-slate-700/80 focus:outline-none focus:border-cyan-500/60"
            />
          </div>
        </div>

        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:w-auto sm:flex-nowrap">
          {/* Sector filter */}
          <div className="premium-subpanel flex min-w-0 items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <AnalyticsSelect
              value={selectedSector}
              onChange={(value) => changeSelectedSector(String(value))}
              compact
              ariaLabel="Filter positions by sector"
              className="w-full min-w-0 sm:w-auto sm:min-w-[170px]"
              options={[
                { value: 'ALL', label: `All Sectors (${positions.length})` },
                ...sectors.map((sec) => ({ value: sec, label: sec })),
              ]}
            />
          </div>

          <button
            onClick={onAddNewTrade}
            className="premium-action premium-action-primary premium-shimmer-border flex shrink-0 items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold sm:ml-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Trade</span>
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      {isDesktop && (
      <MotionSwap motionKey={selectedSector} variant="state" className="premium-positions-results hidden lg:block">
      <div className="premium-table-shell premium-hierarchy-h5 premium-dense-data rounded-2xl overflow-hidden" data-hierarchy="h5">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="text-slate-400 border-b border-slate-800/70 font-medium">
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
              const effectivePrice = (pos.currentPrice && pos.currentPrice > 0)
                ? pos.currentPrice
                : (pos.avgBuyPrice > 0 ? pos.avgBuyPrice : 0);
              const currentValue = pos.shares * effectivePrice;
              const entryFees = pos.totalFees || 0;
              const totalCostWithFees = totalCost + entryFees;
              const pnlEgp = effectivePrice > 0 ? currentValue - totalCostWithFees : 0;
              const pnlPercent = totalCostWithFees > 0 ? (pnlEgp / totalCostWithFees) * 100 : 0;
              const isProfit = pnlEgp >= 0;

              return (
                <tr
                  key={pos.id}
                  className={`transition ${
                    pnlEgp > 0
                      ? 'premium-row-win'
                      : pnlEgp < 0
                      ? 'premium-row-loss'
                      : 'premium-row-breakeven'
                  }`}
                >
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
                    {(() => {
                      const current = pos.currentPrice || 0;
                      const target = pos.targetPrice || 0;
                      const stop = pos.stopLoss || 0;
                      const isTargetHit = target > 0 && current >= target;
                      const isStopLossHit = stop > 0 && current <= stop;

                      return (
                        <div className="flex flex-col items-center gap-1 text-[11px] font-mono">
                          {target > 0 && (
                            <div className="flex items-center gap-1">
                              {isTargetHit ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 animate-pulse text-[10px]" title={`Target hit! Market ${formatEgp(current)} >= Target ${formatEgp(target)}`}>
                                  🎯 Hit {target.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-emerald-400 font-medium">
                                  T: {target.toFixed(2)}
                                </span>
                              )}
                            </div>
                          )}

                          {stop > 0 && (
                            <div className="flex items-center gap-1">
                              {isStopLossHit ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 animate-pulse text-[10px]" title={`Stop-loss breached! Market ${formatEgp(current)} <= Stop ${formatEgp(stop)}`}>
                                  🛑 SL {stop.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-rose-400 font-medium">
                                  SL: {stop.toFixed(2)}
                                </span>
                              )}
                            </div>
                          )}

                          {!target && !stop && (
                            <button
                              onClick={() => onEditPosition(pos)}
                              className="premium-action premium-action-warning px-2 py-1 rounded-lg text-[10px] font-sans"
                              title="Set target price or stop-loss alert"
                            >
                              + Set Alerts
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* DCA / Buy More Button */}
                      <button
                        onClick={() => onBuyMore(pos)}
                        title="Buy more shares of this stock (DCA / Accumulate)"
                        className="premium-action premium-action-primary px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Layers className="w-3 h-3 text-blue-400" />
                        Buy More
                      </button>

                      {/* Sell Button */}
                      <button
                        onClick={() => onSellPosition(pos)}
                        title="Sell Shares / Book P&L"
                        className="premium-action premium-action-warning px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1"
                      >
                        <DollarSign className="w-3 h-3" />
                        Sell
                      </button>

                      <button
                        onClick={() => onEditPosition(pos)}
                        title="Edit Position / Targets"
                        className="premium-icon-action premium-icon-edit p-1.5 rounded-lg"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setPositionToDelete(pos)}
                        title="Delete Position Record"
                        className="premium-icon-action premium-icon-delete p-1.5 rounded-lg"
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
      </MotionSwap>
      )}

      {/* Mobile Card Layout */}
      {!isDesktop && (
      <MotionSwap motionKey={selectedSector} variant="state" className="premium-positions-results lg:hidden space-y-3">
        {filteredPositions.map((pos) => {
          const totalCost = pos.shares * pos.avgBuyPrice;
          const currentValue = pos.shares * pos.currentPrice;
          const pnlEgp = currentValue - totalCost;
          const pnlPercent = totalCost > 0 ? (pnlEgp / totalCost) * 100 : 0;
          const isProfit = pnlEgp >= 0;

          return (
            <div
              key={pos.id}
              className={`premium-card premium-semantic-record premium-hierarchy-h5 premium-dense-row p-3.5 sm:p-4 rounded-2xl space-y-3 ${
                pnlEgp > 0
                  ? 'premium-glow-win'
                  : pnlEgp < 0
                  ? 'premium-glow-loss'
                  : 'premium-glow-breakeven'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <StockLogo
                    ticker={pos.ticker}
                    companyName={pos.companyName}
                    sector={pos.sector}
                    size="sm"
                  />
                  <div>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="font-bold text-white text-sm">{pos.ticker}</span>
                      <span className="max-w-[120px] truncate text-[10px] text-slate-500">{pos.sector}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate max-w-[200px]">{pos.companyName}</p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
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
              <div className="premium-subpanel grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs py-2 px-3 rounded-xl">
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
              {(pos.targetPrice || pos.stopLoss) ? (
                <div className="flex items-center gap-3 text-xs flex-wrap">
                  {pos.targetPrice ? (
                    <div className={`flex items-center gap-1 font-mono px-2 py-0.5 rounded ${
                      pos.currentPrice >= pos.targetPrice
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 animate-pulse'
                        : 'text-emerald-400 bg-emerald-950/30'
                    }`}>
                      <Target className="w-3.5 h-3.5" />
                      <span>{pos.currentPrice >= pos.targetPrice ? '🎯 HIT:' : 'Target:'} {pos.targetPrice.toFixed(2)} EGP</span>
                    </div>
                  ) : null}
                  {pos.stopLoss ? (
                    <div className={`flex items-center gap-1 font-mono px-2 py-0.5 rounded ${
                      pos.currentPrice <= pos.stopLoss
                        ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40 animate-pulse'
                        : 'text-rose-400 bg-rose-950/30'
                    }`}>
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>{pos.currentPrice <= pos.stopLoss ? '🛑 BREACH:' : 'Stop:'} {pos.stopLoss.toFixed(2)} EGP</span>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500">
                  <button
                    onClick={() => onEditPosition(pos)}
                    className="premium-action premium-action-warning w-full justify-center px-2 py-1 rounded-lg text-[10px] sm:w-auto"
                  >
                    + Set Target &amp; Stop-Loss Alerts
                  </button>
                </div>
              )}

              {/* Action row */}
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)_2.75rem_2.75rem] items-center gap-1.5 pt-2 border-t border-slate-800/80">
                <button
                  onClick={() => onBuyMore(pos)}
                  className="premium-action premium-action-primary min-w-0 w-full justify-center px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Layers className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                  <span className="sm:hidden">DCA</span>
                  <span className="hidden sm:inline">Buy More (DCA)</span>
                </button>
                <button
                  onClick={() => onSellPosition(pos)}
                  className="premium-action premium-action-warning min-w-0 w-full justify-center px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <DollarSign className="w-3.5 h-3.5 shrink-0" />
                  <span>Sell</span>
                </button>
                <button
                  onClick={() => onEditPosition(pos)}
                  className="premium-icon-action premium-icon-edit w-11 h-11 p-0 rounded-lg"
                  aria-label={`Edit ${pos.ticker} position`}
                  title="Edit position"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPositionToDelete(pos)}
                  className="premium-icon-action premium-icon-delete w-11 h-11 p-0 rounded-lg"
                  aria-label={`Delete ${pos.ticker} position`}
                  title="Delete position"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredPositions.length === 0 && (
          <div className="premium-inset-glass p-8 text-center rounded-xl text-slate-400 text-sm">
            No stock positions match your filters.
          </div>
        )}
      </MotionSwap>
      )}

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
