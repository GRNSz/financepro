## 2024-05-24 - Replace native Date parsing with string slicing in loops
**Learning:** Native `Date` parsing within large loops is a significant performance anti-pattern. `new Date(string)` is notoriously slow in JavaScript.
**Action:** When aggregating records by year/month from ISO date strings, use string slicing (`substring`) instead of creating `Date` objects to achieve much faster O(N) processing.
