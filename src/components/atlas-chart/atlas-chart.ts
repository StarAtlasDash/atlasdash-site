import * as echarts from 'echarts';
import {
	AttributeType,
	BaseComponentElement,
	bindAttribute,
	bindTemplateElement,
	customElement,
} from '../../libs/base-component';
import template from './atlas-chart.html?raw';
import style from './atlas-chart.css?inline';

type ChartType = 'stacked-bar' | 'bar' | 'line' | 'area' | '';

@customElement('atlas-chart')
export class AtlasChart extends BaseComponentElement {
	@bindAttribute('title')
	accessor title: string = '';

	@bindAttribute('label')
	accessor label: string = '';

	@bindAttribute('description')
	accessor description: string = '';

	@bindAttribute<ChartType>('chart-type')
	accessor chartType: ChartType = '';

	@bindAttribute('x-label-density', { type: AttributeType.Number })
	accessor xLabelDensity: number = 0;

	@bindAttribute('no-legend', { type: AttributeType.Boolean })
	accessor noLegend: boolean = false;

	@bindTemplateElement('.chart-title')
	private titleEl: HTMLElement | null = null;

	@bindTemplateElement('.description-text')
	private descriptionEl: HTMLElement | null = null;

	@bindTemplateElement('.chart-description')
	private descriptionWrap: HTMLElement | null = null;

	@bindTemplateElement('.chart-label')
	private labelEl: HTMLElement | null = null;

	@bindTemplateElement('slot[name="description"]')
	private descriptionSlot: HTMLSlotElement | null = null;

	@bindTemplateElement('slot[name="info"]')
	private infoSlot: HTMLSlotElement | null = null;

	@bindTemplateElement('.chart-canvas')
	private chartCanvas: HTMLDivElement | null = null;

	@bindTemplateElement('.info-button')
	private infoButton: HTMLButtonElement | null = null;

	@bindTemplateElement('.info-popover')
	private infoPopover: HTMLDivElement | null = null;

	@bindTemplateElement('.info-close')
	private infoClose: HTMLButtonElement | null = null;

	private chart: echarts.ECharts | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private pendingOption: echarts.EChartsOption | null = null;
	private infoOpen = false;
	private resizeHandle: number | null = null;
	private lastOptionState = { chartType: '', noLegend: false };

	constructor() {
		super(template, style);
	}

	set data(option: echarts.EChartsOption | null) {
		if (!option) {
			return;
		}
		this.setOption(option);
	}

	get data() {
		return this.pendingOption;
	}

	setOption(option: echarts.EChartsOption, opts: echarts.SetOptionOpts = {}) {
		this.pendingOption = option;
		this.applyOption(opts);
	}

	protected render(): void {
		if (this.titleEl) {
			this.titleEl.textContent = this.title || '';
			this.titleEl.toggleAttribute('hidden', !this.title);
		}
		if (this.labelEl) {
			this.labelEl.textContent = this.label || '';
			this.labelEl.toggleAttribute('hidden', !this.label);
		}

		this.updateDescription();
		this.updateInfoVisibility();
		this.reapplyOptionIfNeeded();
		this.requestResize();
	}

	protected onConnected(): void {
		this.initChart();
		this.bindInfoEvents();
		this.updateDescription();
		this.updateInfoVisibility();
		this.applyOption();
	}

	protected onDisconnected(): void {
		this.unbindInfoEvents();
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.chart?.dispose();
		this.chart = null;
	}

	protected onSlotChange = () => {
		this.updateDescription();
		this.updateInfoVisibility();
		this.requestResize();
	};

	private initChart() {
		if (!this.chartCanvas || this.chart) {
			return;
		}
		this.chart = echarts.init(this.chartCanvas, undefined, { renderer: 'canvas' });
		this.resizeObserver = new ResizeObserver(() => this.queueResize());
		this.resizeObserver.observe(this);
	}

	private queueResize() {
		if (!this.chart) {
			return;
		}
		if (this.resizeHandle !== null) {
			cancelAnimationFrame(this.resizeHandle);
		}
		this.resizeHandle = requestAnimationFrame(() => {
			this.chart?.resize();
		});
	}

	private requestResize() {
		if (this.chart) {
			this.queueResize();
		}
	}

	private applyOption(opts: echarts.SetOptionOpts = {}) {
		if (!this.chart || !this.pendingOption) {
			return;
		}
		const merged = this.composeOption(this.pendingOption);
		this.chart.setOption(merged, { notMerge: true, ...opts });
	}

	private reapplyOptionIfNeeded() {
		const chartType = this.chartType || '';
		const noLegend = this.noLegend;
		if (
			this.chart &&
			this.pendingOption &&
			(chartType !== this.lastOptionState.chartType || noLegend !== this.lastOptionState.noLegend)
		) {
			this.applyOption();
		}
		this.lastOptionState = { chartType, noLegend };
	}

	private composeOption(userOption: echarts.EChartsOption): echarts.EChartsOption {
		const base = this.buildBaseOption(userOption);
		const merged = this.mergeOptions(base, userOption);
		this.applyLabelDensity(merged);
		if (this.noLegend) {
			const legend = (merged as { legend?: echarts.EChartsOption['legend'] }).legend;
			if (Array.isArray(legend)) {
				(merged as { legend?: echarts.EChartsOption['legend'] }).legend = legend.map((item) => ({
					...(item as Record<string, any>),
					show: false,
				}));
			} else if (legend && typeof legend === 'object') {
				(merged as { legend?: echarts.EChartsOption['legend'] }).legend = {
					...(legend as Record<string, any>),
					show: false,
				};
			} else {
				(merged as { legend?: echarts.EChartsOption['legend'] }).legend = { show: false };
			}
		}
		return merged;
	}

	private applyLabelDensity(option: echarts.EChartsOption) {
		if (!this.xLabelDensity || !option.xAxis) {
			return;
		}

		const axes = Array.isArray(option.xAxis) ? option.xAxis : [option.xAxis];
		const axisDataLength = this.getAxisDataLength(axes, option.series);
		if (!axisDataLength) {
			return;
		}

		const normalized = Math.max(0.1, Math.min(this.xLabelDensity, 1));
		const density = normalized * 2;
		const labelPx = 90;
		const widthGetter = () =>
			this.chart?.getWidth() ?? this.chartCanvas?.clientWidth ?? this.clientWidth ?? 0;

		const intervalFn = (index: number) => {
			const width = widthGetter();
			const baseLabels = Math.max(2, Math.floor(width / labelPx));
			const targetLabels = Math.max(2, Math.round(baseLabels * density));
			const step = Math.max(1, Math.ceil(axisDataLength / targetLabels));
			return index % step === 0 || index === axisDataLength - 1;
		};

		axes.forEach((axis) => {
			if ((axis as { type?: string }).type === 'category' || !(axis as { type?: string }).type) {
				const axisLabel = (axis as { axisLabel?: Record<string, unknown> }).axisLabel ?? {};
				(axis as { axisLabel?: Record<string, unknown> }).axisLabel = {
					...axisLabel,
					interval: intervalFn,
					showMaxLabel: true,
					showMinLabel: true,
					hideOverlap: true,
				};
			}
		});
	}

	private getAxisDataLength(
		axes: echarts.EChartsOption['xAxis'] extends Array<infer T> ? T[] : never[],
		series: echarts.EChartsOption['series']
	) {
		for (const axis of axes) {
			const data = (axis as { data?: unknown[] }).data;
			if (Array.isArray(data) && data.length) {
				return data.length;
			}
		}
		if (Array.isArray(series) && series.length) {
			const firstSeries = series[0] as { data?: unknown[] };
			if (Array.isArray(firstSeries?.data)) {
				return firstSeries.data.length;
			}
		}
		return 0;
	}

	private buildBaseOption(userOption: echarts.EChartsOption): echarts.EChartsOption {
		const colors = this.getThemeColors();
		const showLegend = !this.noLegend;
		const isCartesian = this.isCartesianChart(userOption);
		const tooltipBase = {
			backgroundColor: colors.tooltipBg,
			borderColor: colors.accent,
			borderWidth: 1,
			textStyle: { color: colors.tooltipText },
		};
		const tooltip: echarts.TooltipComponentOption =
			this.chartType === 'stacked-bar' || isCartesian
				? {
						...tooltipBase,
						trigger: 'axis',
						axisPointer: this.chartType === 'stacked-bar' ? ({ type: 'shadow' } as const) : undefined,
				  }
				: tooltipBase;

		const base: echarts.EChartsOption = {
			backgroundColor: 'transparent',
			color: [colors.accent, colors.accentLight, colors.blue, colors.green, colors.orange],
			textStyle: {
				color: colors.text,
				fontFamily: colors.fontFamily,
			},
			tooltip,
			legend: {
				show: showLegend,
				type: 'scroll',
				top: 0,
				left: 'left',
				textStyle: { color: colors.muted },
				selectedMode: true,
			},
		};

		const typedOption = userOption as {
			xAxis?: echarts.EChartsOption['xAxis'];
			yAxis?: echarts.EChartsOption['yAxis'];
		};

		if (typedOption.xAxis) {
			base.xAxis = this.applyAxisDefaults(typedOption.xAxis, colors);
		}
		if (typedOption.yAxis) {
			base.yAxis = this.applyAxisDefaults(typedOption.yAxis, colors);
		}
		if (isCartesian) {
			base.grid = {
				left: 48,
				right: 20,
				top: showLegend ? 46 : 30,
				bottom: 40,
				containLabel: true,
			};
		}

		return base;
	}

	private applyAxisDefaults(
		axis:
			| echarts.XAXisComponentOption
			| echarts.YAXisComponentOption
			| echarts.XAXisComponentOption[]
			| echarts.YAXisComponentOption[],
		colors: ReturnType<typeof AtlasChart.prototype.getThemeColors>
	) {
		const base = {
			axisLine: { lineStyle: { color: colors.line } },
			axisLabel: { color: colors.muted },
			splitLine: { lineStyle: { color: colors.line } },
		};
		if (Array.isArray(axis)) {
			return axis.map(() => ({ ...base }));
		}
		return { ...base };
	}

	private isCartesianChart(option: echarts.EChartsOption): boolean {
		if (this.chartType) {
			return ['stacked-bar', 'bar', 'line', 'area'].includes(this.chartType);
		}
		const series = (option as { series?: echarts.SeriesOption | echarts.SeriesOption[] }).series;
		const list = Array.isArray(series) ? series : series ? [series] : [];
		return list.some((s) => {
			const type = (s as { type?: string }).type;
			return type === 'bar' || type === 'line' || type === 'scatter' || type === 'area';
		});
	}

	private mergeOptions<T extends Record<string, any>>(base: T, override: T): T {
		const output: Record<string, any> = { ...base };
		Object.entries(override).forEach(([key, value]) => {
			if (Array.isArray(value)) {
				const baseValue = output[key];
				if (Array.isArray(baseValue)) {
					output[key] = value.map((entry, index) => {
						const baseEntry = baseValue[index];
						if (this.isPlainObject(baseEntry) && this.isPlainObject(entry)) {
							return this.mergeOptions(baseEntry, entry);
						}
						return entry;
					});
				} else {
					output[key] = value.slice();
				}
				return;
			}
			if (this.isPlainObject(value)) {
				const baseValue = output[key];
				output[key] = this.isPlainObject(baseValue)
					? this.mergeOptions(baseValue, value)
					: this.mergeOptions({}, value);
				return;
			}
			output[key] = value;
		});
		return output as T;
	}

	private isPlainObject(value: unknown): value is Record<string, any> {
		return !!value && typeof value === 'object' && value.constructor === Object;
	}

	private updateDescription() {
		if (!this.descriptionEl || !this.descriptionWrap) {
			return;
		}
		const hasSlot = (this.descriptionSlot?.assignedElements({ flatten: true }).length ?? 0) > 0;
		const hasText = !!this.description;
		this.descriptionEl.textContent = hasSlot ? '' : this.description;
		this.descriptionEl.toggleAttribute('hidden', hasSlot || !hasText);
		this.descriptionWrap.toggleAttribute('hidden', !hasSlot && !hasText);
		this.requestResize();
	}

	private updateInfoVisibility() {
		const hasInfo = (this.infoSlot?.assignedElements({ flatten: true }).length ?? 0) > 0;
		const showInfo = !!hasInfo;
		if (this.infoButton) {
			this.infoButton.hidden = !showInfo;
		}
		if (!showInfo) {
			this.setInfoOpen(false);
		}
		this.requestResize();
	}

	private bindInfoEvents() {
		this.infoButton?.addEventListener('click', this.onInfoToggle);
		this.infoClose?.addEventListener('click', this.onInfoClose);
		document.addEventListener('click', this.onDocumentClick, true);
		document.addEventListener('keydown', this.onDocumentKeydown);
	}

	private unbindInfoEvents() {
		this.infoButton?.removeEventListener('click', this.onInfoToggle);
		this.infoClose?.removeEventListener('click', this.onInfoClose);
		document.removeEventListener('click', this.onDocumentClick, true);
		document.removeEventListener('keydown', this.onDocumentKeydown);
	}

	private onInfoToggle = () => {
		this.setInfoOpen(!this.infoOpen);
	};

	private onInfoClose = () => {
		this.setInfoOpen(false);
	};

	private onDocumentKeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			this.setInfoOpen(false);
		}
	};

	private onDocumentClick = (event: MouseEvent) => {
		if (!this.infoOpen || !this.infoPopover || !this.infoButton) {
			return;
		}
		const path = event.composedPath();
		if (path.includes(this.infoPopover) || path.includes(this.infoButton)) {
			return;
		}
		this.setInfoOpen(false);
	};

	private setInfoOpen(open: boolean) {
		this.infoOpen = open;
		if (this.infoPopover) {
			this.infoPopover.hidden = !open;
		}
		if (this.infoButton) {
			this.infoButton.setAttribute('aria-expanded', String(open));
		}
	}

	private getThemeColors() {
		const styles = getComputedStyle(this);
		return {
			accent: styles.getPropertyValue('--accent').trim() || '#7c3aed',
			accentLight: styles.getPropertyValue('--accent-light').trim() || '#a78bfa',
			text: styles.getPropertyValue('--text').trim() || '#1a1a1a',
			muted: styles.getPropertyValue('--muted').trim() || '#5a5a5a',
			line: styles.getPropertyValue('--line').trim() || '#e5e7eb',
			fontFamily: styles.fontFamily || 'sans-serif',
			tooltipBg: '#ffffff',
			tooltipText: '#111111',
			blue: '#3b82f6',
			green: '#22c55e',
			orange: '#f59e0b',
		};
	}
}

export function registerAtlasChart() {
	if (!customElements.get('atlas-chart')) {
		customElements.define('atlas-chart', AtlasChart);
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'atlas-chart': AtlasChart;
	}
}
