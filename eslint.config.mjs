import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
  { ignores: ['dist/**', 'test-vault/**', 'package-lock.json'] },
  ...obsidianmd.configs.recommended,
  {
    // Synthetic tests deliberately exercise forbidden relative config paths.
    files: ['tests/**'],
    rules: { 'obsidianmd/hardcoded-config-path': 'off' },
  },
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.mjs', 'scripts/*.mjs'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'obsidianmd/ui/sentence-case': ['warn', { brands: ['Hardcover', 'Goodreads', 'Obsidian', 'Book Collection'], acronyms: ['API', 'CSV'] }],
    },
  },
  {
    files: ['scripts/**', 'tests/**', 'eslint.config.mjs'],
    rules: {
      'obsidianmd/no-nodejs-modules': 'off',
    },
  },
]);
