import View from "./view_base.js";
import {fetch_acis_station_data} from "../io.js";
import _ from "../../node_modules/lodash-es/lodash.js";
import {format_export_data, get_percentile_value} from "../utils.js";

export default class DailyPrecipitationYtd extends View {

	async request_update() {

		const options = this.parent.options;


		let daily_values = this.parent.get_daily_values(options.station, options.variable, false);

		if (daily_values === null) {
			this.parent._show_spinner();
			// create a promise for data and set it on parent.daily_values so that it gets cached.
			daily_values = this.parent.set_daily_values(options.station, options.variable, false,fetch_acis_station_data(options, this.parent.variables[options.variable].acis_elements).then(a=>a.data).then(this.get_daily_values.bind(this)))
		}

		let normal_values = this.parent.get_daily_values(options.station, options.variable, true);
		if (normal_values === null) {
			this.parent._show_spinner();
			// create a promise for data and set it on parent.daily_values so that it gets cached.
			normal_values = this.parent.set_daily_values(options.station, options.variable, true,fetch_acis_station_data({
				station: options.station,
				sdate: (new Date().getFullYear() - 4) + '-01-01',
				edate: (new Date().getFullYear()) + '-12-31',
				data_api_endpoint: 'https://data.rcc-acis.org/'
			}, this.parent.variables[options.variable + "_normal"].acis_elements).then(a=>a.data).then(this.get_daily_values.bind(this)))
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


		if (options.threshold === null && options.threshold_percentile !== null && options.threshold_percentile >= 0) {
			options.threshold = get_percentile_value(options.threshold_percentile, daily_values, true);
		}

		const daily_values_entries = Object.entries(daily_values);

		const normal_entries = Object.entries(normal_values);

		let years = [];
		let days = [];
		let values = [];
		let normals = [];
		let download_data = [];

		let prev_year = null;
		let accumulator = 0;

		for (const v of daily_values_entries) {
			let year = v[0].slice(0, 4);

			if (prev_year == null) {
				prev_year = year;
			}
			const value = Number.isFinite(v[1].value) ?  v[1].value : 0;
			if (year === prev_year) {
				accumulator += value;
			} else {
				accumulator = value;
			}

			values.push(accumulator);

			if (!years.includes(Number.parseInt(year))) {
				years.push(Number.parseInt(year));
			}

			days.push(v[0]);

			prev_year = year;

		  download_data.push([v[0], v[1].value]);
		}

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


		let normal_accumulator = 0;
		let _normals = [];
		prev_year = null;

		normals.forEach((e, i) => {
			let year = days[i].slice(0, 4);

			if (prev_year == null) {
				prev_year = year;
			}

			if (year === prev_year) {
				normal_accumulator += normals[i];
			} else {
				normal_accumulator = normals[i];
			}

			_normals.push(normal_accumulator);

			prev_year = year;
		})

		this._download_callbacks = {
			daily_precipitation_ytd: async () => format_export_data(['day', 'precipitation'], download_data, null, null)
		}

		const chart_layout = {
			xaxis: this._get_x_axis_layout(years),
			yaxis: this._get_y_axis_layout(),
			autosize: true,
			legend: {
				"orientation": "h"
			},
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
				fill: 'tozeroy',
				line: {
					color: 'rgb(84,155,198)',
					width: 1
				}
			},
			{
				x: days,
				y: _normals,
				name: "Daily precipitation normal",
				mode: 'lines',
				line: {
					color: 'rgb(1,29,68)',
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
				text: "Daily precipitation (in)",
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
				label: 'Daily Precipitation YTD',
				icon: 'bar-chart',
				attribution: 'ACIS: livneh',
				when_data: this._download_callbacks['daily_precipitation_ytd'],
				filename: [
					station,
					"daily_precipitation_ytd",
					"precipitation"
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
					"daily_precipitation_ytd",
					"graph"
				].join('-').replace(/[^A-Za-z0-9\-]/g, '_') + '.png'
			},
		]
	}

}
