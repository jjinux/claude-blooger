import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', 'playwright-report/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      // Both, because this repo has Node code and browser code side by side and the
      // split is already expressed per-workspace in tsconfig.
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // TypeScript already reports unknown identifiers, and does it with real type
      // information. Leaving this on produces duplicate, worse-worded errors.
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },

  {
    // Test files legitimately reach for `any` when asserting on parsed XML or JSON.
    files: ['**/*.spec.ts', '**/*.spec.tsx', 'apps/api/test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  // Last, so it can switch off every stylistic rule Prettier owns.
  prettier,
)
