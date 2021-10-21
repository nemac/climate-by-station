import View from "./view_base.js";
import {get_threshold_data} from "../io";
import _ from "lodash-es";

export default class DailyTemperatureAbsolute extends View {

		async request_update() {

				if(this.parent.daily_values === null) {
						this.parent._show_spinner();
						let data = await (await get_threshold_data(this.parent.options)).data;
						this.parent.daily_values = this.get_daily_values(data);
						this.parent._hide_spinner();
				}

				let years = [];
				let days = [];
				let daily_values = [];

				Object.entries(this.parent.daily_values).forEach(e => {
						// console.log(e);
						if(e[1].valid) {
								let year = e[0].slice(0, 4);
								if(!years.includes(Number.parseInt(year))) {
										years.push(Number.parseInt(year));
								}
								days.push(e[0]);
								daily_values.push(e[1].value);
						}
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
						},
						shapes: [{
								type: 'line',
								x0: (years[years.length - 1] - 30) + "-01-01",
								y0: this.parent.options.threshold,
								x1: (years[years.length - 1]) + "-01-01",
								y1: this.parent.options.threshold
						}]
				}

				let chart_data = [{
						type: "bar",
						x: days,
						y: daily_values,
						name: "Yearly Exceedance"
					}
				]

				Plotly.react(this.element, chart_data, chart_layout, {modeBarButtonsToRemove: ['toImage', 'lasso2d', 'select2d', 'resetScale2d']});
		}

		get_daily_values(data) {

				return _.mapValues(_.fromPairs(data), (value) => {
						let valid = this.parent.validator(value);
						return {value: valid ? Number.parseFloat(this.parent._get_value(value)) : Number.NaN, valid: valid}
				})

		}


}
