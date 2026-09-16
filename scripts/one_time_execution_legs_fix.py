from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def replace(path, old, new):
    p = ROOT / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}')
    p.write_text(text.replace(old, new, 1))

# Reconciliation: retain exact ledger-leg provenance without changing any
# accounting formulas or cash/P&L calculations.
replace(
    'src/services/portfolioReconciliation.ts',
    """  notes?: string;\n}\n\ninterface ActiveCycle {""",
    """  notes?: string;\n}\n\ninterface ActiveCycle {"""
)
replace(
    'src/services/portfolioReconciliation.ts',
    """  notes: string[];\n  cycleTags: string[];\n}""",
    """  notes: string[];\n  cycleTags: string[];\n  buyTransactionIds: string[];\n  sellTransactionIds: string[];\n}"""
)
replace(
    'src/services/portfolioReconciliation.ts',
    """      cycleTag: cycle.cycleTags.filter(Boolean)[0] || undefined,\n    });""",
    """      cycleTag: cycle.cycleTags.filter(Boolean)[0] || undefined,\n      buyTransactionIds: [...cycle.buyTransactionIds],\n      sellTransactionIds: [...cycle.sellTransactionIds],\n    });"""
)
replace(
    'src/services/portfolioReconciliation.ts',
    """    const cycleBuyDate = lots\n      .map(lot => lot.date)\n      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] || tx.date;\n\n    const ratioRemaining = 1 - tx.shares / totalOpenShares;""",
    """    // Capture the exact open lots touched by this sell before their shares\n    // are reduced. This is provenance only; accounting remains unchanged.\n    const contributingBuyIds = lots.map(lot => lot.id);\n    const cycleBuyDate = lots\n      .map(lot => lot.date)\n      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0] || tx.date;\n\n    const ratioRemaining = 1 - tx.shares / totalOpenShares;"""
)
replace(
    'src/services/portfolioReconciliation.ts',
    """        notes: [],\n        cycleTags: [],\n      };""",
    """        notes: [],\n        cycleTags: [],\n        buyTransactionIds: [...contributingBuyIds],\n        sellTransactionIds: [],\n      };"""
)
replace(
    'src/services/portfolioReconciliation.ts',
    """    cycle.realizedPnlEgp += accounting.realizedPnlEgp;\n    if (tx.notes) cycle.notes.push(tx.notes);""",
    """    cycle.realizedPnlEgp += accounting.realizedPnlEgp;\n    cycle.sellTransactionIds.push(tx.id);\n    for (const buyId of contributingBuyIds) {\n      if (!cycle.buyTransactionIds.includes(buyId)) cycle.buyTransactionIds.push(buyId);\n    }\n    if (tx.notes) cycle.notes.push(tx.notes);"""
)

# UI: exact cycle leg IDs take precedence over the old date-window heuristic.
replace(
    'src/components/ClosedCyclesView.tsx',
    """  notes?: string;\n  phaseNumber: number;\n}""",
    """  notes?: string;\n  executedAt?: string;\n  phaseNumber: number;\n}"""
)
replace(
    'src/components/ClosedCyclesView.tsx',
    """      // Find matching buy transactions\n      const buyTime = new Date(ct.buyDate).getTime();\n      const sellTime = new Date(ct.sellDate).getTime();\n\n      const matchingBuys = transactions.filter((t) => {\n        if (t.type !== 'BUY') return false;\n        if (t.ticker.toUpperCase() !== tickerUpper) return false;\n        if (ct.cycleTag && t.cycleTag && ct.cycleTag === t.cycleTag) return true;\n        if (ct.tradeCycle && t.tradeCycle && ct.tradeCycle === t.tradeCycle) return true;\n        // Bounded date fallback: lot purchased between cycle buyDate and sellDate\n        const tTime = new Date(t.date).getTime();\n        return tTime >= buyTime - 86400000 && tTime <= sellTime;\n      });\n\n      // Find matching sell transactions\n      const matchingSells = transactions.filter((t) => {\n        if (t.type !== 'SELL') return false;\n        if (t.ticker.toUpperCase() !== tickerUpper) return false;\n        if (ct.cycleTag && t.cycleTag && ct.cycleTag === t.cycleTag) return true;\n        if (ct.tradeCycle && t.tradeCycle && ct.tradeCycle === t.tradeCycle) return true;\n        // Bounded date fallback: within 1 day of sell date\n        return Math.abs(new Date(t.date).getTime() - sellTime) <= 86400000;\n      });""",
    """      const buyTime = new Date(ct.buyDate).getTime();\n      const sellTime = new Date(ct.sellDate).getTime();\n      const buyIdSet = new Set(ct.buyTransactionIds || []);\n      const sellIdSet = new Set(ct.sellTransactionIds || []);\n      const hasExactLegs = buyIdSet.size > 0 || sellIdSet.size > 0;\n\n      const executionTime = (t: TradeTransaction) => {\n        const value = t.executedAt ? new Date(t.executedAt).getTime() : NaN;\n        return Number.isFinite(value) ? value : new Date(t.date).getTime();\n      };\n\n      // New reconciled cycles carry exact transaction IDs. Legacy cycles fall\n      // back to cycle tags/tradeCycle and only then to bounded dates.\n      const matchingBuys = transactions.filter((t) => {\n        if (t.type !== 'BUY' || t.ticker.toUpperCase() !== tickerUpper) return false;\n        if (buyIdSet.has(t.id)) return true;\n        if (hasExactLegs) return false;\n        if (ct.cycleTag && t.cycleTag && ct.cycleTag === t.cycleTag) return true;\n        if (ct.tradeCycle && t.tradeCycle && ct.tradeCycle === t.tradeCycle) return true;\n        const tTime = executionTime(t);\n        return tTime >= buyTime - 86400000 && tTime <= sellTime;\n      });\n\n      const matchingSells = transactions.filter((t) => {\n        if (t.type !== 'SELL' || t.ticker.toUpperCase() !== tickerUpper) return false;\n        if (sellIdSet.has(t.id)) return true;\n        if (hasExactLegs) return false;\n        if (ct.cycleTag && t.cycleTag && ct.cycleTag === t.cycleTag) return true;\n        if (ct.tradeCycle && t.tradeCycle && ct.tradeCycle === t.tradeCycle) return true;\n        const tTime = executionTime(t);\n        return Math.abs(tTime - sellTime) <= 86400000;\n      });\n\n      matchingBuys.sort((a, b) => executionTime(a) - executionTime(b));\n      matchingSells.sort((a, b) => executionTime(a) - executionTime(b));"""
)
replace(
    'src/components/ClosedCyclesView.tsx',
    """        date: t.date,\n        fees: t.fees || 0,\n        notes: t.notes,\n        phaseNumber: idx + 1,""",
    """        date: t.date,\n        executedAt: t.executedAt,\n        fees: t.fees || 0,\n        notes: t.notes,\n        phaseNumber: idx + 1,"""
)
replace(
    'src/components/ClosedCyclesView.tsx',
    """        date: t.date,\n        fees: t.fees || 0,\n        notes: t.notes,\n        phaseNumber: idx + 1,\n      }));""",
    """        date: t.date,\n        executedAt: t.executedAt,\n        fees: t.fees || 0,\n        notes: t.notes,\n        phaseNumber: idx + 1,\n      }));"""
)

# Make the expanded leg view show execution time when the broker supplied it.
replace(
    'src/components/ClosedCyclesView.tsx',
    """                              <div className=\"font-mono text-slate-300\">{formatDateDDMMYYYY(phase.date)}</div>\n                              {phase.fees > 0 && <div>Fee: {formatEgp(phase.fees)} EGP</div>}""",
    """                              <div className=\"font-mono text-slate-300\">{formatDateDDMMYYYY(phase.date)}</div>\n                              {phase.executedAt && <div className=\"text-purple-300\">{new Date(phase.executedAt).toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>}\n                              {phase.fees > 0 && <div>Fee: {formatEgp(phase.fees)} EGP</div>}"""
)
replace(
    'src/components/ClosedCyclesView.tsx',
    """                              <div className=\"font-mono text-slate-300\">{formatDateDDMMYYYY(phase.date)}</div>\n                              {phase.fees > 0 && <div>Fee: {formatEgp(phase.fees)} EGP</div>}\n                            </div>\n                          </div>\n                        ))}""",
    """                              <div className=\"font-mono text-slate-300\">{formatDateDDMMYYYY(phase.date)}</div>\n                              {phase.executedAt && <div className=\"text-purple-300\">{new Date(phase.executedAt).toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>}\n                              {phase.fees > 0 && <div>Fee: {formatEgp(phase.fees)} EGP</div>}\n                            </div>\n                          </div>\n                        ))}"""
)

print('Execution leg provenance fix applied.')
