import View from "./view_base.js";
import {fetch_acis_station_data} from "../io.js";
import _ from "../../node_modules/lodash-es/lodash.js";
import {format_export_data, get_percentile_value} from "../utils.js";

export default class DailyTemperatureHistogram extends View {

	async request_update() {

		const options = this.parent.options;

		let daily_values = this.parent.get_daily_values(options.station, options.variable, false);
		if (daily_values === null) {
			this.parent._show_spinner();
			// create a promise for data and set it on parent.daily_values so that it gets cached.
			daily_values = this.parent.set_daily_values(options.station, options.variable, false,fetch_acis_station_data(options, this.parent.variables[options.variable].acis_elements).then(a=>a.data).then(this.get_daily_values.bind(this)))
		}
		// unwrap/await daily values if they are promises.
		if (typeof daily_values === "object" && typeof daily_values.then === "function"){
			this.parent._show_spinner();
			daily_values = await daily_values
		}
		this.parent._hide_spinner();

		if (options.threshold === null && options.threshold_percentile !== null && options.threshold_percentile >= 0) {
			options.threshold = get_percentile_value(options.threshold_percentile, daily_values);
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

			if (v[0].value > 0)
				days.push(v[0]);
			values.push(v[1].value);
		}

		this._download_callbacks = {
			daily_temperature_histogram: async () => format_export_data(['day', 'temperature'], this.get_download_data(daily_values_entries), null, null)
		}

		let por = "NaN"
		try{
			por = `${daily_values_entries[0][0].slice(0,4)}–${daily_values_entries[daily_values_entries.length - 1][0].slice(0,4).slice(0,4)}`
		}
		catch (ex){
			// do nothing
		}

		const chart_layout = {
			xaxis: this._get_x_axis_layout(),
			yaxis: this._get_y_axis_layout(),
			showlegend: false,
			legend: {
				"orientation": "h"
			},
			bargap: 0.05,
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
					visible: options.threshold !== null
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
				name: "Daily temperature data",
				x: values,
				type: 'histogram',
				nbinsx: 17,
				hovertemplate: `Bin range: %{x}<br>Events between ${por}: %{y}`
			},
			{
				mode: "lines",
				showlegend: false,
				x: [options.threshold, options.threshold],
				y: [0, 1],
				yaxis: 'y2',
				hovertemplate: 'x %{x}, y y%{y}',
				line: {
					color: 'rgb(0,0,0)',
					width: 1
				}
			}
		]

		Plotly.react(this.element, chart_data, chart_layout, {displaylogo: false, modeBarButtonsToRemove: ['toImage', 'lasso2d', 'select2d', 'resetScale2d']});

		this._click_handler = (data) => {
			options.threshold = data.points[0].x;
			const update = {
				x: [[options.threshold, options.threshold]],
				y: [[0, 1]]
			}

				window.setTimeout((() => {
						this.parent.element.dispatchEvent(new CustomEvent('threshold_changed', {detail: options}));
				}).bind(this));

			Plotly.update(this.element, update, {}, [1]);
		}

		// https://stackoverflow.com/questions/60678586/update-x-and-y-values-of-a-trace-using-plotly-update
		this.element.on('plotly_click', this._click_handler);

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

	_get_x_axis_layout() {
		return {
			title: {
				text: "Daily temperature (°F)",
				font: {
					size: 12
				}
			}
		}
	}

	_get_y_axis_layout() {
		return {
			title: {
					text: "Number of events",
					font: {
							size: 12
					}
			}
		}
	}

	async request_downloads() {
		const {station, variable} = this.parent.options;
		return [
			{
				label: 'Daily Temperature Histogram',
				icon: 'bar-chart',
				attribution: 'ACIS: livneh',
				when_data: this._download_callbacks['daily_temperature_histogram'],
				filename: [
					station,
					"daily_temperature_histogram",
					variable
				].join('-').replace(/ /g, '_') + '.csv'
			},
			{
				label: 'Chart image',
				icon: 'picture-o',
				attribution: 'ACIS: Livneh & LOCA (CMIP 5)',
				when_data: async () => {
					let {width, height} = window.getComputedStyle(this.element);
					width = Number.parseFloat(width) * 1.2;
					height = Number.parseFloat(height) * 1.2;
					return await Plotly.toImage(this.element, {
						format: 'png', width: width, height: height
					});
				},
				filename: [
					station,
					"daily_temperature_histogram",
				  variable,
					"graph"
				].join('-').replace(/[^A-Za-z0-9\-]/g, '_') + '.png'
			},
		]
	}

	destroy() {
		super.destroy();
		this.element.removeListener('plotly_click', this._click_handler);
		this._click_handler = null;
	}

}
