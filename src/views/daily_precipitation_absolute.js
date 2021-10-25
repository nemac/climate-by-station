import View from "./view_base.js";
import {get_threshold_data} from "../io";
import _ from "lodash-es";

export default class DailyPrecipitationAbsolute extends View {

		async request_update() {

				let variables = this.parent.options.variables;
				let variable = this.parent.options.variable;

				let threshold = this.parent.options.threshold;

				if(variables[variable].data === null) {
						this.parent._show_spinner();
						let data = await (await get_threshold_data(this.parent.options)).data;
						variables[variable].data = this.get_daily_values(data);
						this.parent._hide_spinner();
				}

				const daily_values = variables[variable].data;
				const daily_values_entries = Object.entries(daily_values);

				this.parent.options.variable = 'precipitation_normal';
				this.parent.options.sdate = daily_values_entries[0][0];

				const normal_data = await (await get_threshold_data(this.parent.options)).data;
				const normal_daily_values = this.get_daily_values(normal_data);
				const normal_values_entries = Object.entries(normal_daily_values);

				let years = [];
				let days = [];
				let values = [];
				let normal_values = [];

				daily_values_entries.forEach((e, i) => {

						let year = e[0].slice(0, 4);
						if(!years.includes(Number.parseInt(year))) {
								years.push(Number.parseInt(year));
						}
						days.push(e[0]);
						values.push(e[1].value);
						normal_values.push(normal_values_entries[i][1].value);

				})

				const chart_layout = {
						title: {
								text: "Precipitation"
						},
						xaxis: {
								range: [(years[years.length - 1] - 30) + "-01-01", (years[years.length - 1]) + "-01-01"]
						},
						yaxis: {
								title: {
										text:"Daily Precipitation Values"
								}
						},
						legend: {
								"orientation": "h"
						}
				}

				let chart_data = [
						{
								x: days,
								y: values,
								name: "Daily Precipitation Values",
								mode: 'lines',
								line: {
										color: 'rgb(84,155,198)',
										width: 1
								}
						},
						{
								x: days,
								y: normal_values,
								name: "Daily Precipitation Normal Values",
								mode: 'lines',
								line: {
										color: 'rgb(171,221,164)',
										width: 1
								}
						},
						{
								name: "Threshold",
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


}
