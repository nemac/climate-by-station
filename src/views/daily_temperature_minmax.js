import View from "./view_base.js";
import {get_threshold_data} from "../io";
import _ from "lodash-es";

export default class DailyTemperatureMinMax extends View {

		async request_update() {

				let variables = this.parent.options.variables;
				let variable = this.parent.options.variable;

				if(variables[variable].data === null) {
						this.parent._show_spinner();
						let data = await (await get_threshold_data(this.parent.options)).data;
						variables[variable].data = this.get_daily_values(data);
						this.parent._hide_spinner();
				}

				const daily_values = variables[variable].data;

				let years = [];
				let min = [];
				let max = [];
				let days = [];

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

				const chart_layout = {
						title: {
								text: "Temperature Minimum and Maximum"
						},
						xaxis: {
								range: [(years[years.length - 1] - 30) + "-01-01", (years[years.length - 1]) + "-01-01"]
						},
						yaxis: {
								title: {
										text:"Daily Minimum and Maximum Temperature Values"
								}
						},
						legend: {
								"orientation": "h"
						}
				}

				let chart_data = [
						{
								type: "bar",
								x: days,
								y: max,
								base: min,
								hovertemplate: 'Min: %{base} Max: %{y}',
								marker: {
										color: 'rgb(50,136,189)'
								}
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


}
