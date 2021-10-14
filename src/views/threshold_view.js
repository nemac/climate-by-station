import View from "./view_base.js";
import { get_threshold_data } from "../io.js";

export default class ThresholdView extends View {

		constructor(parent, element) {
				super(parent, element);
		}

		async request_update() {

				const {
						station,
						variable,
						window,
						threshold
				} = this.parent.options;

				const response = await (await get_threshold_data(this.parent.options)).data;

				const formatted_data = this.formatted_data(response);
				const rolling_sum = this.rollingSum(formatted_data, window, threshold);

				let x_axis = [];
				let y_axis = [];

				for(let [key, value] of rolling_sum) {
						x_axis.push(key);
						y_axis.push(value);
				}

				let chart_options = {
						type: "bar",
						x: x_axis,
						y: y_axis,
						name: "Yearly Exceedance"
				}

				let chart_layout = {
						xaxis: {
								tickmode: "linear"
						}
				}

				let chart_data = [chart_options]

				Plotly.react(this.element, chart_data, chart_layout);

		}

		rollingSum(formatted_data, window, threshold) {

				let object_keys = Object.keys(formatted_data);

				let map = new Map();

				for(const key in object_keys) {
						let year = object_keys[key];
						let values = formatted_data[year].values;
						let total_sum = 0;

						if(values.length < window) {
								map.set(year, total_sum);
								continue;
						}

						values.forEach((val, index) => {

								if(index >= window) {

										let sum = 0.0;

										for(let i = 0; i < window; i++) {
												let val = this.validator(values[index - i]);
												if(!isNaN(val)) {
														sum += val;
												}
										}

										if(year === "2008") {
												console.log("Year", year, "Sum:", sum);
										}

										if(sum >= threshold) {
												total_sum++;
										}

								}
						})

						map.set(year, total_sum);
				}

				return map;
		}

		formatted_data(data) {
				let formatted_data = data.reduce((acc, curr) => {

						let year = curr[0].slice(0, 4);
						let val = curr[1];

						if(!(year in acc)) {
								acc[year] = {
										values: [],
										missing: 0
								};
						}

						acc[year].values.push(val);

						if(isNaN(this.validator(val))) {
								acc[year].missing++;
						}

						return acc;
				}, {});

				return formatted_data;
		}

		validator(value) {

				if(value === "T") {
						value = 0.0;
				}

				if(isNaN(value)) {
						value = Number.NaN;
				}

				return parseFloat(value);
		}
}

