import { defineConfig } from 'vite';

export default defineConfig({
	appType: 'mpa',
	esbuild: {
		target: 'es2022',
	},
	build: {
		emptyOutDir: true,
		rollupOptions: {
			input: {
				main: 'index.html',
				test: 'test.html',
			},
		},
	},
});
