import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const workspace = readFileSync(
  fileURLToPath(new URL('../components/BrokerReconciliationWorkspace.tsx', import.meta.url)),
  'utf8',
);

describe('Stage 6.1 broker snapshot ingestion', () => {
  it('keeps screenshot OCR local and feeds the same broker snapshot contract', () => {
    expect(workspace).toContain('recognizeTradeScreenshot');
    expect(workspace).toContain('parseBrokerSnapshotOcrText');
    expect(workspace).toContain('Scan Screenshot');
    expect(workspace).toContain('accept="image/*"');
    expect(workspace).not.toContain('fetch(');
  });
});
