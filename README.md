# jQuery Interactive Timeline Exceedance Module

This widget show threshold exceedance over time for weather stations. It is a proof of concept project that could be later expanded to examine specific regions and more complex variables.


## Usage

1. Include plugin's code:

	```html
	<script src="dist/jquery.fl-item.min.js"></script>
	<link rel="stylesheet" src="dist/fl-item.css" />
	```

2. Call the plugin:

	```javascript
	$("#widget-div").item({
		station: $('#station').val(),
        currentView: 'graph'
	});
	```

# Development

Requires node version 7+

1. Install dev requirements using `npm install --dev` followed by `./node_modules/.bin/jspm install --dev`
2. Run any http server and visit `src/demo.html`, the source will be built in-browser each time the page is reloaded.
3. Run `npm run build` to bundle the project for production.
