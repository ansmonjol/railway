// @ts-check
import js from '@eslint/js'
import pluginQuery from '@tanstack/eslint-plugin-query'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  // shadcn/ui components are vendored as generated; generated files are not ours to lint.
  { ignores: ['dist', 'src/components/ui', 'src/routeTree.gen.ts', 'src/server/graphql-env.d.ts'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TanStack Router redirects by throwing `redirect()`, which is a Response, not an Error.
      '@typescript-eslint/only-throw-error': [
        'error',
        { allow: [{ from: 'package', package: '@tanstack/router-core', name: 'Redirect' }] },
      ],
    },
  },
  reactHooks.configs.flat.recommended,
  pluginQuery.configs['flat/recommended'],
  prettier,
)
