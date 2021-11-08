
export async function get_data(options, variables) {
		const url = options.data_api_endpoint + "StnData";

		const response = await (await fetch(url, {
				method: "POST",
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({
						"sdate": options.sdate,
						"edate": options.edate,
						"elems": variables[options.variable].elements,
						"sid": options.station
				})
		})).json();

		return response;
}

