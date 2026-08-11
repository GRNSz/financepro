## 2023-10-27 - Fast Date Aggregation
**Learning:** Parsing native `Date` objects inside large loops for 'YYYY-MM-DD' formatted dates causes significant performance bottlenecks. O(N*M) traversal combined with `parseLocalDate` is very slow.
**Action:** Always prefer O(N) map aggregation using fast string slicing (`substring(0, 7)`) on 'YYYY-MM-DD' dates. Iterate the transactions once, aggregate by `YYYY-MM`, and then map the aggregated data to the required output format.
