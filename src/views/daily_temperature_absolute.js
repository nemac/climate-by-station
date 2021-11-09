import View from "./view_base.js";
import {fetch_acis_station_data} from "../io";
import _ from "lodash-es";
import {format_export_data, get_percentile_value} from "../utils";

export default class DailyTemperatureAbsolute extends View {

	async request_update() {

		const options = this.parent.options;

		let threshold = options.threshold;

		if (this.parent.daily_values === null) {
			this.parent._show_spinner();


			const [data, normal_data] = await Promise.all([fetch_acis_station_data(options, this.parent.variables[options.variable].acis_elements).then((a) => a.data),
				fetch_acis_station_data({
					station: options.station,
					sdate: (new Date().getFullYear() - 4) + '-01-01',
					edate: (new Date().getFullYear()) + '-12-31',
					data_api_endpoint: 'https://data.rcc-acis.org/'
				}, this.parent.variables[options.variable + "_normal"].acis_elements).then((a) => a.data)
			])
			this.parent.daily_values = this.get_daily_values(data);

			this.parent.normal_values = this.get_daily_values(normal_data);

			this.parent._hide_spinner();
		}

		if (options.threshold === null && options.threshold_percentile > 0) {
			options.threshold = get_percentile_value(options.threshold_percentile, this.parent.daily_values);
		}

		const daily_values = this.parent.daily_values;

		const normal_values = this.parent.normal_values;
		const normal_entries = Object.entries(normal_values);

		let years = [];
		let days = [];
		let values = [];
		let normals = [];
		let download_data = [];

		Object.entries(daily_values).forEach(e => {

			let year = e[0].slice(0, 4);
			if (!years.includes(Number.parseInt(year))) {
				years.push(Number.parseInt(year));
			}
			days.push(e[0]);
			values.push(e[1].value);

		})

		const diff_days = this.parent.days_between(days[0], normal_entries[normal_entries.length - 1][0]);
		let counter = normal_entries.length - 1;
		for (let i = diff_days; i >= 0; i--) {
			normals[i] = normal_entries[counter][1].value;
			download_data[i] = [days[i], values[i], normal_entries[counter][1].value];

			counter--;

			if (counter < 0) {
				counter = normal_entries.length - 1;
			}
		}

		this._download_callbacks = {
			daily_temperature_absolute: async () => format_export_data(['day', options.variable, 'normal_value'], download_data, null, null)
		}

		const chart_layout = {
			xaxis: this._get_x_axis_layout(years),
			yaxis: this._get_y_axis_layout(),
			legend: {
				"orientation": "h"
			},
			autosize: true,
			annotations: [
				{
					x: 1,
					y: threshold,
					xref: 'paper',
					yref: 'y',
					text: `Threshold ${options.variable === 'precipitation' ? options.threshold + " (in)" : options.threshold + " (°F)"}`,
					xanchor: 'right',
					yanchor: 'bottom',
					showarrow: false,
					font: {
						size: 10
					},
					visible: true
				}
			]
		}

		let chart_data = [
			{
				x: days,
				y: values,
				name: "Daily temperature",
				mode: "lines",
				line: {
					color: 'rgb(50,136,189)',
					width: 0.5
				}
			},
			{
				x: days,
				y: normals,
				name: "Daily temperature normal",
				mode: 'lines',
				line: {
					color: 'rgb(171,221,164)',
					width: 1
				}
			},
			{
				name: "Threshold",
				showlegend: false,
				x: [years[0], years[years.length - 1]],
				y: [threshold, threshold],
				mode: "lines",
				line: {
					color: 'rgb(0,0,0)',
					width: 1
				}
			}
		]

		Plotly.react(this.element, chart_data, chart_layout, {displaylogo: false, modeBarButtonsToRemove: ['toImage', 'lasso2d', 'select2d', 'resetScale2d']});
	}

	get_daily_values(data) {

		return _.mapValues(_.fromPairs(data), (value) => {
			let valid = this.parent.validator(value);
			return {value: valid ? Number.parseFloat(this.parent._get_value(value)) : Number.NaN, valid: valid}
		})

	}

	_get_x_axis_layout(x_axis_range) {
		return {
			range: [(x_axis_range[x_axis_range.length - 1] - 30) + "-01-01", (x_axis_range[x_axis_range.length - 1]) + "-01-01"],
			linecolor: "#828282"
		}
	}

	_get_y_axis_layout() {
		return {
			title: {
				text: "Daily temperature (°F)",
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
				label: 'Daily Temperature Absolute',
				icon: 'bar-chart',
				attribution: 'ACIS: livneh',
				when_data: this._download_callbacks['daily_temperature_absolute'],
				filename: [
					station,
					"daily_temperature_absolute",
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
					variable,
					"graph"
				].join('-').replace(/[^A-Za-z0-9\-]/g, '_') + '.png'
			},
		]
	}


}
