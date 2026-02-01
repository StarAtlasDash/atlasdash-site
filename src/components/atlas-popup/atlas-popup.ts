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

	@bindAttribute('trigger-label')
	accessor triggerLabel: string = 'More info';

	@bindAttribute('dialog-label')
	accessor dialogLabel: string = 'Info';

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

	@bindTemplateElement('slot[name="info"]')
	private contentSlot: HTMLSlotElement | null = null;

	@bindTemplateElement('.popup-close')
	private closeEl: HTMLButtonElement | null = null;

	private open = false;
	private hasContent = false;
	private cleanupAutoUpdate: (() => void) | null = null;
	private globalController: AbortController | null = null;
	private lastFocused: HTMLElement | null = null;
	private readonly instanceId = `popup-${Math.random().toString(36).slice(2, 10)}`;

	constructor() {
		super(template, style);
	}

	protected render(): void {
		if (this.triggerEl) {
			this.triggerEl.setAttribute('aria-label', this.triggerLabel || 'More info');
		}
		if (this.floatingEl) {
			this.floatingEl.setAttribute('aria-label', this.dialogLabel || 'Info');
			this.floatingEl.setAttribute('aria-modal', 'true');
		}
		if (this.titleEl) {
			this.titleEl.textContent = this.title || 'Details';
			if (!this.titleEl.id) {
				this.titleEl.id = `${this.instanceId}-title`;
			}
		}
		if (this.bodyEl && !this.bodyEl.id) {
			this.bodyEl.id = `${this.instanceId}-body`;
		}

		this.hasContent = this.hasSlotContent();
		if (this.triggerEl) {
			this.triggerEl.hidden = !this.hasContent;
		}
		if (this.floatingEl) {
			if (this.titleEl && this.titleEl.textContent) {
				this.floatingEl.setAttribute('aria-labelledby', this.titleEl.id);
				this.floatingEl.removeAttribute('aria-label');
			} else {
				this.floatingEl.setAttribute('aria-label', this.dialogLabel || 'Info');
				this.floatingEl.removeAttribute('aria-labelledby');
			}
			if (this.bodyEl && this.hasContent) {
				this.floatingEl.setAttribute('aria-describedby', this.bodyEl.id);
			} else {
				this.floatingEl.removeAttribute('aria-describedby');
			}
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

	protected onSlotChange = () => {
		this.render();
	};

	private bindEvents() {
		this.triggerEl?.addEventListener('click', this.onToggle);
		this.triggerEl?.addEventListener('mousedown', this.onTriggerMouseDown);
		this.closeEl?.addEventListener('click', this.onClose);
		this.floatingEl?.addEventListener('click', this.onFloatingClick);
		this.floatingEl?.addEventListener('mousedown', this.onFloatingMouseDown);
		this.floatingEl?.addEventListener('keydown', this.onFloatingKeydown);
	}

	private unbindEvents() {
		this.triggerEl?.removeEventListener('click', this.onToggle);
		this.triggerEl?.removeEventListener('mousedown', this.onTriggerMouseDown);
		this.closeEl?.removeEventListener('click', this.onClose);
		this.floatingEl?.removeEventListener('click', this.onFloatingClick);
		this.floatingEl?.removeEventListener('mousedown', this.onFloatingMouseDown);
		this.floatingEl?.removeEventListener('keydown', this.onFloatingKeydown);
		this.detachGlobalEvents();
		this.stopAutoUpdate();
	}


	private onToggle = (event?: Event) => {
		event?.stopPropagation();
		this.setOpen(!this.open);
	};

	private onClose = () => {
		this.setOpen(false);
	};

	private onTriggerMouseDown = (event: MouseEvent) => {
		event.stopPropagation();
	};

	private onFloatingClick = (event: MouseEvent) => {
		event.stopPropagation();
	};

	private onFloatingMouseDown = (event: MouseEvent) => {
		event.stopPropagation();
	};

	private onFloatingKeydown = (event: KeyboardEvent) => {
		if (event.key !== 'Tab') {
			return;
		}
		const focusable = this.getFocusableElements();
		if (!focusable.length) {
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = this.contentRoot.activeElement as HTMLElement | null;
		if (event.shiftKey && active === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
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
			this.lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			this.updatePosition();
			this.startAutoUpdate();
			this.attachGlobalEvents();
			queueMicrotask(() => {
				this.getFocusableElements()[0]?.focus();
			});
		} else {
			this.stopAutoUpdate();
			this.detachGlobalEvents();
			if (this.lastFocused && document.contains(this.lastFocused)) {
				this.lastFocused.focus();
			}
			this.lastFocused = null;
		}
	}

	private hasSlotContent() {
		if (!this.contentSlot) {
			return false;
		}
		const nodes = this.contentSlot.assignedNodes({ flatten: true });
		return nodes.some((node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				return !!node.textContent?.trim();
			}
			if (node instanceof HTMLSlotElement) {
				const assigned = node.assignedNodes({ flatten: true });
				return assigned.some((assignedNode) => {
					if (assignedNode.nodeType === Node.TEXT_NODE) {
						return !!assignedNode.textContent?.trim();
					}
					if (assignedNode instanceof HTMLElement) {
						return !!assignedNode.textContent?.trim() || !!assignedNode.querySelector('*');
					}
					return true;
				});
			}
			if (node instanceof HTMLElement) {
				return !!node.textContent?.trim() || !!node.querySelector('*');
			}
			return false;
		});
	}

	private getFocusableElements() {
		if (!this.floatingEl) {
			return [];
		}
		return Array.from(
			this.floatingEl.querySelectorAll<HTMLElement>(
				'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
			)
		).filter((el) => !el.hasAttribute('disabled'));
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

			const baseStyles: Partial<CSSStyleDeclaration> = {
				left: arrowX != null ? `${arrowX}px` : '',
				top: arrowY != null ? `${arrowY}px` : '',
				right: '',
				bottom: '',
			};
			if (staticSide) {
				Object.assign(baseStyles, { [staticSide]: '-4px' });
			}
			Object.assign(arrowEl.style, baseStyles);
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
