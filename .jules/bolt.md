## 2025-02-27 - [Avoid parsing Dates in loops]
**Learning:** Parsing native Date objects inside tight loops (like `S.transactions.forEach`) adds massive overhead, creating significant bottlenecks (especially in nested O(N*M) structures like chart aggregations).
**Action:** Use single O(N) pass map aggregations leveraging fast string prefix matching (e.g., `substring(0, 7)` for `YYYY-MM`) over pre-formatted ISO date strings whenever possible.
