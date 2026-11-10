// ESLint for the AADML frontend (ADM-1201). Correctness rules only: ESLint's recommended set and the Vue plugin's
// "essential" set (bugs and likely mistakes, no formatting or style). Run: `npm run lint`.
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  {
    ignores: [
      'dist/**', 'node_modules/**', 'old_design/**', 'AADML_Agentic_UIUX/**', 'public/**',
      'training-data/dist*/**', 'coverage/**', '**/*.min.js',
    ],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.{js,mjs,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, ...globals.es2024 },
    },
  },
  {
    files: ['**/*.test.{js,mjs}', 'tests/**', 'training-data/tests/**'],
    languageOptions: { globals: { ...globals.vitest } },
  },
  {
    rules: {
      // Cannot see a <script setup> variable used only in the template: every such variable reads as "useless".
      'no-useless-assignment': 'off',
      // Shown, not failing: dead code to clean up as files are touched. `catch (e)` and `_`-prefixed names are fine.
      'no-unused-vars': ['warn', { caughtErrors: 'none', args: 'after-used', argsIgnorePattern: '^_',
                                   varsIgnorePattern: '^_' }],
      // Existing components mutate props by design (the parent passes a reactive object to edit in place).
      'vue/no-mutating-props': 'warn',
      // Route views named "Login", "Billing"…: a naming convention, not a bug.
      'vue/multi-word-component-names': 'off',
      // `throw new Error(...)` inside a catch without { cause }: worth adding, not a defect on its own.
      'preserve-caught-error': 'warn',
      // `catch {}` that deliberately ignores a failure (storage blocked, a closed socket) is allowed.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Grouped `case` labels with a comment between them are one case, not a fallthrough.
      'no-fallthrough': ['error', { allowEmptyCase: true }],
    },
  },
]
