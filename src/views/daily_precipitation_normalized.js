import View from "./view_base.js";
import {fetch_acis_station_data} from "../io";
import _ from "lodash-es";
import {format_export_data, get_percentile_value} from "../utils";

export default class DailyPrecipitationNormalized extends View {

	async request_update() {

		const options = this.parent.options;


		let daily_values = this.parent.get_daily_values(options.station, options.variable, false);

		if (daily_values === null) {
			this.parent._show_spinner();
			// create a promise for data and set it on parent.daily_values so that it gets cached.
			daily_values = this.parent.set_daily_values(options.station, options.variable, false,fetch_acis_station_data(options, this.parent.variables[options.variable].acis_elements).then(a => a.data).then(this.get_daily_values.bind(this)))
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


		if (options.threshold === null && options.threshold_percentile > 0) {
			options.threshold = get_percentile_value(options.threshold_percentile, this.parent.daily_values, true);
		}

		const daily_values_entries = Object.entries(daily_values);
		const normal_entries = Object.entries(normal_values);

		let years = [];
		let days = [];
		let values = [];
		let download_data = [];

		daily_values_entries.forEach(e => {

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
			values[i] = values[i] - normal_entries[counter][1].value;
			download_data[i] = [days[i], values[i]];

			counter--;

			if (counter < 0) {
				counter = normal_entries.length - 1;
			}
		}

		this._download_callbacks = {
			daily_precipitation_normalized: async () => format_export_data(['day', 'normalized_precipitation'], download_data, null, 1)
		}

		const chart_layout = {
			xaxis: {
				range: [(years[years.length - 1] - 30) + "-01-01", (years[years.length - 1]) + "-01-01"]
			},
			yaxis: {
				title: {
					text: "Daily precipitation normalized values (in)"
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
				name: "Daily precipitation normalized",
				mode: 'lines',
				line: {
					color: 'rgb(84,155,198)',
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

	async request_downloads() {
		const {station, variable} = this.parent.options;
		return [
			{
				label: 'Daily Precipitation Normalized',
				icon: 'bar-chart',
				attribution: 'ACIS: livneh',
				when_data: this._download_callbacks['daily_precipitation_normalized'],
				filename: [
					station,
					"daily_precipitation_normalized",
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
					"daily_precipitation_normalized",
					"graph"
				].join('-').replace(/[^A-Za-z0-9\-]/g, '_') + '.png'
			},
		]
	}


}
