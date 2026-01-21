(Symbol as any).metadata ??= Symbol.for('Symbol.metadata');

export interface ElementBinding {
	propertyKey: string;
	selector: string;
}

export interface AttributeBinding {
	propertyKey: string;
	attributeName: string;
}

export enum AttributeType {
	Number = 'number',
	String = 'string',
	Boolean = 'boolean',
}

export function customElement(name: string) {
	return <This extends new (...args: any) => any>(_: any, { addInitializer }: ClassDecoratorContext<This>) => {
		addInitializer(function () {
			customElements.define(name, this);
		});
	};
}

export function bind(
	value: (...args: any) => any,
	{ kind, name, addInitializer }: ClassMethodDecoratorContext<HTMLElement>
) {
	if (kind !== 'method') {
		throw new Error('Can not apply `bind` to anything other than class methods.');
	}

	addInitializer(function (this: HTMLElement) {
		(this as any)[name] = value.bind(this);
	});
}

export function bindTemplateElement(selector: string) {
	return function (_: undefined, { name, metadata }: ClassFieldDecoratorContext<HTMLElement, HTMLElement | null>) {
		const bindings = ((metadata.elementBindings as ElementBinding[] | undefined) ??= []);
		bindings.push({ propertyKey: name as string, selector });
	};
}

interface BindAttributeConfig {
	type?: AttributeType;
	required?: boolean;
}

type AttributeBindingType = string | number | boolean;

type BindAttributeAccessorDecoratorTarget<This extends HTMLElement> = ClassAccessorDecoratorTarget<
	This,
	AttributeBindingType | null
>;
type BindAttributeAccessorDecoratorContext<This extends HTMLElement> = ClassAccessorDecoratorContext<
	This,
	AttributeBindingType | null
>;
type BindAttributeAccessorDecoratorFn<T extends AttributeBindingType> = <This extends HTMLElement>(
	target: BindAttributeAccessorDecoratorTarget<This>,
	context: BindAttributeAccessorDecoratorContext<This>
) => ClassAccessorDecoratorResult<This, T>;

export function bindAttribute<T extends string = string>(
	attributeName: string,
	cfg?: BindAttributeConfig & { type?: AttributeType.String }
): BindAttributeAccessorDecoratorFn<T>;
export function bindAttribute(
	attributeName: string,
	cfg: BindAttributeConfig & { type: AttributeType.Number }
): BindAttributeAccessorDecoratorFn<number>;
export function bindAttribute(
	attributeName: string,
	cfg: BindAttributeConfig & { type: AttributeType.Boolean }
): BindAttributeAccessorDecoratorFn<boolean>;
export function bindAttribute(
	attributeName: string,
	cfg?: BindAttributeConfig
): BindAttributeAccessorDecoratorFn<AttributeBindingType> {
	return function <This extends HTMLElement>(
		_: BindAttributeAccessorDecoratorTarget<This>,
		{ name, kind, metadata }: BindAttributeAccessorDecoratorContext<This>
	): ClassAccessorDecoratorResult<This, AttributeBindingType> {
		if (kind !== 'accessor') {
			throw new Error(`Cannot apply \`bindAttribute\` to ${kind}.`);
		}

		const type = cfg?.type;
		const required = !!cfg?.required;
		const bindings = ((metadata.attributeBindings as AttributeBinding[] | undefined) ??= []);
		bindings.push({ propertyKey: name as string, attributeName });
		let initValue: AttributeBindingType | undefined = undefined;

		const get = function (this: This): AttributeBindingType {
			//console.log(this, name, this.getAttribute(attributeName));

			const value = this.getAttribute(attributeName) ?? `${initValue}`;
			if (value === null && required) {
				throw new Error(`Missing required attribute \`${attributeName}\` on ${String(name)}}.`);
			}
			if (type === AttributeType.Number) {
				return parseFloat(value || '0');
			} else if (type === AttributeType.Boolean) {
				return this.hasAttribute(attributeName);
			} else {
				return value || '';
			}
		};

		const set = function (this: This, newValue: AttributeBindingType) {
			if (newValue) {
				this.setAttribute(attributeName, (type === AttributeType.Boolean) ? '' : `${newValue}`);
			} else {
				this.removeAttribute(attributeName);
			}
		};

		const init = function (this: This, value: AttributeBindingType | undefined): AttributeBindingType {
			if (value !== undefined) {
				initValue = value;
			}
			return value ?? '';
		};

		return {
			get,
			set,
			init,
		};
	};
}

export abstract class BaseComponentElement extends HTMLElement {
	static get observedAttributes() {
		const metadata = this[Symbol.metadata];
		if (!metadata || !metadata.attributeBindings) {
			return [];
		}
		const bindings = metadata.attributeBindings as AttributeBinding[];
		return bindings.map(({ attributeName }) => attributeName);
	}

	protected contentRoot: ShadowRoot; // ShadowRoot - no matter if mode is open or closed

	private connected: boolean = false;

	constructor(template: string, style: string) {
		super();

		const styleElement = document.createElement('style');
		const templateElement = document.createElement('template');
		styleElement.textContent = style;
		templateElement.innerHTML = template;

		this.contentRoot = this.attachShadow({ mode: 'open' });
		this.contentRoot.append(styleElement, templateElement.content.cloneNode(true));
	}

	connectedCallback() {
		this.bindElements();

		const slots = this.shadowRoot?.querySelectorAll('slot');
		if (slots && slots.length) {
			slots.forEach((slotEl) => slotEl.addEventListener('slotchange', this.onSlotChange));
		}

		this.render();
		this.onConnected();
		this.connected = true;
	}

	disconnectedCallback() {
		const slots = this.shadowRoot?.querySelectorAll('slot');
		if (slots && slots.length) {
			slots.forEach((slotEl) => slotEl.removeEventListener('slotchange', this.onSlotChange));
		}
		this.onDisconnected();
	}

	attributeChangedCallback(name: string, oldValue: string, newValue: string) {
		//console.log('attributeChangedCallback', name, oldValue, newValue);
		if (this.connected && oldValue !== newValue) {
			const bindings =
				(this.constructor[Symbol.metadata]?.attributeBindings as AttributeBinding[] | undefined) ?? [];
			const binding = bindings.find(({ attributeName }) => name === attributeName);

			if (!binding) {
				return this.onAttributeChanged(name, oldValue, newValue);
			} else {
				this.render(); // Trigger re-render as the getters will pick up the new value automatically
			}
		}
	}
	protected bindElements() {
		const bindings = (this.constructor[Symbol.metadata]?.elementBindings as ElementBinding[] | undefined) ?? [];

		if (bindings && this.shadowRoot) {
			bindings.forEach((binding) => {
				(this as any)[binding.propertyKey] = this.contentRoot.querySelector(binding.selector);
			});
		}
	}

	protected abstract render(): void;

	protected emitEvent(eventName: string, detail?: any) {
		this.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true, composed: true }));
	}

	protected onConnected(): void {
		// To be optionally implemented by subclasses
	}

	protected onDisconnected(): void {
		// To be optionally implemented by subclasses
	}

	protected onSlotChange = () => {
		// To be optionally implemented by subclasses
	};

	protected onAttributeChanged(name: string, oldValue: string, newValue: string) {
		name;
		oldValue;
		newValue;
		// To be optionally implemented by subclasses
	}
}
