## Climate By Station

This tool is a refactor of the <strong>jQuery Interactive Timeline Exceedance Module</strong> created by FernLeaft Interactive.

Original Repo: https://github.com/fernleafinteractive/item

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
* 🚧 daily_temperature_absolute
* 🔲 daily_temperature_normalized
* 🔲 daily_temperature_minmax
* 🔲 daily_histogram
* 🔲 annual_exceedance_summary (the semantic digest view)
