import {
	AttributeType,
	BaseComponentElement,
	bindAttribute,
	bindTemplateElement,
	customElement,
} from '../../libs/base-component';
import {
	autoUpdate,
	computePosition,
	flip,
	offset,
	shift,
	arrow,
} from '@floating-ui/dom';
import template from './atlas-popup.html?raw';
import style from './atlas-popup.css?inline';

@customElement('atlas-popup')
export class AtlasPopup extends BaseComponentElement {
	@bindAttribute('title')
	accessor title: string = '';

	@bindAttribute('offset', { type: AttributeType.Number })
	accessor offsetValue: number = 8;

	@bindTemplateElement('.popup-trigger')
	private triggerEl: HTMLButtonElement | null = null;

	@bindTemplateElement('.popup-floating')
	private floatingEl: HTMLDivElement | null = null;

	@bindTemplateElement('.popup-arrow')
	private arrowEl: HTMLDivElement | null = null;

	@bindTemplateElement('.popup-title')
	private titleEl: HTMLElement | null = null;

	@bindTemplateElement('.popup-body')
	private bodyEl: HTMLDivElement | null = null;

	@bindTemplateElement('.popup-close')
	private closeEl: HTMLButtonElement | null = null;

	private open = false;
	private hasContent = false;
	private contentHtml: string | null = null;
	private cleanupAutoUpdate: (() => void) | null = null;
	private globalController: AbortController | null = null;

	constructor() {
		super(template, style);
	}

	setContentHtml(html: string | null) {
		this.contentHtml = html;
		this.render();
	}

	protected render(): void {
		if (this.titleEl) {
			this.titleEl.textContent = this.title || 'Details';
		}

		const content = (this.contentHtml ?? '').trim();
		this.hasContent = content.length > 0;
		if (this.bodyEl) {
			this.bodyEl.innerHTML = content;
		}
		if (this.triggerEl) {
			this.triggerEl.hidden = !this.hasContent;
		}
		if (!this.hasContent) {
			this.setOpen(false);
		}
	}

	protected onConnected(): void {
		this.bindEvents();
	}

	protected onDisconnected(): void {
		this.unbindEvents();
	}

	private bindEvents() {
		this.triggerEl?.addEventListener('click', this.onToggle);
		this.closeEl?.addEventListener('click', this.onClose);
	}

	private unbindEvents() {
		this.triggerEl?.removeEventListener('click', this.onToggle);
		this.closeEl?.removeEventListener('click', this.onClose);
		this.detachGlobalEvents();
		this.stopAutoUpdate();
	}

	private onToggle = () => {
		this.setOpen(!this.open);
	};

	private onClose = () => {
		this.setOpen(false);
	};

	private onDocumentKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			this.setOpen(false);
		}
	};

	private onDocumentClick = (event: MouseEvent) => {
		if (!this.open || !this.floatingEl || !this.triggerEl) {
			return;
		}
		const path = event.composedPath();
		if (path.includes(this.floatingEl) || path.includes(this.triggerEl)) {
			return;
		}
		this.setOpen(false);
	};

	private setOpen(open: boolean) {
		if (open === this.open) {
			return;
		}
		if (open && !this.hasContent) {
			return;
		}
		this.open = open;
		if (this.floatingEl) {
			this.floatingEl.hidden = !open;
		}
		if (this.triggerEl) {
			this.triggerEl.setAttribute('aria-expanded', String(open));
		}
		if (open) {
			this.updatePosition();
			this.startAutoUpdate();
			this.attachGlobalEvents();
		} else {
			this.stopAutoUpdate();
			this.detachGlobalEvents();
		}
	}

	private attachGlobalEvents() {
		if (this.globalController) {
			return;
		}
		this.globalController = new AbortController();
		const { signal } = this.globalController;
		document.addEventListener('click', this.onDocumentClick, { capture: true, signal });
		document.addEventListener('keydown', this.onDocumentKeydown, { signal });
	}

	private detachGlobalEvents() {
		this.globalController?.abort();
		this.globalController = null;
	}

	private startAutoUpdate() {
		if (!this.triggerEl || !this.floatingEl) {
			return;
		}
		this.cleanupAutoUpdate = autoUpdate(this.triggerEl, this.floatingEl, () => {
			this.updatePosition();
		});
	}

	private stopAutoUpdate() {
		this.cleanupAutoUpdate?.();
		this.cleanupAutoUpdate = null;
	}

	private async updatePosition() {
		if (!this.triggerEl || !this.floatingEl) {
			return;
		}
		const arrowEl = this.arrowEl;
		const offsetValue = Number.isFinite(this.offsetValue) ? this.offsetValue : 8;

		const middleware = [offset(offsetValue), flip(), shift({ padding: 8 })];
		if (arrowEl) {
			middleware.push(arrow({ element: arrowEl, padding: 6 }));
		}

		const { x, y, placement, middlewareData } = await computePosition(
			this.triggerEl,
			this.floatingEl,
			{
				placement: 'bottom-end',
				strategy: 'fixed',
				middleware,
			}
		);

		if (!this.open || !this.floatingEl) {
			return;
		}

		Object.assign(this.floatingEl.style, {
			left: `${x}px`,
			top: `${y}px`,
		});

		if (arrowEl && middlewareData.arrow) {
			const { x: arrowX, y: arrowY } = middlewareData.arrow;
			const staticSide = {
				top: 'bottom',
				right: 'left',
				bottom: 'top',
				left: 'right',
			}[placement.split('-')[0]];

			Object.assign(arrowEl.style, {
				left: arrowX != null ? `${arrowX}px` : '',
				top: arrowY != null ? `${arrowY}px` : '',
				right: '',
				bottom: '',
				[staticSide]: '-4px',
			});
		}
	}
}

export function registerAtlasPopup() {
	if (!customElements.get('atlas-popup')) {
		customElements.define('atlas-popup', AtlasPopup);
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'atlas-popup': AtlasPopup;
	}
}
