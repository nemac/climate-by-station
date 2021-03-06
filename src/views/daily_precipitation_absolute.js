import View from "./view_base.js";
import {fetch_acis_station_data} from "../io.js";
import _, {cloneDeep} from "../../node_modules/lodash-es/lodash.js";
import {format_export_data, get_percentile_value} from "../utils.js";

export default class DailyPrecipitationAbsolute extends View {

	async request_update() {

		const options = this.parent.options;

		let daily_values = this.parent.get_daily_values(options.station, options.variable, false);

		if (daily_values === null) {
			this.parent._show_spinner();
			// create a promise for data and set it on parent.daily_values so that it gets cached.
			daily_values = this.parent.set_daily_values(options.station, options.variable, false, fetch_acis_station_data(options, this.parent.variables[options.variable].acis_elements).then(a => a.data).then(this.get_daily_values.bind(this)))
		}

		let normal_values = this.parent.get_daily_values(options.station, options.variable, true);
		if (normal_values === null) {
			this.parent._show_spinner();
			// create a promise for data and set it on parent.daily_values so that it gets cached.
			normal_values = this.parent.set_daily_values(options.station, options.variable, true, fetch_acis_station_data({
				station: options.station,
				sdate: (new Date().getFullYear() - 4) + '-01-01',
				edate: (new Date().getFullYear()) + '-12-31',
				data_api_endpoint: 'https://data.rcc-acis.org/'
			}, this.parent.variables[options.variable + "_normal"].acis_elements).then(a => a.data).then(this.get_daily_values.bind(this)))
		}

		// unwrap/await daily values if they are promises.
		if ((typeof daily_values === "object" && typeof daily_values.then === "function") || (typeof normal_values === "object" && typeof normal_values.then === "function")) {
			this.parent._show_spinner();
			[daily_values, normal_values] = await Promise.all([
				(typeof daily_values === "object" && typeof daily_values.then === "function") ? daily_values : Promise.resolve(daily_values),
				(typeof normal_values === "object" && typeof normal_values.then === "function") ? normal_values : Promise.resolve(normal_values)
			])
		}

		this.parent._hide_spinner();

		if (options.threshold == null && options.threshold_percentile !== null && options.threshold_percentile >= 0) {
			options.threshold = get_percentile_value(options.threshold_percentile, daily_values, true);
		}

		const daily_values_entries = Object.entries(daily_values);
		const normal_entries = Object.entries(normal_values);

		let years = [];
		let days = [];
		let values = [];
		let normals = [];

		daily_values_entries.forEach((e, i) => {

			let year = e[0].slice(0, 4);
			if (!years.includes(Number.parseInt(year))) {
				years.push(Number.parseInt(year));
			}
			days.push(e[0]);
			values.push(e[1].value);
		});

		/*
		Get total number of days between first day of POR and last day of normal day.
		Loop through the normals value and repeat the values for each day of the total
		POR.
		 */
		const diff_days = this.parent.days_between(days[0], normal_entries[normal_entries.length - 1][0]);
		let counter = normal_entries.length - 1;
		for (let i = diff_days; i >= 0; i--) {
			normals[i] = normal_entries[counter][1].value;

			counter--;

			if (counter < 0) {
				counter = normal_entries.length - 1;
			}
		}


		this._download_callbacks = {
			daily_precipitation_absolute: async () => format_export_data(['day', 'precipitation', 'normal_value'], this.get_download_data(days, values, normal_entries), null, null)
		}

			this.parent.options.title = "Daily precipitation (in)";

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
					y: options.threshold,
					xref: 'paper',
					yref: 'y',
					text: `Threshold ${options.variable === 'precipitation' ? options.threshold + " (in)" : options.threshold + " (??F)"}`,
					xanchor: 'right',
					yanchor: 'bottom',
					showarrow: false,
					font: {
						size: 10
					},
					visible: options.threshold !== null
				}
			],
			margin: {
				l: 40,
				r: 20,
				b: 5,
				t: 5
			}
		}

		let chart_data = [
			{
				x: days,
				y: values,
				name: "Daily precipitation",
				mode: 'lines',
				line: {
					color: 'rgb(84,155,198)',
					width: 1
				}
			},
			{
				x: days,
				y: normals,
				name: "Daily precipitation normal",
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
				y: [options.threshold, options.threshold],
				type: "scatter",
				mode: "lines",
				fill: 'none',
				connectgaps: false,
				visible: options.threshold !== null,
				line: {
					color: 'rgb(0,0,0)',
					width: 1
				}
			}
		]

			this.layout = chart_layout;

		Plotly.react(this.element, chart_data, chart_layout, {
				displaylogo: false, modeBarButtonsToRemove: ['toImage', 'lasso2d', 'select2d', 'resetScale2d'],
				responsive: true
		});
	}

	set_threshold(threshold) {
		Plotly.update(this.element, {
			y: [[threshold, threshold]]
		}, {}, [2]);
	}

	get_download_data(days, values, normal_entries) {

		let output = [];
		const diff_days = this.parent.days_between(days[0], normal_entries[normal_entries.length - 1][0]);
		let counter = normal_entries.length - 1;

		for (let i = diff_days; i >= 0; i--) {
			output[i] = [days[i], values[i], normal_entries[counter][1].value];

			counter--;

			if (counter < 0) {
				counter = normal_entries.length - 1;
			}
		}

		return output;
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
				text: this.parent.options.hide_y_axis_title ? '' : "Daily precipitation (in)",
				font: {
					size: 11
				}
			}
		}
	}

	async request_downloads() {
		const {station} = this.parent.options;
		return [
			{
				label: 'Daily Precipitation Absolute',
				icon: 'bar-chart',
				attribution: 'ACIS: livneh',
				when_data: this._download_callbacks['daily_precipitation_absolute'],
				filename: [
					station,
					"daily_precipitation_absolute",
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
					"precipitation",
					"graph"
				].join('-').replace(/[^A-Za-z0-9\-]/g, '_') + '.png'
			},
		]
	}

}
