import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Determinism guardrail (BLUEPRINT.md §3): the simulation may only use the
    // seeded RNG and the fixed timestep — never wall-clock time or Math.random.
    files: ['src/sim/**/*.ts', 'src/ai/**/*.ts', 'src/core/state.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Sim code must use the seeded RNG (src/core/rng.ts).' },
        { object: 'Date', property: 'now', message: 'Sim code must not read wall-clock time.' },
        { object: 'performance', property: 'now', message: 'Sim code must not read wall-clock time.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'Sim code must not touch the DOM.' },
        { name: 'window', message: 'Sim code must not touch the DOM.' },
      ],
    },
  },
);
