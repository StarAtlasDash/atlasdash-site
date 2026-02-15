import {
	AttributeType,
	BaseComponentElement,
	bindAttribute,
	bindTemplateElement,
	customElement,
} from '../../libs/base-component';
import template from './atlas-panel.html?raw';
import style from './atlas-panel.css?inline';

type AtlasPanelType = 'chart' | 'table';

@customElement('atlas-panel')
export class AtlasPanel extends BaseComponentElement {
	@bindAttribute('type', { type: AttributeType.String })
	accessor type: string = '';

	@bindAttribute('label', { type: AttributeType.String })
	accessor label: string = '';

	@bindTemplateElement('#panel-content-slot')
	private contentSlotEl: HTMLSlotElement | null = null;

	@bindTemplateElement('#panel-tag')
	private panelTagEl: HTMLElement | null = null;

	private labelObserver: MutationObserver | null = null;
	private observedContentEl: HTMLElement | null = null;

	constructor() {
		super(template, style);
	}

	protected render(): void {
		const panelType = this.getPanelType();
		const panelLabel = this.getPanelLabel();
		this.setAttribute('data-panel-type', panelType);
		if (this.panelTagEl) {
			this.panelTagEl.textContent = panelLabel;
			this.panelTagEl.toggleAttribute('hidden', !panelLabel);
		}
		this.observeSlottedLabelChanges();
	}

	protected onConnected(): void {
		this.observeSlottedLabelChanges();
	}

	protected onDisconnected(): void {
		this.labelObserver?.disconnect();
		this.labelObserver = null;
		this.observedContentEl = null;
	}

	protected onSlotChange = (): void => {
		this.render();
	};

	private getPanelType(): AtlasPanelType {
		const explicitType = this.type.trim().toLowerCase();
		if (explicitType === 'chart' || explicitType === 'table') {
			return explicitType;
		}

		const assignedElements = this.contentSlotEl?.assignedElements({ flatten: true }) ?? [];
		for (const element of assignedElements) {
			const tagName = element.tagName.toLowerCase();
			if (tagName.includes('table') || tagName === 'table') {
				return 'table';
			}
			if (tagName.includes('chart')) {
				return 'chart';
			}
		}

		return 'chart';
	}

	private getPanelLabel(): string {
		const explicitLabel = this.label.trim();
		if (explicitLabel) {
			return explicitLabel;
		}

		const contentEl = this.getPrimaryContentElement();
		const inheritedLabel = contentEl?.getAttribute('label')?.trim() || '';
		return inheritedLabel;
	}

	private getPrimaryContentElement(): HTMLElement | null {
		const assignedElements = this.contentSlotEl?.assignedElements({ flatten: true }) ?? [];
		for (const element of assignedElements) {
			if (element instanceof HTMLElement) {
				return element;
			}
		}
		return null;
	}

	private observeSlottedLabelChanges(): void {
		const contentEl = this.getPrimaryContentElement();
		if (contentEl === this.observedContentEl) {
			return;
		}

		this.labelObserver?.disconnect();
		this.observedContentEl = contentEl;

		if (!contentEl) {
			return;
		}

		this.labelObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'attributes' && mutation.attributeName === 'label') {
					this.render();
					return;
				}
			}
		});

		this.labelObserver.observe(contentEl, { attributes: true, attributeFilter: ['label'] });
	}
}

export function registerAtlasPanel() {
	if (!customElements.get('atlas-panel')) {
		customElements.define('atlas-panel', AtlasPanel);
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'atlas-panel': AtlasPanel;
	}
}
