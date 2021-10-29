import View from "./view_base.js";
import {get_data} from "../io";
import _ from "lodash-es";
import {format_export_data} from "../utils";

export default class DailyTemperatureMinMax extends View {

		async request_update() {

				const options = this.parent.options;

				if(options.daily_values === null) {
						this.parent._show_spinner();
						let data = await (await get_data(options, this.parent.variables)).data;
						options.daily_values = this.get_daily_values(data);

						const normal_options = {
								station: options.station,
								sdate: (new Date().getFullYear() - 4) + '-01-01',
								edate: (new Date().getFullYear()) + '-12-31',
								variable: "temp_min_max_normal",
								dataAPIEndpoint: 'https://data.rcc-acis.org/'
						}

						const normal_data = await(await get_data(normal_options, this.parent.variables)).data;
						options.normal_values = this.get_daily_values(normal_data);

						this.parent._hide_spinner();
				}

				const daily_values = options.daily_values;

				const normal_values = options.normal_values;
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
						if(!years.includes(Number.parseInt(year))) {
								years.push(Number.parseInt(year));
						}

						if(!e.valid) {
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
				for(let i = diff_days; i >= 0; i--) {
						normal_min[i] = normal_entries[counter][1].min;
						normal_max[i] = normal_entries[counter][1].max;
						download_data[i] = [days[i], min[i], (max[i] + min[i]), normal_entries[counter][1].min, normal_entries[counter][1].max];
						counter--;

						if(counter < 0) {
								counter = normal_entries.length - 1;
						}
				}

				this._download_callbacks = {
						daily_temperature_minmax: async() => format_export_data(['day', 'minimum', 'maximum', 'normal_minimum', 'normal_maximum'], download_data, null, null)
				}

				const chart_layout = {
						xaxis: this._get_x_axis_layout(years),
						yaxis: this._get_y_axis_layout(),
						legend: {
								"orientation": "h"
						}
				}

				let chart_data = [
						{
								mode: "lines",
								x: days,
								y: normal_min,
								line: {
									color: 'transparent'
								},
								legendgroup: 'normal_band',
								name: "Normal Minimum and Maximum Values in °F"
						},
						{
								type: "bar",
								x: days,
								y: max,
								base: min,
								hovertemplate: 'Min: %{base} Max: %{y}',
								marker: {
										color: 'rgb(50,136,189)'
								},
								name: "Daily Minimum and Maximum Values in °F"
						},
						{
								mode: "lines",
								x: days,
								y: normal_max,
								fill: 'tonexty',
								fillcolor: 'rgba(171,221,164, 0.5)',
								line: {
									color: 'transparent'
								},
								legendgroup: 'normal_band',
								name: 'Normal Minimum and Maximum Values in °F',
								showlegend: false
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
						range: [(x_axis_range[x_axis_range.length - 1] - 30) + "-01-01", (x_axis_range[x_axis_range.length - 1]) + "-01-01"],
						linecolor: "#828282"
				}
		}

		_get_y_axis_layout() {
				return {
						title: {
								text:"Daily Minimum and Maximum Temperature Values in °F",
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
								label: 'Daily Temperature Minimum and Maximum',
								icon: 'bar-chart',
								attribution: 'ACIS: livneh',
								when_data: this._download_callbacks['daily_temperature_minmax'],
								filename: [
										station,
										"daily_temperature_minmax"
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
										"daily_temperature_minmax",
										"graph"
								].join('-').replace(/[^A-Za-z0-9\-]/g, '_') + '.png'
						},
				]
		}

}
