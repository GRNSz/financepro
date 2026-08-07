## 2024-05-15 - Fast Date Parsing and O(N) Aggregation in Charts
**Learning:** The legacy chart rendering function (`renderMainChart`) iterated over all transactions 12 times and used expensive `new Date()` parsing on ISO format strings. This caused severe O(N*M) scaling issues.
**Action:** Always prefer a single pass O(N) map aggregation. For fixed-format dates (`YYYY-MM-DD`), use string slicing (`substring`) instead of creating `Date` objects when extracting year and month values.
