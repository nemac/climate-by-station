import ThresholdView from "./views/threshold_view.js";

export default class ClimateByStationWidget {

		constructor(element, options = {}) {
				this.options = {
						station: '',
						sdate: 'por',
						edate: (new Date().getFullYear()) + '-12-31',
						variable: 'precipitation',
						threshold: 1.0,
						window: 1,
						thresholdOperator: '>',
						dataAPIEndpoint: 'https://data.rcc-acis.org/',
						variables: {
								precipitation: {
										elements: [{"name": "pcpn"}]
								},
								tmax: {
										elements: [{"name": "maxt"}]
								},
								tmin: {
										elements: [{"name": "mint"}]
								},
								tavg: {
										elements: [{"name": "avgt"}]
								}
						}
				};

				this.daily_values = null;

				this.view = null;
				this.element = element;

				this.view_container = document.createElement("div");
				this.view_container.classList.add("climate_by_station_view");

				this.element.append(this.view_container);

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

								if(key === 'variable') {
										this.daily_values = null;
								}

								if(this.options[key]) {
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

		_get_x_axis_layout(x_axis_range) {
				return {
						tickformat: "%Y",
						ticklabelmode: "period",
						type: "date",
						range: [x_axis_range].map(a => a + '-01-01')
				}
		}
}
