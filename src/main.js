import ThresholdView from "./views/annual_exceedance.js";

export default class ClimateByStationWidget {

		constructor(element, options = {}) {
				this.options = {
						station: 'USC00094429',
						sdate: 'por',
						edate: (new Date().getFullYear()) + '-12-31',
						variable: 'precipitation',
						threshold: 1.0,
						window: 1,
						window_behaviour: 'rollingSum',
						thresholdOperator: '>',
						dataAPIEndpoint: 'https://data.rcc-acis.org/',
						variables: {
								precipitation: {
										elements: [{"name": "pcpn", "units": "inch"}]
								},
								tmax: {
										elements: [{"name": "maxt", "units": "degreeF"}]
								},
								tmin: {
										elements: [{"name": "mint", "units": "degreeF"}]
								},
								tavg: {
										elements: [{"name": "avgt", "units": "degreeF"}]
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

				this.spinner_styles = [
						".climatebystation-spinner { border: 2px solid #e3e3e3;  border-top: 2px solid #6e6e6e; border-radius: 50%; width: 2rem; height: 2rem; animation: spin 2s linear infinite;}",
						"@keyframes spin { 0% {transform: rotate(0deg);} 100% { transform: rotate(360deg); } }"
				]

				this.spinner_element.innerHTML = `
					<style>${this.spinner_styles.join('')}</style>
					<div class="climatebystation-spinner"></div>
				`

				this.element.append(this.spinner_element);


				this.update({});
		}

		get_view_class() {
			return ThresholdView;
		}

		update(options) {

				if(options) {
						let updated_options = Object.keys(options);

						for(const val in updated_options) {
								let key = updated_options[val];
								let updated_value = options[key];

								if(key === 'variable' || key === 'station') {
										this.daily_values = null;
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
}
