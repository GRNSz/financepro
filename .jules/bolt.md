
## 2024-05-18 - Native Date Object Performance in Loops
**Learning:** Instantiating native `Date` objects inside large arrays (`S.transactions.forEach` / `.filter`) for string-formatted dates like 'YYYY-MM-DD' creates significant garbage collection overhead and slows down processing.
**Action:** Avoid native `Date` parsing when doing month/year aggregation. Instead, use fast string extraction (e.g. `t.date.startsWith("2024-05-")` or `t.date.substring`) which is roughly 10x faster.
