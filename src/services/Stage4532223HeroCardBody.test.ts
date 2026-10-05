import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const read=(r:string)=>readFileSync(fileURLToPath(new URL(`../../${r}`,import.meta.url)),'utf8');

describe('Stage 4.5.3.2.2.2.3 neutral hero-card material body',()=>{
  it('keeps the hero-card material body in materials.css',()=>{
    const m=read('src/styles/materials.css');
    expect(m).toContain('.premium-hero-card {');
    expect(m).toContain('rgba(15, 23, 42, 0.66)');
  });

  it('keeps material hover light separate from motion choreography',()=>{
    const m=read('src/styles/materials.css');
    const motion=read('src/styles/motion.css');
    expect(m).toContain('.premium-card:hover::before {');
    expect(motion).toContain('.premium-card:hover {');
  });

  it('keeps the legacy entry drained',()=>{
    expect(read('src/index.css').trim()).toBe('@import "tailwindcss";\n@import "./styles/index.css";');
  });
});
