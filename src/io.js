
export async function get_threshold_data(options) {
		const url = options.dataAPIEndpoint + "StnData";

		console.log(options);

		const response = await (await fetch(url, {
				method: "POST",
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({
						"sdate": options.sdate,
						"edate": options.sdate,
						"elems": options.variables[options.variable].elements,
						"sid": options.station //options.station
				})
		})).json();

		return response;
}

