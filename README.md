## Climate By Station

This tool is a refactor of the <strong>jQuery Interactive Timeline Exceedance Module</strong> created by FernLeaft Interactive.

Original Repo: https://github.com/fernleafinteractive/item

## Annual Exceedance View

This view shows the number of times in a given day a Climate Station has met the threshold criteria set by the user. Users can change the criteria by selection different variables, operators, and thresholds.
* #### Variables:
	* Precipitation (in Inches)
	* TMax (Maximum Temperature in F)
	* TMin (Minimum Temperature in F)
	*	TAvg (Average Temperature in F)

* #### Operators:
	* at least (>=)
		* The threshold is <strong>at least</strong> the selected Threshold value.
  * no more than (<=)
	  * The threshold is <strong>no more than</strong> the selected Threshold value.

* #### Threshold:
	* A numeric value representing the criteria that a given value must be reached.

## Daily Precipitation View

This view shows the daily precipitation values of the selected Climate Station. The black line represents the Threshold that was selected, or the Threshold calculated by the Percentiles dropdown.

## Daily Temperature View

This view shows the daily temperature values of the selected Climate Station. By default, the graph is using the <strong>Daily Max Values</strong>. The graph view can be changed by selecting a different temperature variable from the Variables dropdown menu.

## Key Differences

The original Timeline Exceedance Module calculated the validity of a years worth of data by checking
whether at least 293 days (80%) had valid data. In the new Module the validity is calculated by determining if <= 2 days of precipitation data or <= 5 days of temperature data is invalid in a given year.

## TODO:
🔲: Not started.
🚧: Work in progress.
☑️: Done, but requires testing.
✅: Completed.
* 🚧 Update frontend UI for the demo to use bootstrap.
* ☑️ annual_exceedance
* ☑️ daily_precipitation_absolute
* 🔲 daily_precipitation_normalized
* 🔲 daily_precipitation_ytd
* ☑️ daily_temperature_absolute
* 🔲 daily_temperature_normalized
* 🚧 daily_temperature_minmax
* 🔲 daily_histogram
* 🔲 annual_exceedance_summary (the semantic digest view)
