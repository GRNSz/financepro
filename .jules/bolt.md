## 2024-05-18 - Avoid native Date parsing inside large loops
**Learning:** Parsing dates via `new Date(string + 'T00:00:00')` inside `forEach` loops over many transactions (e.g., `S.transactions`) becomes a major performance bottleneck for large datasets (O(N) or O(N*M)).
**Action:** Use fast string operations like `startsWith` when querying for specific months/years in 'YYYY-MM-DD' formatted date strings, and use Map aggregations with string keys (e.g., `substring(0, 7)`) instead of nested loops.
