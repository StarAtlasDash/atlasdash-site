import { babel } from '@rollup/plugin-babel';
import { defineConfig, withFilter } from 'vite';

export default defineConfig({
	// plugins: [
	// 	babel({
	// 		babelHelpers: 'bundled',
	// 		extensions: ['.ts', '.js'],
	// 		include: ['src/**/*'],
	// 		plugins: [
	// 			['@babel/plugin-proposal-decorators', { version: '2023-05' }],
	// 			// ['@babel/plugin-proposal-class-properties', { loose: false }],
	// 		],
	// 	}),
	// ],
	plugins: [
		withFilter(
			babel({
				configFile: false,
				extensions: ['.ts', '.js'],

				plugins: [['@babel/plugin-proposal-decorators', { version: '2023-11' }]],
			}),
			// Only run this transform if the file contains a decorator.
			{ transform: { code: '@' } },
		),
	],
	appType: 'mpa',
	build: {
		target: 'es2022',
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: 'index.html',
				test: 'test.html',
			},
		},
	},
});
