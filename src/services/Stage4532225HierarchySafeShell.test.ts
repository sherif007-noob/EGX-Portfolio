import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const read=(r:string)=>readFileSync(fileURLToPath(new URL(`../../${r}`,import.meta.url)),'utf8');

describe('Stage 4.5.3.2.2.2.5 cascade-safe hierarchy shell',()=>{
  it('keeps hierarchy material frame in materials and neutral important fallback unlayered',()=>{
    const m=read('src/styles/materials.css');
    const b=read('src/styles/cascade-bridge.css');
    expect(m).toContain('border-color: rgb(var(--phase8-material-rgb) / 0.30);');
    expect(m).toContain('0 0 92px rgb(var(--phase8-material-deep-rgb) / 0.08)');
    expect(b).toContain('rgba(10, 18, 36, 0.54) !important;');
  });

  it('keeps semantic and explicit-tone important owners layered above the fallback',()=>{
    expect(read('src/styles/semantics.css')).toContain('rgba(12, 20, 39, 0.58) !important;');
    expect(read('src/styles/materials.css')).toContain('premium-material-tone-cyan');
  });

  it('does not recreate the bridge in legacy CSS',()=>{
    expect(read('src/index.css')).not.toContain('Stage 4.5.3.2.2.2.5 importance/interaction bridge');
  });
});
