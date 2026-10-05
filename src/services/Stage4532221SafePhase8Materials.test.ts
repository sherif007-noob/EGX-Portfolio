import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const read=(r:string)=>readFileSync(fileURLToPath(new URL(`../../${r}`,import.meta.url)),'utf8');

describe('Stage 4.5.3.2.2.2.1 safe Phase 8 material ownership',()=>{
  it('keeps safe tone and structural material families in materials.css',()=>{
    const m=read('src/styles/materials.css');
    for(const s of [
      '.premium-material-tone-cyan',
      '.premium-material-tone-blue',
      '.premium-material-tone-purple',
      '.premium-material-tone-emerald',
      '.premium-material-tone-rose',
      '.premium-material-tone-amber',
      '.premium-overview-market-strip.premium-material-tone-cyan',
      '.premium-report-summary-band'
    ]) expect(m).toContain(s);
  });

  it('keeps financial semantic hierarchy presentation separate',()=>{
    const m=read('src/styles/materials.css');
    const s=read('src/styles/semantics.css');
    expect(m).not.toContain('.premium-glow-win');
    expect(s).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
  });

  it('keeps the legacy entry declaration-free after final closure',()=>{
    expect(read('src/index.css').trim()).toBe('@import "tailwindcss";\n@import "./styles/index.css";');
  });
});
