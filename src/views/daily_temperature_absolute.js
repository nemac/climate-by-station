import View from "./view_base.js";
import {get_threshold_data} from "../io";
import _ from "lodash-es";

export default class DailyTemperatureAbsolute extends View {

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

				let years = [];
				let days = [];
				let values = [];

				Object.entries(daily_values).forEach(e => {

						let year = e[0].slice(0, 4);
						if(!years.includes(Number.parseInt(year))) {
								years.push(Number.parseInt(year));
						}
						days.push(e[0]);
						values.push(e[1].value);

				})

				const chart_layout = {
						title: {
								text: "Temperature"
						},
						xaxis: {
								range: [(years[years.length - 1] - 30) + "-01-01", (years[years.length - 1]) + "-01-01"]
						},
						yaxis: {
								title: {
										text:"Daily Temperature Values"
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
								name: "Daily Temperature Values",
								mode: "lines",
								line: {
										color: 'rgb(50,136,189)',
										width: 0.5
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
