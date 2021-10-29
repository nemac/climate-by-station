import View from "./view_base.js";
import {get_data} from "../io.js";
import _ from "../../node_modules/lodash-es/lodash.js";
import {format_export_data} from "../utils.js";

export default class DailyPrecipitationAbsolute extends View {

		async request_update() {

				const options = this.parent.options;

				const threshold = options.threshold;

				if(options.daily_values === null) {
						this.parent._show_spinner();
						const data = await (await get_data(options, this.parent.variables)).data;
						options.daily_values = this.get_daily_values(data);

						const normal_options = {
								station: options.station,
								sdate: (new Date().getFullYear() - 4) + '-01-01',
								edate: (new Date().getFullYear()) + '-12-31',
								variable: options.variable + "_normal",
								dataAPIEndpoint: 'https://data.rcc-acis.org/'
						}

						const normal_data = await(await get_data(normal_options, this.parent.variables)).data;
						options.normal_values = this.get_daily_values(normal_data);

						this.parent._hide_spinner();
				}

				const daily_values = options.daily_values;
				const daily_values_entries = Object.entries(daily_values);

				const normal_values = options.normal_values;
				const normal_entries = Object.entries(normal_values);

				let years = [];
				let days = [];
				let values = [];
				let normals = [];
				let download_data = [];

				daily_values_entries.forEach((e, i) => {

						let year = e[0].slice(0, 4);
						if(!years.includes(Number.parseInt(year))) {
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
				for(let i = diff_days; i >= 0; i--) {
						normals[i] = normal_entries[counter][1].value;
						download_data[i] = [days[i], values[i], normal_entries[counter][1].value];

						counter--;

						if(counter < 0) {
								counter = normal_entries.length - 1;
						}
				}

				this._download_callbacks = {
						daily_precipitation_absolute: async() => format_export_data(['day', 'precipitation', 'normal_value'], download_data, null, null)
				}

				const chart_layout = {
						xaxis: this._get_x_axis_layout(years),
						yaxis: this._get_y_axis_layout(),
						legend: {
								"orientation": "h"
						},
						annotations: [
								{
										x: 1,
										y: threshold,
										xref: 'paper',
										yref: 'y',
										text: `Threshold of ${options.variable === 'precipitation' ? options.threshold + " inches" : options.threshold + " °F"}`,
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
								name: "Daily Precipitation Values in Inches",
								mode: 'lines',
								line: {
										color: 'rgb(84,155,198)',
										width: 1
								}
						},
						{
								x: days,
								y: normals,
								name: "Daily Precipitation Normal Values in Inches",
								mode: 'lines',
								line: {
										color: 'rgb(171,221,164)',
										width: 1
								}
						},
						{
								name: "Threshold in Inches",
								x: [years[0], years[years.length - 1]],
								y: [threshold, threshold],
								type: "scatter",
								mode: "lines",
								fill: 'none',
								connectgaps: false,
								visible: true,
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
								text:"Daily Precipitation Values in Inches",
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
										let {width, height} = window.getComputedStyle(this.element);
										width = Number.parseFloat(width) * 1.2;
										height = Number.parseFloat(height) * 1.2;
										return await Plotly.toImage(this.element, {
												format: 'png', width: width, height: height
										});
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
