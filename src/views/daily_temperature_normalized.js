import View from "./view_base.js";
import {fetch_acis_station_data} from "../io";
import _ from "lodash-es";
import {format_export_data, get_percentile_value} from "../utils";

export default class DailyTemperatureNormalized extends View {

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
			values[i] = values[i] - normal_entries[counter][1].value;
			download_data[i] = [days[i], values[i]];

			counter--;

			if (counter < 0) {
				counter = normal_entries.length - 1;
			}
		}

		this._download_callbacks = {
			daily_temperature_normalized: async () => format_export_data(['day', 'normalized_' + options.variable], download_data, null, 1)
		}

		const chart_layout = {
			xaxis: {
				range: [(years[years.length - 1] - 30) + "-01-01", (years[years.length - 1]) + "-01-01"]
			},
			yaxis: {
				title: {
					text: "Daily temperature normalized values (°F)"
				}
			},
			autosize: true,
			legend: {
				"orientation": "h"
			}
		}

		let chart_data = [
			{
				x: days,
				y: values,
				name: "Daily temperature normalized",
				mode: "lines",
				line: {
					color: 'rgb(50,136,189)',
					width: 0.5
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

	async request_downloads() {
		const {station, variable} = this.parent.options;
		return [
			{
				label: 'Daily Temperature Normalized',
				icon: 'bar-chart',
				attribution: 'ACIS: livneh',
				when_data: this._download_callbacks['daily_temperature_normalized'],
				filename: [
					station,
					"daily_temperature_normalized",
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
					"daily_temperature_normalized",
					"graph"
				].join('-').replace(/[^A-Za-z0-9\-]/g, '_') + '.png'
			},
		]
	}

}
