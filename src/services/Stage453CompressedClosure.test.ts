import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const read=(r:string)=>readFileSync(fileURLToPath(new URL(`../../${r}`,import.meta.url)),'utf8');

describe('Stage 4.5.3 compressed materials closure',()=>{
  it('keeps safe mobile hierarchy material overrides in materials.css',()=>{
    const m=read('src/styles/materials.css');
    expect(m).toContain('blur(22px) saturate(150%) brightness(1.025)');
    expect(m).toContain('blur(20px) saturate(145%)');
  });

  it('keeps the cross-owner important fallback in the explicit cascade bridge',()=>{
    const b=read('src/styles/cascade-bridge.css');
    const s=read('src/styles/semantics.css');
    expect(b).toContain('rgba(10, 18, 36, 0.54) !important;');
    expect(s).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
  });

  it('keeps the compressed roadmap at 4.5.3 through 4.5.6',()=>{
    const p=read('docs/STAGE4_5_CSS_OWNERSHIP.md');
    expect(p).toContain('4.5.3 — materials + cascade-safety closure');
    expect(p).toContain('4.5.4 — semantics + hierarchy');
    expect(p).toContain('4.5.5 — interaction surfaces');
    expect(p).toContain('4.5.6 — responsive + feature/legacy closure');
  });
});
