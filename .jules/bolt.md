## 2024-05-19 - Fast Date Filtering in Large Loops
**Learning:** Parsing `Date` objects in JavaScript inside loops for large collections of transactions is very slow and can cause performance issues in this application due to the number of `parseLocalDate` calls.
**Action:** Use fast string comparison/slicing on 'YYYY-MM-DD' formatted date strings (e.g., using `String.startsWith()` or `String.substring()`) for basic year/month filtering to significantly improve performance.
