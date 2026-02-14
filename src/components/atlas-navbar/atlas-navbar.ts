import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
import { BaseComponentElement, bindTemplateElement, customElement } from '../../libs/base-component';
import template from './atlas-navbar.html?raw';
import style from './atlas-navbar.css?inline';

@customElement('atlas-navbar')
export class AtlasNavbar extends BaseComponentElement {
	@bindTemplateElement('#navbar')
	private navbarEl: HTMLElement | null = null;

	@bindTemplateElement('#brand-link')
	private brandLinkEl: HTMLAnchorElement | null = null;

	@bindTemplateElement('#navbar-links')
	private linksEl: HTMLUListElement | null = null;

	@bindTemplateElement('#navbar-menu-trigger')
	private triggerEl: HTMLButtonElement | null = null;

	@bindTemplateElement('#navbar-dropdown')
	private dropdownEl: HTMLUListElement | null = null;

	private open = false;
	private cleanupAutoUpdate: (() => void) | null = null;
	private globalController: AbortController | null = null;

	constructor() {
		super(template, style);
	}

	protected render(): void {
		if (!this.navbarEl || !this.linksEl || !this.triggerEl || !this.dropdownEl || !this.brandLinkEl) {
			throw new Error('Navbar elements not found in template.');
		}

		if (this.isHomePage()) {
			this.brandLinkEl.setAttribute('aria-current', 'page');
		} else {
			this.brandLinkEl.removeAttribute('aria-current');
		}
		this.applyCurrentPage(this.linksEl);
		this.applyCurrentPage(this.dropdownEl);
	}

	protected onConnected(): void {
		if (!this.triggerEl || !this.dropdownEl) {
			return;
		}

		this.triggerEl.addEventListener('click', this.onTriggerClick);
		this.dropdownEl.addEventListener('click', this.onDropdownClick);
	}

	protected onDisconnected(): void {
		this.triggerEl?.removeEventListener('click', this.onTriggerClick);
		this.dropdownEl?.removeEventListener('click', this.onDropdownClick);
		this.setOpen(false);
	}

	private onTriggerClick = (event: MouseEvent): void => {
		event.stopPropagation();
		this.setOpen(!this.open);
	};

	private onDropdownClick = (event: MouseEvent): void => {
		const target = event.target as HTMLElement | null;
		if (!target?.closest('a')) {
			return;
		}
		this.setOpen(false);
	};

	private onDocumentClick = (event: MouseEvent): void => {
		if (!this.open || !this.dropdownEl || !this.triggerEl) {
			return;
		}
		const path = event.composedPath();
		if (path.includes(this.dropdownEl) || path.includes(this.triggerEl)) {
			return;
		}
		this.setOpen(false);
	};

	private onDocumentKeydown = (event: KeyboardEvent): void => {
		if (event.key === 'Escape') {
			this.setOpen(false);
		}
	};

	private setOpen(nextOpen: boolean): void {
		if (!this.dropdownEl || !this.triggerEl) {
			return;
		}
		if (this.open === nextOpen) {
			return;
		}

		this.open = nextOpen;
		this.dropdownEl.hidden = !this.open;
		this.triggerEl.setAttribute('aria-expanded', String(this.open));

		if (this.open) {
			this.updateDropdownPosition();
			this.startAutoUpdate();
			this.attachGlobalEvents();
			return;
		}

		this.stopAutoUpdate();
		this.detachGlobalEvents();
	}

	private attachGlobalEvents(): void {
		if (this.globalController) {
			return;
		}
		this.globalController = new AbortController();
		const signal = this.globalController.signal;
		document.addEventListener('click', this.onDocumentClick, { capture: true, signal });
		document.addEventListener('keydown', this.onDocumentKeydown, { signal });
	}

	private detachGlobalEvents(): void {
		this.globalController?.abort();
		this.globalController = null;
	}

	private startAutoUpdate(): void {
		if (!this.triggerEl || !this.dropdownEl) {
			return;
		}
		this.cleanupAutoUpdate = autoUpdate(this.triggerEl, this.dropdownEl, () => {
			this.updateDropdownPosition();
		});
	}

	private stopAutoUpdate(): void {
		this.cleanupAutoUpdate?.();
		this.cleanupAutoUpdate = null;
	}

	private async updateDropdownPosition(): Promise<void> {
		if (!this.triggerEl || !this.dropdownEl || !this.open) {
			return;
		}

		const { x, y } = await computePosition(this.triggerEl, this.dropdownEl, {
			strategy: 'fixed',
			placement: 'bottom-end',
			middleware: [offset(8), flip(), shift({ padding: 12 })],
		});

		if (!this.open) {
			return;
		}

		Object.assign(this.dropdownEl.style, {
			left: `${x}px`,
			top: `${y}px`,
		});
	}

	private applyCurrentPage(containerEl: HTMLElement): void {
		const currentPage = this.getCurrentPageName();
		const links = containerEl.querySelectorAll<HTMLAnchorElement>('a');

		for (const link of links) {
			const linkPage = new URL(link.href, window.location.href).pathname.split('/').pop() || 'index.html';
			if (linkPage === currentPage) {
				link.setAttribute('aria-current', 'page');
			} else {
				link.removeAttribute('aria-current');
			}
		}
	}

	private getCurrentPageName(): string {
		const pathname = window.location.pathname;
		const page = pathname.split('/').pop();
		return page && page.length > 0 ? page : 'index.html';
	}

	private isHomePage(): boolean {
		return this.getCurrentPageName() === 'index.html';
	}
}

export function registerAtlasNavbar(): void {
	if (!customElements.get('atlas-navbar')) {
		customElements.define('atlas-navbar', AtlasNavbar);
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'atlas-navbar': AtlasNavbar;
	}
}
