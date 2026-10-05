import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read=(r:string)=>readFileSync(fileURLToPath(new URL(`../../${r}`,import.meta.url)),'utf8');
const stripComments=(v:string)=>v.replace(/\/\*[\s\S]*?\*\//g,'').trim();

describe('Stage 4.5.6 final responsive + feature/legacy closure',()=>{
  it('leaves src/index.css as the stable two-import entry only',()=>{
    expect(read('src/index.css').trim()).toBe('@import "tailwindcss";\n@import "./styles/index.css";');
  });

  it('populates the responsive owner without material or semantic presentation',()=>{
    const r=stripComments(read('src/styles/responsive.css'));
    expect(r).toContain('@media (max-width: 767px), (pointer: coarse)');
    expect(r).toContain('Phase 10.9 — cross-app responsive containment');
    expect(r).toContain('.premium-fixed-bottom-safe');
    expect(r).not.toContain('premium-glow-win');
    expect(r).not.toContain('premium-material-tone-');
    expect(r).not.toContain('backdrop-filter:');
  });

  it('routes final feature residue through explicit feature owners',()=>{
    const entry=read('src/styles/features/index.css');
    for(const file of ['./app-shell.css','./charts.css','./reports.css','./header.css']) {
      expect(entry).toContain(`@import "${file}";`);
    }
    expect(read('src/styles/features/charts.css')).toContain('Phase 7 chart visual system');
    expect(read('src/styles/features/reports.css')).toContain('.premium-report-hero-card');
    expect(read('src/styles/features/header.css')).toContain('Phase 9.7 — desktop / 2XL header refinement');
  });

  it('keeps shared final residue in existing canonical owners',()=>{
    const m=read('src/styles/materials.css');
    const c=read('src/styles/controls.css');
    const o=read('src/styles/overlays.css');
    const motion=read('src/styles/motion.css');
    expect(m).toContain('.premium-radial {');
    expect(m).toContain('.premium-chip {');
    expect(c).toContain('.premium-number-stepper-touch-controls {');
    expect(o).toContain('.premium-select-dropdown {');
    expect(motion).toContain('@keyframes premium-cta-aurora-flow');
    expect(m).not.toContain('@keyframes premium-cta-aurora-flow');
  });

  it('keeps the named layer order unchanged at Stage 4 exit',()=>{
    const e=read('src/styles/index.css');
    const order=['egx-tokens','egx-materials','egx-semantics','egx-hierarchy','egx-controls','egx-overlays','egx-motion','egx-responsive','egx-features'];
    let prev=-1;
    for(const layer of order){
      const pos=e.indexOf(`layer(${layer})`);
      expect(pos).toBeGreaterThan(prev);
      prev=pos;
    }
  });
});
