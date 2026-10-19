import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default ts.config(
	{
		ignores: ['build/', '.svelte-kit/', 'node_modules/', 'test-results/', 'playwright-report/']
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// TypeScript checks undefined identifiers itself.
			'no-undef': 'off',
			// The site is served from the domain root with no paths.base, so hrefs need no resolve().
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		// Playwright hooks take their fixtures as a destructured object, even when it is empty.
		files: ['tests/e2e/**/*.ts', 'tests/styleguide/**/*.ts'],
		rules: { 'no-empty-pattern': 'off' }
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		}
	}
);
