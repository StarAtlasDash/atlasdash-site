import {
	AttributeType,
	BaseComponentElement,
	bindAttribute,
	bindTemplateElement,
	customElement,
} from '../../libs/base-component';
import { autoUpdate, computePosition, flip, offset, shift } from '@floating-ui/dom';
import template from './atlas-filter.html?raw';
import style from './atlas-filter.css?inline';
import type { Filter } from '../../types/filter';

interface FilterOption {
	value: string | number;
	rawValue: string;
	label: string;
	field?: string;
	valueType?: string;
	icon?: string;
	disabled?: boolean;
	description?: string;
	info?: string;
	colorscheme?: string[];
}

@customElement('atlas-filter')
export class AtlasFilter extends BaseComponentElement {
	@bindAttribute('label')
	accessor label: string = '';

	@bindAttribute('target')
	accessor target: string = '';

	@bindAttribute('field')
	accessor field: string = '';

	@bindAttribute('selected')
	accessor selected: string = '';

	@bindAttribute('multiple', { type: AttributeType.Boolean })
	accessor multiple: boolean = false;

	@bindTemplateElement('.filter-trigger')
	private triggerEl: HTMLButtonElement | null = null;

	@bindTemplateElement('.filter-label')
	private labelEl: HTMLSpanElement | null = null;

	@bindTemplateElement('.filter-value')
	private valueEl: HTMLSpanElement | null = null;

	@bindTemplateElement('.filter-options')
	private optionsEl: HTMLDivElement | null = null;

	@bindTemplateElement('.filter-floating')
	private floatingEl: HTMLDivElement | null = null;

	@bindTemplateElement('.filter-panel')
	private panelEl: HTMLDivElement | null = null;

	@bindTemplateElement('slot')
	private slotEl: HTMLSlotElement | null = null;

	private open = false;
	private cleanupAutoUpdate: (() => void) | null = null;
	private globalController: AbortController | null = null;
	private options: FilterOption[] = [];
	private optionButtons: HTMLButtonElement[] = [];
	private optionsSignature = '';
	private selectedValues: Array<string | number> = [];
	private lastSelectedOption: FilterOption | null = null;
	private lastSelectedAttr = '';
	private lastFocused: HTMLElement | null = null;
	private warnedMissingField = false;
	private readonly instanceId = `filter-${Math.random().toString(36).slice(2, 10)}`;
	private mutationObserver: MutationObserver | null = null;
	private lastMultiple = this.multiple;
	private observedRoot: Node | null = null;
	private labelIconEl: HTMLImageElement | null = null;

	constructor() {
		super(template, style);
	}

	protected render(): void {
		this.syncOptions();
		this.syncSelectionFromAttribute();
		this.updateTriggerText();
		this.updatePanelAccessibility();
		if (this.panelEl && !this.panelEl.id) {
			this.panelEl.id = `${this.instanceId}-listbox`;
		}
		if (this.triggerEl && !this.triggerEl.id) {
			this.triggerEl.id = `${this.instanceId}-trigger`;
		}
		if (this.panelEl) {
			this.panelEl.setAttribute('aria-label', this.label || 'Filter options');
		}
		if (this.triggerEl && this.panelEl?.id) {
			this.triggerEl.setAttribute('aria-controls', this.panelEl.id);
			this.panelEl?.setAttribute('aria-labelledby', this.triggerEl.id);
		}
	}

	protected onConnected(): void {
		this.bindEvents();
		this.startTargetObserver();
	}

	protected onDisconnected(): void {
		this.unbindEvents();
		this.stopTargetObserver();
	}

	protected onSlotChange = () => {
		this.render();
	};

	private bindEvents() {
		this.triggerEl?.addEventListener('click', this.onToggle);
		this.triggerEl?.addEventListener('keydown', this.onTriggerKeydown);
		this.triggerEl?.addEventListener('mousedown', this.onTriggerMouseDown);
	}

	private unbindEvents() {
		this.triggerEl?.removeEventListener('click', this.onToggle);
		this.triggerEl?.removeEventListener('keydown', this.onTriggerKeydown);
		this.triggerEl?.removeEventListener('mousedown', this.onTriggerMouseDown);
		this.detachGlobalEvents();
		this.stopAutoUpdate();
	}

	private onToggle = () => {
		this.setOpen(!this.open);
	};

	private onTriggerMouseDown = (event: MouseEvent) => {
		event.stopPropagation();
	};

	private onTriggerKeydown = (event: KeyboardEvent) => {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			this.setOpen(true);
			queueMicrotask(() => {
				const option =
					event.key === 'ArrowUp'
						? this.optionButtons[this.optionButtons.length - 1]
						: this.optionButtons[0];
				option?.focus();
			});
		}
	};

	private onOptionClick = (event: MouseEvent) => {
		const target = event.currentTarget as HTMLButtonElement | null;
		if (!target) {
			return;
		}
		const rawValue = target.dataset.value ?? '';
		const option = this.options.find((opt) => opt.rawValue === rawValue);
		if (!option) {
			return;
		}
		this.toggleSelection(option);
	};

	private onOptionKeydown = (event: KeyboardEvent) => {
		const target = event.currentTarget as HTMLButtonElement | null;
		if (!target) {
			return;
		}
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			target.click();
			return;
		}
		if (event.key === 'Escape') {
			this.setOpen(false);
			return;
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
			event.preventDefault();
			const buttons = this.optionButtons;
			if (!buttons.length) {
				return;
			}
			const currentIndex = buttons.indexOf(target);
			let nextIndex = currentIndex;
			if (event.key === 'ArrowDown') {
				nextIndex = Math.min(buttons.length - 1, currentIndex + 1);
			} else if (event.key === 'ArrowUp') {
				nextIndex = Math.max(0, currentIndex - 1);
			} else if (event.key === 'Home') {
				nextIndex = 0;
			} else if (event.key === 'End') {
				nextIndex = buttons.length - 1;
			}
			buttons[nextIndex]?.focus();
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

	private onDocumentKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			this.setOpen(false);
		}
	};

	private setOpen(open: boolean) {
		if (open === this.open) {
			return;
		}
		if (open && !this.options.length) {
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
				const selected = this.getSelectedOptionButton() ?? this.optionButtons[0];
				selected?.focus();
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

	private startTargetObserver() {
		const preferredRoot = this.getPreferredObserverRoot();
		if (preferredRoot && preferredRoot !== this.observedRoot) {
			this.stopTargetObserver();
			this.observedRoot = preferredRoot;
		}
		if (this.mutationObserver) {
			return;
		}
		this.mutationObserver = new MutationObserver(() => {
			const nextRoot = this.getPreferredObserverRoot();
			if (nextRoot && nextRoot !== this.observedRoot) {
				this.stopTargetObserver();
				this.startTargetObserver();
				return;
			}
			if (this.selectedValues.length === 0 || !this.target) {
				return;
			}
			this.applyFilterToTargets();
		});
		const root = this.observedRoot ?? document.documentElement;
		this.mutationObserver.observe(root, {
			childList: true,
			subtree: true,
		});
	}

	private stopTargetObserver() {
		this.mutationObserver?.disconnect();
		this.mutationObserver = null;
		this.observedRoot = null;
	}

	private getPreferredObserverRoot(): Node | null {
		const grid = this.closest('atlas-analytics-grid') as HTMLElement | null;
		if (grid?.shadowRoot) {
			return grid.shadowRoot;
		}
		if (grid) {
			return grid;
		}
		return document.documentElement;
	}

	private attachGlobalEvents() {
		this.detachGlobalEvents();
		this.globalController = new AbortController();
		const { signal } = this.globalController;
		document.addEventListener('click', this.onDocumentClick, { signal });
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
		this.cleanupAutoUpdate = autoUpdate(this.triggerEl, this.floatingEl, () => this.updatePosition());
	}

	private stopAutoUpdate() {
		this.cleanupAutoUpdate?.();
		this.cleanupAutoUpdate = null;
	}

	private updatePosition() {
		if (!this.triggerEl || !this.floatingEl) {
			return;
		}
		computePosition(this.triggerEl, this.floatingEl, {
			placement: 'bottom-start',
			middleware: [offset(6), flip(), shift({ padding: 8 })],
		}).then(({ x, y }) => {
			Object.assign(this.floatingEl?.style ?? {}, {
				left: `${x}px`,
				top: `${y}px`,
			});
		});
	}

	private syncOptions() {
		const optionElements = this.getOptionElements();
		const options = optionElements.map((element) => this.buildOption(element));
		const signature = options
			.map((opt) =>
				[
					opt.rawValue,
					opt.label,
					opt.field ?? '',
					opt.valueType ?? '',
					opt.icon ?? '',
					opt.description ?? '',
					opt.info ?? '',
					(opt.colorscheme ?? []).join(','),
				].join('|')
			)
			.join('||') + `||multiple:${this.multiple}`;
		if (signature === this.optionsSignature) {
			return;
		}
		this.optionsSignature = signature;
		this.options = options;
		this.renderOptions();
		this.syncSelectionFromAttribute(true);
	}

	private getOptionElements(): HTMLElement[] {
		const assigned = this.slotEl?.assignedElements({ flatten: true }) ?? [];
		const children = assigned.length ? assigned : Array.from(this.children);
		return children.filter((element) => element instanceof HTMLElement && element.hasAttribute('value')) as HTMLElement[];
	}

	private buildOption(element: HTMLElement): FilterOption {
		const rawValue = element.getAttribute('value') ?? '';
		const name = element.getAttribute('name') ?? '';
		const field = element.getAttribute('field') ?? undefined;
		const valueType = element.getAttribute('value-type') ?? undefined;
		const icon = element.getAttribute('icon') ?? undefined;
		const disabled = element.hasAttribute('disabled');
		const description = element.getAttribute('description') ?? undefined;
		const info = element.getAttribute('info') ?? undefined;
		const colorscheme = this.parseColorscheme(element.getAttribute('colorscheme'));
		return {
			value: this.parseValue(rawValue, valueType),
			rawValue,
			label: name || rawValue,
			field,
			valueType,
			icon,
			disabled,
			description,
			info,
			colorscheme,
		};
	}

	private parseColorscheme(value: string | null): string[] | undefined {
		if (!value) {
			return undefined;
		}
		const colors = value
			.split(',')
			.map((entry) => entry.trim())
			.filter(Boolean);
		return colors.length ? colors : undefined;
	}

	private parseValue(value: string, valueType?: string | null): string | number {
		const trimmed = value.trim();
		if (valueType === 'string') {
			return trimmed;
		}
		if (valueType === 'number') {
			const numeric = Number(trimmed);
			return Number.isFinite(numeric) ? numeric : trimmed;
		}
		if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
			const numeric = Number(trimmed);
			if (Number.isFinite(numeric)) {
				return numeric;
			}
		}
		return trimmed;
	}

	private renderOptions() {
		if (!this.optionsEl) {
			return;
		}
		this.optionsEl.innerHTML = '';
		this.optionButtons = this.options.map((option) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'filter-option';
			button.dataset.value = option.rawValue;
			button.setAttribute('role', this.multiple ? 'menuitemcheckbox' : 'menuitemradio');
			button.setAttribute('aria-checked', 'false');
			button.tabIndex = -1;
			if ((option as { disabled?: boolean }).disabled) {
				button.disabled = true;
				button.setAttribute('aria-disabled', 'true');
			}
			if (option.icon) {
				const img = document.createElement('img');
				img.className = 'filter-option-icon';
				img.src = option.icon;
				img.alt = '';
				img.setAttribute('aria-hidden', 'true');
				button.appendChild(img);
			}
			const span = document.createElement('span');
			span.className = 'filter-option-label';
			span.textContent = option.label || option.rawValue;
			button.appendChild(span);
			button.addEventListener('click', this.onOptionClick);
			button.addEventListener('keydown', this.onOptionKeydown);
			this.optionsEl?.appendChild(button);
			return button;
		});
	}

	private syncSelectionFromAttribute(force = false) {
		const attrValue = this.selected || '';
		if (!force && attrValue === this.lastSelectedAttr && this.options.length) {
			return;
		}
		this.lastSelectedAttr = attrValue;
		const tokens = attrValue
			.split(/[\s,]+/)
			.map((token) => token.trim())
			.filter(Boolean);
		const selectedOptions: FilterOption[] = [];
		for (const token of tokens) {
			const option = this.options.find(
				(opt) => opt.rawValue === token || opt.label === token || String(opt.value) === token
			);
			if (option) {
				selectedOptions.push(option);
			}
		}
		this.setSelectedValues(selectedOptions, false);
	}

	private setSelectedValues(options: FilterOption[], updateAttribute: boolean) {
		const unique = new Map<string, FilterOption>();
		options.forEach((option) => {
			unique.set(option.rawValue, option);
		});
		const ordered = Array.from(unique.values());
		if (!this.multiple && ordered.length > 1) {
			ordered.splice(1);
		}
		this.selectedValues = ordered.map((option) => option.value);
		if (ordered.length) {
			this.lastSelectedOption = ordered[ordered.length - 1];
		}
		this.updateOptionSelection(ordered);
		this.updateTriggerText(ordered);
		if (updateAttribute) {
			this.updateSelectedAttribute(ordered);
		}
		this.applyFilterToTargets();
	}

	private updateOptionSelection(selectedOptions: FilterOption[]) {
		const selectedSet = new Set(selectedOptions.map((option) => option.rawValue));
		this.optionButtons.forEach((button, index) => {
			const rawValue = button.dataset.value ?? '';
			const isSelected = selectedSet.has(rawValue);
			button.setAttribute('aria-checked', isSelected ? 'true' : 'false');
			button.setAttribute('role', this.multiple ? 'menuitemcheckbox' : 'menuitemradio');
			if (selectedSet.size === 0 && index === 0) {
				button.tabIndex = 0;
			} else {
				button.tabIndex = isSelected ? 0 : -1;
			}
		});
	}

	private updateSelectedAttribute(selectedOptions: FilterOption[]) {
		const value = selectedOptions.map((option) => option.rawValue).join(', ');
		if (value) {
			this.setAttribute('selected', value);
		} else {
			this.removeAttribute('selected');
		}
		this.lastSelectedAttr = value;
	}

	private updateTriggerText(selectedOptions?: FilterOption[]) {
		const selected = selectedOptions ?? this.getSelectedOptions();
		const hasSelection = selected.length > 0;
		this.classList.toggle('has-selection', hasSelection);
		if (this.labelEl) {
			this.labelEl.hidden = !hasSelection;
			this.labelEl.textContent = this.label || '';
		}
		if (this.valueEl) {
			if (!hasSelection) {
				this.valueEl.textContent = this.label || '';
			} else if (selected.length === 1) {
				this.valueEl.textContent = selected[0].label || selected[0].rawValue;
			} else {
				this.valueEl.textContent = selected.map((option) => option.label).join(', ');
			}
		}
		this.updateSelectedIcon(hasSelection ? selected[selected.length - 1] : null);
	}

	private updateSelectedIcon(option: FilterOption | null) {
		if (!this.triggerEl || !this.valueEl) {
			return;
		}
		const icon = option?.icon;
		if (!icon) {
			this.labelIconEl?.remove();
			this.labelIconEl = null;
			return;
		}
		if (!this.labelIconEl) {
			const img = document.createElement('img');
			img.className = 'filter-selected-icon';
			img.alt = '';
			img.setAttribute('aria-hidden', 'true');
			this.labelIconEl = img;
		}
		this.labelIconEl.src = icon;
		this.valueEl.prepend(this.labelIconEl);
	}

	private updatePanelAccessibility() {
		if (!this.panelEl) {
			return;
		}
		this.panelEl.setAttribute('role', 'menu');
		if (this.multiple !== this.lastMultiple) {
			this.lastMultiple = this.multiple;
			this.updateOptionSelection(this.getSelectedOptions());
		}
	}

	private toggleSelection(option: FilterOption) {
		if (option.disabled) {
			return;
		}
		const selected = this.getSelectedOptions();
		const exists = selected.find((entry) => entry.rawValue === option.rawValue);
		let next: FilterOption[] = [];
		if (this.multiple) {
			next = exists
				? selected.filter((entry) => entry.rawValue !== option.rawValue)
				: [...selected, option];
		} else {
			if (exists) {
				this.setOpen(false);
				return;
			}
			next = [option];
		}
		this.lastSelectedOption = option;
		this.setSelectedValues(next, true);
		if (!this.multiple) {
			this.setOpen(false);
		}
	}

	private getSelectedOptions() {
		const selectedSet = new Set(this.selectedValues.map((value) => String(value)));
		return this.options.filter((option) => selectedSet.has(String(option.value)));
	}

	private getSelectedOptionButton(): HTMLButtonElement | undefined {
		const selectedOptions = this.getSelectedOptions();
		if (!selectedOptions.length) {
			return undefined;
		}
		const rawValue = selectedOptions[0].rawValue;
		return this.optionButtons.find((button) => button.dataset.value === rawValue);
	}

	private applyFilterToTargets() {
		const selectedOptions = this.getSelectedOptions();
		if (!this.target || !selectedOptions.length) {
			this.stopTargetObserver();
		}
		const { targets, missing } = this.getTargetElementsWithMissing();
		if (!selectedOptions.length) {
			targets.forEach((target) => {
				(target as { filter?: Filter | Filter[] | null }).filter = null;
			});
			return;
		}
		const selections = selectedOptions
			.map((option) => ({
				option,
				field: option.field ?? this.field,
			}))
			.filter((entry) => !!entry.field) as Array<{ option: FilterOption; field: string }>;
		if (!selections.length) {
			if (!this.warnedMissingField) {
				console.warn('atlas-filter requires a "field" attribute (or per-option field) to build filters.');
				this.warnedMissingField = true;
			}
			return;
		}

		const override = this.lastSelectedOption;
		let filter: Filter | Filter[];

		if (this.multiple) {
			const first = selections[0].field;
			const sameField = selections.every((entry) => entry.field === first);
			if (sameField) {
				const values = selections.map((entry) => entry.option.value);
				const allNumbers = values.every((value) => typeof value === 'number');
				filter = {
					field: first,
					value: allNumbers ? (values as number[]) : values.map((value) => String(value)),
					description: override?.description,
					info: override?.info,
					colorscheme: override?.colorscheme,
				};
			} else {
				filter = selections.map((entry) => ({
					field: entry.field,
					value: entry.option.value,
					description: entry.option.description,
					info: entry.option.info,
					colorscheme: entry.option.colorscheme,
				}));
			}
		} else {
			filter = {
				field: selections[0].field,
				value: selections[0].option.value,
				description: override?.description,
				info: override?.info,
				colorscheme: override?.colorscheme,
			};
		}
		targets.forEach((target) => {
			(target as { filter?: Filter | Filter[] | null }).filter = filter;
		});
		if (!missing.length) {
			this.stopTargetObserver();
		}
	}

	private getTargetElementsWithMissing(): { targets: HTMLElement[]; missing: string[] } {
		const ids = this.parseTargetIds();
		const targets: HTMLElement[] = [];
		const missing: string[] = [];
		const preferredGrid = this.closest('atlas-analytics-grid') as HTMLElement | null;
		const preferredRoot = preferredGrid?.shadowRoot ?? null;
		ids.forEach((id) => {
			if (preferredRoot) {
				const scoped = this.findTargetById(preferredRoot, id);
				if (scoped) {
					targets.push(scoped);
					return;
				}
			}
			const direct = this.findTargetById(document, id);
			if (direct) {
				targets.push(direct);
				return;
			}
			const grids = Array.from(document.querySelectorAll('atlas-analytics-grid')) as HTMLElement[];
			let found = false;
			for (const grid of grids) {
				const shadowRoot = (grid as HTMLElement & { shadowRoot?: ShadowRoot }).shadowRoot;
				if (!shadowRoot) {
					continue;
				}
				const inside = this.findTargetById(shadowRoot, id);
				if (inside) {
					targets.push(inside);
					found = true;
					break;
				}
			}
			if (!found) {
				missing.push(id);
			}
		});
		return { targets: Array.from(new Set(targets)), missing };
	}

	private parseTargetIds(): string[] {
		return (this.target || '')
			.split(/[\s,]+/)
			.map((entry) => entry.trim())
			.filter(Boolean);
	}

	private findTargetById(root: Document | ShadowRoot, id: string): HTMLElement | null {
		const target = 'getElementById' in root ? (root.getElementById(id) as HTMLElement | null) : null;
		if (target) {
			return this.resolveTargetElement(target);
		}
		try {
			const selector = `#${CSS.escape(id)}`;
			const fallback = root.querySelector(selector) as HTMLElement | null;
			return fallback ? this.resolveTargetElement(fallback) : null;
		} catch {
			return null;
		}
	}

	private resolveTargetElement(element: HTMLElement): HTMLElement | null {
		if (element.tagName.toLowerCase() === 'atlas-chart' || element.tagName.toLowerCase() === 'atlas-table') {
			return element;
		}
		const nested = element.querySelector('atlas-chart, atlas-table') as HTMLElement | null;
		return nested ?? null;
	}
}

export function registerAtlasFilter() {
	if (!customElements.get('atlas-filter')) {
		customElements.define('atlas-filter', AtlasFilter);
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'atlas-filter': AtlasFilter;
	}
}
