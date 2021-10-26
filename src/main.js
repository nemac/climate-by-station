import AnnualExceedance from "./views/annual_exceedance.js";
import DailyPrecipitationAbsolute from "./views/daily_precipitation_absolute.js";
import DailyTemperatureAbsolute from "./views/daily_temperature_absolute";
import DailyTemperatureMinMax from "./views/daily_temperature_minmax";

export default class ClimateByStationWidget {

		constructor(element, options) {
				this.options = {
						view_type: 'annual_exceedance',
						station: 'USC00094429',
						sdate: 'por',
						edate: (new Date().getFullYear()) + '-12-31',
						variable: 'precipitation',
						threshold: 1.0,
						window: 1,
						window_behaviour: 'rollingSum',
						thresholdOperator: '>=',
						dataAPIEndpoint: 'https://data.rcc-acis.org/',
						variables: {
								precipitation: {
										elements: [{"name": "pcpn", "units": "inch"}],
										data: null
								},
								precipitation_normal: {
										elements: [{"name": "pcpn", "prec": 1, "normal": "1", "units": "inch"}],
										data: null
								},
								tmax: {
										elements: [{"name": "maxt", "units": "degreeF"}],
										data: null
								},
								tmin: {
										elements: [{"name": "mint", "units": "degreeF"}],
										data: null
								},
								tavg: {
										elements: [{"name": "avgt", "units": "degreeF"}],
										data: null
								},
								temp_min_max: {
										elements: [{"name": "mint", "prec": 1, "units": "degreeF"}, {"name": "maxt", "prec": 1, "units": "degreeF"}],
										data: null
								},
								temp_normal: {
										elements: [{"name": "mint", "prec": 1, "normal": "1", "units": "degreeF"}, {"name": "maxt", "prec": 1, "normal": "1", "units": "degreeF"}],
										data: null
								}
						}
				};

				this.daily_values = null;

				this.view = null;
				this.element = element;

				this.view_container = document.createElement("div");
				this.view_container.classList.add("climate_by_station_view");

				this.element.append(this.view_container);

				this.spinner_element = document.createElement("div");
				this.spinner_element.classList.add("d-none");
				this.spinner_element.classList.add("d-flex");
				this.spinner_element.classList.add("justify-content-center");
				this.spinner_element.classList.add("align-items-center");
				this.spinner_element.classList.add("h-100");

				this.spinner_styles = [
						".climatebystation-spinner { border: 2px solid #e3e3e3;  border-top: 2px solid #6e6e6e; border-radius: 50%; width: 2rem; height: 2rem; animation: spin 2s linear infinite;}",
						"@keyframes spin { 0% {transform: rotate(0deg);} 100% { transform: rotate(360deg); } }"
				]

				this.spinner_element.innerHTML = `
					<style>${this.spinner_styles.join('')}</style>
					<div class="climatebystation-spinner"></div>
				`

				this.element.append(this.spinner_element);

				this.update(options);
		}

		get_view_class() {

				switch(this.options.view_type) {
						case 'annual_exceedance':
								return AnnualExceedance;
								break;
						case 'daily_precipitation_absolute':
								return DailyPrecipitationAbsolute;
								break;
						case 'daily_temperature_absolute':
								return DailyTemperatureAbsolute;
								break;
						case 'daily_temperature_minmax':
								return DailyTemperatureMinMax;
								break;
				}
		}


		update(options) {

				if(options) {
						let updated_options = Object.keys(options);

						for(const val in updated_options) {
								let key = updated_options[val];
								let updated_value = options[key];

								/*
								If the station gets updated all of the graphs need to be re-drawn.
								 */
								if(key === 'station') {
										this.daily_values = null;
								}

								/*
								If the variable gets updated, we only want to change the exceedance
								graph with updated values, the daily values will not change and will
								not need to be re-drawn.
								 */
								if(key === 'variable') {

										if(this.options.view_type === 'annual_exceedance') {
												this.daily_values = null;
										}

										/*
										 For daily temperature, we want to only update the graph if only
										 one of the temp variables are selected. (tmax by default)
										 */
										if(this.options.view_type === 'daily_temperature_absolute') {

												if(updated_value === 'tmax' || updated_value === 'tmin' || updated_value === 'tavg') {
														this.daily_values = null;
												}

										}

								}

								if(this.options.hasOwnProperty(key)) {
										this.options[key] = updated_value;
								}
						}
				}

				this._update();
		}

		async _update() {

				if(this.view === null) {
						this.view = new (this.get_view_class())(this, this.view_container);
				}

				await this.view.request_update();
		}

		_show_spinner() {
				if(this.spinner_element.classList.contains("d-none")) {
						this.spinner_element.classList.remove("d-none");
				}
		}

		_hide_spinner() {
				if(!this.spinner_element.classList.contains("d-none")) {
						this.spinner_element.classList.add("d-none");
				}
		}

		_get_x_axis_layout(x_axis_range) {
				return {
						tickformat: "%Y",
						ticklabelmode: "period",
						type: "date",
						range: [x_axis_range].map(a => a + '-01-01')
				}
		}

		_get_y_axis_layout() {
				return {
						title: {
								text:"Events per Year Above Threshold"
						}
				}
		}


		validator(value) {

				let _value = this._get_value(value);

				return (!isNaN(_value) && Number.isFinite(_value));
		}

		_get_value(value) {
				if(value === "T") {
						value = 0.0;
				}

				value = Number.parseFloat(value);

				return value;
		}
}
