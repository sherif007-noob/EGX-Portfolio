import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

const component=readFileSync(new URL('./IpoSubscriptionModal.tsx',import.meta.url),'utf8');
const dateInput=readFileSync(new URL('./DateInput.tsx',import.meta.url),'utf8');

describe('IPO modal workflow separation',()=>{
  it('opens a pending order overview instead of a simultaneous three-form screen',()=>{
    expect(component).toContain("useState<IpoView>('list')");
    expect(component).toContain("view === 'list'");
    expect(component).toContain("view === 'create'");
    expect(component).toContain("view === 'edit'");
    expect(component).toContain("view === 'allocate'");
    expect(component).toContain("view === 'cancel'");
    expect(component).toContain('Edit order details');
    expect(component).toContain('Record allocation');
    expect(component).toContain('Cancel subscription…');
  });
  it('makes each form conditional on its dedicated view',()=>{
    expect(component).toContain("view === 'create' && <form onSubmit={submitSubscription}");
    expect(component).toContain("view === 'edit' && pendingSelection");
    expect(component).toContain("view === 'allocate' && pendingSelection");
    expect(component).toContain("view === 'cancel' && pendingSelection");
  });
  it('uses strict date controls and no escaped-backslash regex that rejects dates',()=>{
    expect(component).toContain('strictInput');
    expect(component).toContain('Save changes');
    expect(component).toContain('correctionTime');
    expect(component).not.toContain(String.raw`/^\\d{4}-\\d{2}-\\d{2}$/`);
    expect(dateInput).toContain('parseUserCalendarDate(raw)');
    expect(dateInput).toContain("onChange(parseUserCalendarDate(raw) ?? '')");
  });
  it('does not reset user input whenever transactions refresh',()=>{
    expect(component).toContain('}, [isOpen]);');
    expect(component).not.toContain('}, [isOpen, pending]);');
  });
});
