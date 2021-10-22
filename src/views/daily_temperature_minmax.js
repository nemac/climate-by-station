import View from "./view_base.js";
import {get_threshold_data} from "../io";
import _ from "lodash-es";

export default class DailyTemperatureMinMax extends View {

		async request_update() {

				if(this.parent.daily_values === null) {
						this.parent._show_spinner();
						let data = await (await get_threshold_data(this.parent.options)).data;
						this.parent.daily_values = this.get_daily_values(data);
						this.parent._hide_spinner();
				}

				let years = [];
				let min = [];
				let max = [];
				let days = [];

				this.parent.daily_values.forEach(e => {
						if(e.valid) {
								let year = e.day.slice(0, 4);
								if(!years.includes(Number.parseInt(year))) {
										years.push(Number.parseInt(year));
								}
								days.push(e.day);
								min.push(e.min);
								max.push(e.max);
						}
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

				let chart_data = [{
						mode: "lines",
						x: days,
						y: min,
						name: "Minimum Daily Temperature"
				},
						{
						mode: "lines",
						x: days,
						y: max,
						name: "Maximum Daily Temperature"
				}
				]

				Plotly.react(this.element, chart_data, chart_layout, {modeBarButtonsToRemove: ['toImage', 'lasso2d', 'select2d', 'resetScale2d']});
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
				// console.log(data);

				// return _.mapValues(_.fromPairs(data), (value, value1, value2) => {
				// 		console.log(value, value1, value2);
				// 		let valid = this.parent.validator(value);
				// 		return {value: valid ? Number.parseFloat(this.parent._get_value(value)) : Number.NaN, valid: valid}
				// })

		}


}
