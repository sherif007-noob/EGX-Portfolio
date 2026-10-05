import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const read=(r:string)=>readFileSync(fileURLToPath(new URL(`../../${r}`,import.meta.url)),'utf8');

describe('Stage 4.5.3.2.2.2.2 Overview hero neutral refraction ownership',()=>{
  it('keeps the Overview hero neutral refraction role in materials.css',()=>{
    const m=read('src/styles/materials.css');
    expect(m).toContain('.premium-overview-hero.premium-hero-card {');
    expect(m).toContain('--premium-refraction-shadow: var(--premium-refraction-tier-hero);');
  });

  it('does not duplicate the hero role in the legacy entry',()=>{
    expect(read('src/index.css')).not.toContain('.premium-overview-hero.premium-hero-card {');
  });
});
