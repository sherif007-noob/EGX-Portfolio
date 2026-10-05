import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const read=(r:string)=>readFileSync(fileURLToPath(new URL(`../../${r}`,import.meta.url)),'utf8');

describe('Stage 4.5.4 semantics + hierarchy ownership',()=>{
  it('keeps financial semantic presentation in semantics.css',()=>{
    const s=read('src/styles/semantics.css');
    expect(s).toContain('.premium-semantic-hero');
    expect(s).toContain('.premium-semantic-card');
    expect(s).toContain('.premium-card.premium-hierarchy-h1.premium-glow-win');
    expect(s).toContain('Additive semantic edge — aura/glass remain untouched');
  });

  it('keeps non-responsive hierarchy structure in hierarchy.css',()=>{
    const h=read('src/styles/hierarchy.css');
    expect(h).toContain('Typography hierarchy only.');
    expect(h).toContain('Pass 8.4.4 — canonical spacing rhythm');
    expect(h).not.toContain('premium-glow-win');
    expect(h).not.toContain('premium-material-tone-cyan');
  });

  it('preserves tone -> semantic -> neutral fallback important precedence structurally',()=>{
    const m=read('src/styles/materials.css');
    const s=read('src/styles/semantics.css');
    const b=read('src/styles/cascade-bridge.css');
    expect(m).toContain('premium-material-tone-cyan');
    expect(s).toContain('rgba(12, 20, 39, 0.58) !important;');
    expect(b).toContain('rgba(10, 18, 36, 0.54) !important;');
  });

  it('hands later interaction and responsive work to their final owners',()=>{
    expect(read('src/styles/motion.css')).toContain('Phase 4 v3 — canonical motion tokens and CSS micro-interactions');
    expect(read('src/styles/responsive.css')).toContain('Phase 10.9 — cross-app responsive containment');
    expect(read('src/index.css').trim()).toBe('@import "tailwindcss";\n@import "./styles/index.css";');
  });
});
