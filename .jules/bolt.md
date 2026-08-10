## 2024-11-21 - Optimize Date parsing in renderMainChart
**Learning:** Parsing native `Date` objects inside loops (O(N*M)) for chart grouping (`parseLocalDate`) is a significant performance bottleneck.
**Action:** Use fast string operations like `substring` on 'YYYY-MM-DD' formatted dates to build an O(N) aggregation map before looping over chart labels.