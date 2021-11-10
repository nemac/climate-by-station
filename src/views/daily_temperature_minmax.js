import View from "./view_base.js";
import {fetch_acis_station_data} from "../io";
import _ from "lodash-es";
import {format_export_data, get_percentile_value} from "../utils";

export default class DailyTemperatureMinMax extends View {

	async request_update() {

		const options = this.parent.options;

		let daily_values = this.parent.get_daily_values(options.station, "temp_min_max", false);

		if (daily_values === null) {
			this.parent._show_spinner();

			// create a promise for data and set it on parent.daily_values so that it gets cached.
			daily_values = this.parent.set_daily_values(options.station, "temp_min_max", false, fetch_acis_station_data(options, [...this.parent.variables['tmin'].acis_elements, ...this.parent.variables['tmax'].acis_elements]).then(a=>a.data).then(this.get_daily_values.bind(this)))
		}

		let normal_values = this.parent.get_daily_values(options.station, "temp_min_max", true);
		if (normal_values === null) {
			this.parent._show_spinner();
			// create a promise for data and set it on parent.daily_values so that it gets cached.
			normal_values = this.parent.set_daily_values(options.station, "temp_min_max", true, fetch_acis_station_data({
				station: options.station,
				sdate: (new Date().getFullYear() - 4) + '-01-01',
				edate: (new Date().getFullYear()) + '-12-31',
				data_api_endpoint: 'https://data.rcc-acis.org/'
			}, [...this.parent.variables['tmin_normal'].acis_elements, ...this.parent.variables['tmax_normal'].acis_elements]).then(a=>a.data).then(this.get_daily_values.bind(this)))
		}

		// unwrap/await daily values if they are promises.
		if ((typeof daily_values === "object" && typeof daily_values.then === "function") || (typeof normal_values === "object" && typeof normal_values.then === "function")){
			this.parent._show_spinner();
			[daily_values, normal_values] = await Promise.all([
				(typeof daily_values === "object" && typeof daily_values.then === "function") ? daily_values : Promise.resolve(daily_values),
				(typeof normal_values === "object" && typeof normal_values.then === "function") ? normal_values : Promise.resolve(normal_values)
			])
		}

		this.parent._hide_spinner();

		// if (options.threshold === null && options.threshold_percentile > 0) {
		// 	options.threshold = get_percentile_value(options.threshold_percentile, daily_values);
		// }
		const normal_entries = Object.entries(normal_values);

		let years = [];
		let min = [];
		let max = [];
		let days = [];
		let normal_min = [];
		let normal_max = [];
		let download_data = [];

		daily_values.forEach(e => {

			let year = e.day.slice(0, 4);
			if (!years.includes(Number.parseInt(year))) {
				years.push(Number.parseInt(year));
			}

			if (!e.valid) {
				days.push(e.day);
				min.push(Number.NaN);
				max.push(Number.NaN);
				return;
			}

			days.push(e.day);
			min.push(e.min);

			/*
			Since the min value will be the base of the bar graph, we need to subtract the max by min to get the
			correct height of the bar.
			*/
			max.push(e.max - e.min);

		})

		const diff_days = this.parent.days_between(days[0], normal_entries[normal_entries.length - 1][1].day);
		let counter = normal_entries.length - 1;
		for (let i = diff_days; i >= 0; i--) {
			normal_min[i] = normal_entries[counter][1].min;
			normal_max[i] = normal_entries[counter][1].max;
			download_data[i] = [days[i], min[i], (max[i] + min[i]), normal_entries[counter][1].min, normal_entries[counter][1].max];
			counter--;

			if (counter < 0) {
				counter = normal_entries.length - 1;
			}
		}

		this._download_callbacks = {
			daily_temperature_minmax: async () => format_export_data(['day', 'minimum', 'maximum', 'normal_minimum', 'normal_maximum'], download_data, null, null)
		}

		const chart_layout = {
			xaxis: this._get_x_axis_layout(years),
			yaxis: this._get_y_axis_layout(),
			yaxis2: {
				type: 'linear',
				matches: 'y',
				overlaying: 'y',
				showline: false,
				showgrid: false,
				showticklabels: false,
				nticks: 0
			},
			autosize: true,
			legend: {
				"orientation": "h"
			},
			bargap: 0.05
		}

		let chart_data = [

			{
				mode: "lines",
				x: days,
				y: normal_min,
				fill: 'none',
				line: {
					color: 'transparent'
				},
				legendgroup: 'normal_band',
				showlegend: false,
				name: "Normal min / max temperature"
			},
			{
				mode: "lines",
				x: days,
				y: normal_max,
				fill: 'tonexty',
				fillcolor: '#abdda4',
				line: {
					color: 'transparent'
				},
				legendgroup: 'normal_band',
				name: 'Normal min / max temperature',
			},

			{
				type: "bar",
				x: days,
				y: max,
				yaxis: 'y2',
				base: min,
				hovertemplate: 'Min: %{base} Max: %{y}',
				marker: {
					color: 'rgba(50, 136, 189, 0.95)'

				},
				name: "Observed min / max temperature"
			}
		]

		Plotly.react(this.element, chart_data, chart_layout, {displaylogo: false, modeBarButtonsToRemove: ['toImage', 'lasso2d', 'select2d', 'resetScale2d']});
	}

	get_daily_values(data) {

		return data.map(d => {
			return {
				day: d[0],
				valid: this.parent.validator(d[1]) && this.parent.validator(d[2]),
				min: Number.parseFloat(d[1]),
				max: Number.parseFloat(d[2])
			}
		})

	}

	_get_x_axis_layout(x_axis_range) {
		return {
			range: [(x_axis_range[x_axis_range.length - 1] - 12) + "-01-01", (x_axis_range[x_axis_range.length - 1]) + "-01-01"],
			linecolor: "#828282"
		}
	}

	_get_y_axis_layout() {
		return {
			title: {
				text: "Daily min / max temperature (°F)",
				font: {
					size: 12
				}
			}
		}
	}

	async request_downloads() {
		const {station} = this.parent.options;
		return [
			{
				label: 'Daily min / max temperature',
				icon: 'bar-chart',
				attribution: 'ACIS: GHCN-D',
				when_data: this._download_callbacks['daily_temperature_minmax'],
				filename: [
					station,
					"daily_temperature_minmax"
				].join('-').replace(/ /g, '_') + '.csv'
			},
			{
				label: 'Chart image',
				icon: 'picture-o',
				attribution: 'ACIS: GHCN-D',
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
					"daily_temperature_minmax",
					"graph"
				].join('-').replace(/[^A-Za-z0-9\-]/g, '_') + '.png'
			},
		]
	}

}
