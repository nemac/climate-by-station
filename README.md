## Climate By Station

This tool is a refactor of the <strong>jQuery Interactive Timeline Exceedance Module</strong> created by FernLeaft Interactive.

Original Repo: https://github.com/fernleafinteractive/item

## Key Differences

The original Timeline Exceedance Module calculated the validity of a years worth of data by checking
whether at least 293 days (80%) had valid data. In the new Module the validity is calculated by determining if <= 2 days of precipitation data or <= 5 days of temperature data is invalid in a given year.
