export function renderMarkdown(markdown: string): string {
	const normalized = markdown.replace(/\r\n/g, '\n').trim();
	if (!normalized) {
		return '';
	}
	const paragraphs = normalized.split(/\n{2,}/);
	return paragraphs.map((paragraph) => `<p>${renderMarkdownInline(paragraph)}</p>`).join('');
}

function renderMarkdownInline(text: string): string {
	const escaped = escapeHtml(text);
	const withLinks = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
		const safeUrl = sanitizeUrl(url);
		if (!safeUrl) {
			return label;
		}
		const isExternal = /^[a-z][a-z0-9+.-]*:/.test(safeUrl);
		const attrs = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
		return `<a href="${safeUrl}"${attrs}>${label}</a>`;
	});
	const withBold = withLinks.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	const withItalic = withBold.replace(/\*([^*]+)\*/g, '<em>$1</em>');
	return withItalic.replace(/\n/g, '<br/>');
}

function escapeHtml(text: string) {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function sanitizeUrl(url: string) {
	const trimmed = String(url).trim();
	if (!trimmed) {
		return '';
	}
	if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
		return trimmed;
	}
	try {
		const parsed = new URL(trimmed, 'https://atlasdash.invalid');
		if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
			return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : trimmed;
		}
	} catch {
		return '';
	}
	return '';
}
