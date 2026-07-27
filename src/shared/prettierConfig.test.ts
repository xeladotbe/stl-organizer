import { resolve } from 'path';
import prettier from 'prettier';
import { describe, expect, it } from 'vitest';

// .prettierrc.yaml lives at the repo root, two levels up from src/shared. Going through
// prettier's own `resolveConfig` (rather than hand-parsing the YAML) exercises exactly what
// `npm run format`/`npm run lint` actually see, instead of just this test's own reading of the file.
const configPath = resolve(__dirname, '../../.prettierrc.yaml');

describe('.prettierrc.yaml', () => {
  it("does not force semi: false (issue #55 - that's backwards from Prettier's own default of keeping semicolons)", async () => {
    const config = await prettier.resolveConfig(configPath);
    // Either `semi` is left unset (falls back to Prettier's `true` default) or is explicitly `true`.
    // What must never happen again is an explicit `false`, which silently strips semicolons repo-wide.
    expect(config?.semi).not.toBe(false);
  });
});
