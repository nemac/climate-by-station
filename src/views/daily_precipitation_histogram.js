import View from "./view_base.js";
import {fetch_acis_station_data} from "../io.js";
import _, {cloneDeep} from "../../node_modules/lodash-es/lodash.js";
import {format_export_data, get_percentile_value} from "../utils.js";

export default class DailyPrecipitationHistogram extends View {

	async request_update() {
		const options = this.parent.options;

		this.parent._show_spinner();
		//this.element.removeEventListener('plotly_click', this._click_handler);
		let daily_values = this.parent.get_daily_values(options.station, options.variable, false);
		if (daily_values === null) {

			// create a promise for data and set it on parent.daily_values so that it gets cached.
			daily_values = this.parent.set_daily_values(options.station, options.variable, false, fetch_acis_station_data(options, this.parent.variables[options.variable].acis_elements).then(a => a.data).then(this.get_daily_values.bind(this)))
		}
		// unwrap/await daily values if they are promises.
		if (typeof daily_values === "object" && typeof daily_values.then === "function") {
			daily_values = await daily_values
		}

		if (options.threshold === null && options.threshold_percentile !== null && options.threshold_percentile >= 0) {
			options.threshold = get_percentile_value(options.threshold_percentile, daily_values, true);
		}

		const daily_values_entries = Object.entries(daily_values);

		let years = [];
		let days = [];
		let values = [];

		for (const v of daily_values_entries) {
			let year = v[0].slice(0, 4);
			if (!years.includes(Number.parseInt(year))) {
				years.push(Number.parseInt(year));
			}

			days.push(v[0]);
			values.push(v[1].value);
		}

		this._download_callbacks = {
			daily_precipitation_histogram: async () => format_export_data(['day', 'precipitation'], this.get_download_data(daily_values_entries), null, null)
		}

		let por = `NaN`
		try {
			por = `${daily_values_entries[0][0].slice(0, 4)}–${daily_values_entries[daily_values_entries.length - 1][0].slice(0, 4).slice(0, 4)}`
		} catch (ex) {
			// do nothing
		}

			this.parent.options.title = "Number of events";

		const chart_layout = {
			xaxis: this._get_x_axis_layout(),
			yaxis: this._get_y_axis_layout(),
			showlegend: false,
			legend: {
				"orientation": "h"
			},
			bargap: 0.05,
			autosize: true,
			yaxis2: {
				type: 'linear',
				overlaying: 'y',
				autorange: false,
				range: [0, 1],
				zeroline: false,
				showticklabels: false
			},
			annotations: [
				{
					x: options.threshold,
					y: 1,
					xref: 'x',
					yref: 'paper',
					text: `Threshold ${options.variable === 'precipitation' ? options.threshold + " (in)" : options.threshold + " (°F)"}`,
					xanchor: 'left',
					yanchor: 'top',
					showarrow: false,
					font: {
						size: 10
					},
					visible: true
				}
			],
			margin: {
				l: 50,
				r: 20,
				b: 35,
				t: 5
			}
		}

		let chart_data = [
			{
				name: "Daily precipitation data",
				x: values,
				type: 'histogram',
				nbinsx: 17,
				hovertemplate: `Bin range: %{x}<br>Events between ${por}: %{y}`
			},
			{
				mode: "lines",
				x: [options.threshold, options.threshold],
				y: [0, 1],
				yaxis: 'y2',
				showlegend: false,
				line: {
					color: 'rgb(0,0,0)',
					width: 1
				},
				visible: options.threshold !== null
			}
		]

			this.layout = chart_layout;

		Plotly.react(this.element, chart_data, chart_layout, {
				displaylogo: false, modeBarButtonsToRemove: ['toImage', 'lasso2d', 'select2d', 'resetScale2d', 'zoom2d', 'pan2d', 'zoomin2d', 'zoomout2d', 'autoScale2d'],
				responsive: true
		});

		this.parent._hide_spinner();

		if (!this._click_listener) {
			this._click_listener = this.element.on('plotly_click', this._click_handler.bind(this));
		}

			if(!this._hover_listener) {
					this._hover_listener = this.element.on('plotly_hover', this._hover_handler.bind(this));
			}

			if(!this._unhover_listener) {
					this._unhover_listener = this.element.on('plotly_unhover', this._unhover_handler.bind(this));
			}
	}

	set_threshold(threshold){
		Plotly.update(this.element, {
			x: [[threshold, threshold]],
			y: [[0, 1]]
		}, {}, [1]);
	}

	get_download_data(daily_values_entries) {

		let output = [];

		for (const v of daily_values_entries) {
			output.push([v[0], v[1].value]);
		}

		return output;
	}

	get_daily_values(data) {

		return _.mapValues(_.fromPairs(data), (value) => {
			let valid = this.parent.validator(value);
			return {value: valid ? Number.parseFloat(this.parent._get_value(value)) : Number.NaN, valid: valid}
		})

	}

	_click_handler(data) {
		const threshold = data.points[0].x;
		if (threshold === null) return;
		window.setTimeout((() => {
				this.parent.element.dispatchEvent(new CustomEvent('threshold_changed', {detail: threshold}));
			}).bind(this));
	}

		_hover_handler(data) {
				const dragLayer = this.element.getElementsByClassName('nsewdrag')[0];
				dragLayer.style.cursor = 'pointer';
		}

		_unhover_handler(data) {
				const dragLayer = this.element.getElementsByClassName('nsewdrag')[0];
				dragLayer.style.cursor = 'default';
		}

	_get_x_axis_layout() {
		return {
			title: {
				text: "Daily precipitation (in)",
				font: {
					size: 11
				}
			},
			fixedrange: true
		}
	}

	_get_y_axis_layout() {
		return {
			type: 'log',
			exponentformat: 'B', // https://plotly.com/javascript/reference/histogram/#histogram-marker-colorbar-exponentformat
			dtick: 'tick0', // https://plotly.com/javascript/reference/histogram/#histogram-marker-colorbar-dtick
			autorange: true,
			title: {
				text: this.parent.options.hide_y_axis_title ? '' : "Number of events",
				font: {
					size: 11
				}
			},
			fixedrange: true
		}
	}

	async request_downloads() {
		const {station} = this.parent.options;
		return [
			{
				label: 'Daily Precipitation Histogram',
				icon: 'bar-chart',
				attribution: 'ACIS: livneh',
				when_data: this._download_callbacks['daily_precipitation_histogram'],
				filename: [
					station,
					"daily_precipitation_histogram",
					"precipitation"
				].join('-').replace(/ /g, '_') + '.csv'
			},
			{
				label: 'Chart image',
				icon: 'picture-o',
				attribution: 'ACIS: Livneh & LOCA (CMIP 5)',
				when_data: async () => {
						const width = 1440;
						const height = 720;

						const old_layout = cloneDeep(this.layout);

						old_layout.title = ""

						const temp_layout = cloneDeep(this.layout);

						temp_layout.title = cloneDeep(temp_layout.yaxis.title)
						temp_layout.title.text = `<b>${this.parent.options.title}</b>`
						temp_layout.title.x = 0.015;
						temp_layout.title.font = {
								// family: this.options.font === null ? "Roboto" : this.options.font,
								size: 18,
								color: '#124086'
						}
						temp_layout.yaxis.title.text = "";
						temp_layout.margin = {
								l: 50,
								t: 50,
								r: 50,
								b: 50
						}

						await Plotly.relayout(this.element, temp_layout);

						const result = await Plotly.toImage(this.element, {
								format: 'png', width: width, height: height
						});

						await Plotly.relayout(this.element, old_layout);

						return result;
				},
				filename: [
					station,
					"daily_precipitation_histogram",
					"graph"
				].join('-').replace(/[^A-Za-z0-9\-]/g, '_') + '.png'
			},
		]
	}

	destroy() {
		super.destroy();
			this.element.removeListener('plotly_click', this._click_handler.bind(this));
			this.element.removeListener('plotly_hover', this._hover_handler.bind(this));
			this.element.removeListener('plotly_unhover', this._unhover_handler.bind(this));
			this._click_listener = null;
			this._hover_handler = null;
			this._unhover_handler = null;
	}
}
