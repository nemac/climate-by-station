
export async function get_threshold_data(options) {
		const url = options.dataAPIEndpoint + "StnData";

		const response = await (await fetch(url, {
				method: "POST",
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({
						"sdate": options.sdate,
						"edate": options.sdate,
						"elems": options.variables[options.variable].elements,
						"sid": "USC00094429" //options.station
				})
		})).json();

		return response;
}

