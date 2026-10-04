import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.3.4 repository and persistence action ownership', () => {
  it('keeps Supabase persistence behind the portfolio repository adapter', () => {
    const repository = read('src/features/portfolio/persistence/portfolioRepository.ts');

    expect(repository).toContain("../../../services/supabaseStorage");
    expect(repository).not.toContain("../../../services/firestoreStorage");
    expect(repository).toContain('load: loadPortfolioFromFirestore');
    expect(repository).toContain('saveSnapshot: forceFullSyncToFirestore');
    expect(repository).toContain('updatePositions: updateFirestorePositions');
    expect(repository).toContain('updateTickers: updateFirestoreTickers');
    expect(repository).toContain('getSupabaseBrowserClient');
  });

  it('persists position metadata before applying it locally', () => {
    const actions = read('src/features/portfolio/persistence/usePortfolioRepositoryActions.ts');

    const persistIndex = actions.indexOf('await portfolioRepository.updatePositions(candidate)');
    const localApplyIndex = actions.indexOf('state.setPositions((current) => current.map');

    expect(persistIndex).toBeGreaterThan(-1);
    expect(localApplyIndex).toBeGreaterThan(persistIndex);
    expect(actions).toContain('if (!saved) return false');
    expect(actions).toContain('Position metadata persistence failed:');
  });

  it('applies only editable metadata after persistence so fresher quote/accounting fields survive', () => {
    const actions = read('src/features/portfolio/persistence/usePortfolioRepositoryActions.ts');

    expect(actions).toContain('...position');
    expect(actions).toContain('targetPrice: updatedPosition.targetPrice');
    expect(actions).toContain('stopLoss: updatedPosition.stopLoss');
    expect(actions).toContain('notes: updatedPosition.notes');

    const persistIndex = actions.indexOf('await portfolioRepository.updatePositions(candidate)');
    const localApplyIndex = actions.indexOf('state.setPositions((current) => current.map');
    const localApplyBlock = actions.slice(localApplyIndex);

    expect(localApplyIndex).toBeGreaterThan(persistIndex);
    expect(localApplyBlock).not.toContain('position.id === updatedPosition.id ? updatedPosition : position');
  });

  it('keeps the Edit Position workflow open and submit-disabled until persistence succeeds', () => {
    const workflows = read('src/features/app-shell/usePortfolioWorkflows.ts');
    const modal = read('src/components/EditPositionModal.tsx');

    expect(workflows).toContain('editPosition: (position: Position) => Promise<boolean>');
    expect(workflows).toContain('const saved = await portfolio.editPosition({');
    expect(workflows).toContain('were not saved. Nothing was changed.');
    expect(workflows).toContain('return true');

    expect(modal).toContain('}) => Promise<boolean>;');
    expect(modal).toContain('const [isSubmitting, setIsSubmitting] = useState(false)');
    expect(modal).toContain('const saved = await onSave({');
    expect(modal).toContain('if (saved) requestClose()');
    expect(modal).toContain('disabled={isSubmitting}');
    expect(modal).toContain("isSubmitting ? 'Saving…' : 'Save Targets'");
  });

  it('does not let repository actions bypass the repository adapter', () => {
    const actions = read('src/features/portfolio/persistence/usePortfolioRepositoryActions.ts');

    for (const forbidden of [
      'loadPortfolioFromFirestore',
      'forceFullSyncToFirestore',
      'updateFirestorePositions',
      'updateFirestoreTickers',
      'getSupabaseBrowserClient',
      'savePortfolioToSupabase',
    ]) {
      expect(actions).not.toContain(forbidden);
    }

    expect(actions).toContain('portfolioRepository.getSession()');
    expect(actions).toContain('portfolioRepository.load()');
    expect(actions).toContain('portfolioRepository.saveSnapshot({');
  });

  it('prevents force sync from replacing authoritative remote ticker metadata with stale local duplicates', () => {
    const actions = read('src/features/portfolio/persistence/usePortfolioRepositoryActions.ts');

    expect(actions).toContain('mergeTickerDirectoryWithBaseline([');
    expect(actions).toContain('...state.tickers');
    expect(actions).toContain('...remote.tickers');
    expect(actions.indexOf('...state.tickers'))
      .toBeLessThan(actions.indexOf('...remote.tickers'));
    expect(actions).toContain('state.setTickers(mergedTickers)');
  });
});
