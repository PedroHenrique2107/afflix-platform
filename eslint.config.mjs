// Config base do ESLint para o monorepo (SW-27).
// Cada workspace roda `eslint .` a partir da propria pasta; o ESLint sobe ate
// este arquivo e aplica o bloco que casa com o caminho do workspace.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.tsbuildinfo', '**/prisma/migrations/**'],
  },

  // Base comum aos tres workspaces.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Regras com violacao legada comecam em warn (baseline medido na SW-27).
  // O teto de warnings de cada workspace fica no script `lint` (--max-warnings),
  // entao qualquer violacao nova quebra a CI. Ao reduzir o legado, baixe o teto;
  // ao zerar uma regra, volte-a para error aqui.
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn', // 7 na api (script de homologacao, fake-prisma, spec)
      '@typescript-eslint/no-unused-vars': 'warn', // 2 na api, 3 na web
    },
  },

  // apps/api — NestJS em Node (CommonJS).
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // apps/web — React 19 + Vite no browser.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'warn', // 6 legados: fetch disparado dentro de useEffect
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }], // 1 legado
    },
  },
  {
    files: ['apps/web/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },

  // packages/shared — contrato puro, sem runtime especifico.
  {
    files: ['packages/shared/**/*.ts'],
  },
);
