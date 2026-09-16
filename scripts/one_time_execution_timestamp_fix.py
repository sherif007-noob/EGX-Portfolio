from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def replace(path, old, new):
    p = ROOT / path
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}')
    p.write_text(text.replace(old, new))

# Preserve exact execution ordering when available; otherwise retain the legacy
# date/tradeId/BUY-before-SELL fallback for old transactions.
replace(
    'src/services/portfolioReconciliation.ts',
    """  const chronologicalTxs = transactions.map(normalizeTransaction).sort((a, b) => {\n    const timeA = new Date(a.date).getTime();\n    const timeB = new Date(b.date).getTime();\n    if (timeA !== timeB) return timeA - timeB;\n    if (a.tradeId !== undefined && b.tradeId !== undefined && a.tradeId !== b.tradeId) {\n      return Number(a.tradeId) - Number(b.tradeId);\n    }\n    if (a.type === 'BUY' && b.type === 'SELL') return -1;\n    if (a.type === 'SELL' && b.type === 'BUY') return 1;\n    return 0;\n  });""",
    """  const chronologicalTxs = transactions.map(normalizeTransaction).sort((a, b) => {\n    const executedA = a.executedAt ? new Date(a.executedAt).getTime() : NaN;\n    const executedB = b.executedAt ? new Date(b.executedAt).getTime() : NaN;\n    if (Number.isFinite(executedA) && Number.isFinite(executedB) && executedA !== executedB) {\n      return executedA - executedB;\n    }\n    const timeA = new Date(a.date).getTime();\n    const timeB = new Date(b.date).getTime();\n    if (timeA !== timeB) return timeA - timeB;\n    if (a.tradeId !== undefined && b.tradeId !== undefined && a.tradeId !== b.tradeId) {\n      return Number(a.tradeId) - Number(b.tradeId);\n    }\n    if (a.type === 'BUY' && b.type === 'SELL') return -1;\n    if (a.type === 'SELL' && b.type === 'BUY') return 1;\n    return 0;\n  });"""
)
replace(
    'src/services/portfolioReconciliation.ts',
    """  const chronologicalTxs = transactions.map(normalizeTransaction).sort((a, b) => {\n    const timeA = new Date(a.date).getTime();\n    const timeB = new Date(b.date).getTime();\n    if (timeA !== timeB) return timeA - timeB;\n    if (a.tradeId !== undefined && b.tradeId !== undefined && a.tradeId !== b.tradeId) {\n      return Number(a.tradeId) - Number(b.tradeId);\n    }\n    if (a.type === 'BUY' && b.type === 'SELL') return -1;\n    if (a.type === 'SELL' && b.type === 'BUY') return 1;\n    return 0;\n  });""",
    """  const chronologicalTxs = transactions.map(normalizeTransaction).sort((a, b) => {\n    const executedA = a.executedAt ? new Date(a.executedAt).getTime() : NaN;\n    const executedB = b.executedAt ? new Date(b.executedAt).getTime() : NaN;\n    if (Number.isFinite(executedA) && Number.isFinite(executedB) && executedA !== executedB) {\n      return executedA - executedB;\n    }\n    const timeA = new Date(a.date).getTime();\n    const timeB = new Date(b.date).getTime();\n    if (timeA !== timeB) return timeA - timeB;\n    if (a.tradeId !== undefined && b.tradeId !== undefined && a.tradeId !== b.tradeId) {\n      return Number(a.tradeId) - Number(b.tradeId);\n    }\n    if (a.type === 'BUY' && b.type === 'SELL') return -1;\n    if (a.type === 'SELL' && b.type === 'BUY') return 1;\n    return 0;\n  });"""
)
replace(
    'src/utils/portfolioMetrics.ts',
    """    date: tx.date || new Date().toISOString().split('T')[0],\n    fees,""",
    """    date: tx.date || new Date().toISOString().split('T')[0],\n    executedAt: typeof tx.executedAt === 'string' && tx.executedAt.trim() ? tx.executedAt : undefined,\n    fees,"""
)
replace(
    'src/App.tsx',
    """      date: string;\n      fees: number;\n      notes?: string;""",
    """      date: string;\n      executedAt?: string;\n      fees: number;\n      notes?: string;"""
)
replace(
    'src/App.tsx',
    """          date: parsedTx.date,\n          fees,\n          totalAmount: accounting.netProceeds,""",
    """          date: parsedTx.date,\n          executedAt: parsedTx.executedAt,\n          fees,\n          totalAmount: accounting.netProceeds,"""
)
replace(
    'src/App.tsx',
    """            date: parsedTx.date,\n            fees,\n            totalAmount: impact.cashOutflow,""",
    """            date: parsedTx.date,\n            executedAt: parsedTx.executedAt,\n            fees,\n            totalAmount: impact.cashOutflow,"""
)
replace(
    'src/components/TradeScreenshotModal.tsx',
    """          date: t.date,\n          fees: Number(t.fees) || 0,""",
    """          date: t.date,\n          executedAt: t.executedAt,\n          fees: Number(t.fees) || 0,"""
)

# Migration trigger touch: this file is intentionally one-shot and is deleted below.
subprocess.run(['git', 'config', 'user.name', 'github-actions[bot]'], check=True)
subprocess.run(['git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'], check=True)
subprocess.run(['git', 'add', 'src/types.ts', 'src/services/ocrParser.ts', 'src/services/portfolioReconciliation.ts', 'src/utils/portfolioMetrics.ts', 'src/App.tsx', 'src/components/TradeScreenshotModal.tsx', 'scripts/one_time_execution_timestamp_fix.py', '.github/workflows/one-time-execution-timestamp-fix.yml'], check=True)
subprocess.run(['git', 'rm', '-f', 'scripts/one_time_execution_timestamp_fix.py', '.github/workflows/one-time-execution-timestamp-fix.yml'], check=True)
subprocess.run(['git', 'commit', '-m', 'feat: use execution timestamps for transaction ordering'], check=True)
subprocess.run(['git', 'push'], check=True)
