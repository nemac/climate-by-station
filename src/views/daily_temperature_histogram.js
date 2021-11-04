import View from "./view_base.js";
import {get_data} from "../io.js";
import _ from "../../node_modules/lodash-es/lodash.js";
import {format_export_data} from "../utils.js";

export default class DailyTemperatureHistogram extends View {

		async request_update() {

				const options = this.parent.options;

				const threshold = options.threshold;

				if(options.daily_values === null) {
						this.parent._show_spinner();
						const data = await (await get_data(options, this.parent.variables)).data;
						options.daily_values = this.get_daily_values(data);

						this.parent._hide_spinner();
				}

				const daily_values = options.daily_values;
				const daily_values_entries = Object.entries(daily_values);

				let years = [];
				let days = [];
				let values = [];
				let download_data = [];

				daily_values_entries.forEach((e, i) => {

						let year = e[0].slice(0, 4);
						if(!years.includes(Number.parseInt(year))) {
								years.push(Number.parseInt(year));
						}

						if(e[0].value > 0)

								days.push(e[0]);
						values.push(e[1].value);
				});

				this._download_callbacks = {
						daily_temperature_histogram: async() => format_export_data(['day', 'precipitation', 'normal_value'], values, null, null)
				}

				const chart_layout = {
						xaxis: this._get_x_axis_layout(),
						yaxis: this._get_y_axis_layout(),
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
										x: threshold,
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
						]
				}

				let chart_data = [
						{
								name: "Daily temperature data",
								x: values,
								type: 'histogram',
								nbinsx: 17,
								hovertemplate: 'Bin range: (%{x})<br>Count: %{y}'
						},
						{
								mode: "lines",
								x: [threshold, threshold],
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

						Plotly.update(this.element, update, {}, [1]);
				}

				// https://stackoverflow.com/questions/60678586/update-x-and-y-values-of-a-trace-using-plotly-update
				this.element.on('plotly_click', this._click_handler);

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
								text:"Daily temperature (°F)",
								font: {
										size: 12
								}
						}
				}
		}

		_get_y_axis_layout() {
				return {
						// type: 'log'
				}
		}

		async request_downloads() {
				const {station} = this.parent.options;
				return [
						{
								label: 'Daily Temperature Histogram',
								icon: 'bar-chart',
								attribution: 'ACIS: livneh',
								when_data: this._download_callbacks['daily_temperature_histogram'],
								filename: [
										station,
										"daily_temperature_histogram",
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

		destroy() {
				super.destroy();
				this.element.removeListener('plotly_click', this._click_handler);
		}

}
