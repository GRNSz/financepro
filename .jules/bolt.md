## 2024-05-14 - Fast Date Checking
**Learning:** Parsing `Date` objects in loops on `app.js` (using `parseLocalDate(t.date)`) where the date is in 'YYYY-MM-DD' format is a major bottleneck. Using string operations `substring(0, 7)` to compare against `YYYY-MM` or using `parseInt` on string slices to extract year/month/date is 2.5x to 10x faster.
**Action:** Avoid `new Date()` or `parseLocalDate` inside loops like `S.transactions.forEach` for year/month matching. Use fast string slicing (`substring`) instead.
