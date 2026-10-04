# Stage 4.3 Granular Validation

The original Stage 4.3 implementation landed as one broad refactor before the work was re-sequenced into smaller sub-passes. From this point forward, Stage 4.3 is validated and accepted in granular gates.

## 4.3.1 — Local state + compatibility cache

**Scope**

- local React portfolio state;
- legacy/localStorage compatibility keys;
- startup fallback values;
- visual-regression fixture startup state;
- local ticker metadata rehydration;
- local compatibility cache persistence.

**Explicitly out of scope**

- remote Supabase hydration/subscription;
- canonical ledger mutation execution;
- repository persistence actions;
- public facade cleanup beyond confirming localStorage no longer leaks into it.

**Acceptance**

- only the compatibility module reads/writes the legacy localStorage keys;
- local state modules contain no remote persistence or financial mutation implementation;
- existing storage keys remain unchanged;
- visual-regression fixture behavior remains represented;
- ticker metadata rehydration remains owned locally;
- TypeScript, full tests, and production build are green.

Next after acceptance: **4.3.2 — remote hydration/subscription ownership**.
