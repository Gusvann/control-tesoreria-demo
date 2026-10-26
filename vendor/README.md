# SheetJS Community Edition

The Excel importer uses the unmodified, locally hosted **SheetJS CE 0.20.3 mini build**.
The application does not request the vendor CDN when importing a user's file.

| Local file | Official source | SHA-256 |
| --- | --- | --- |
| `xlsx-0.20.3.mini.min.js` | https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.mini.min.js | `0cb353f830d7288385492c83d277b058ddeac664ca51cf1393aa1fd3e2b70939` |
| `SHEETJS-LICENSE.txt` | https://cdn.sheetjs.com/xlsx-0.20.3/package/LICENSE | `4d2a38ac35cda06a555c84074a819d413339cd3691b822cae50f8f322fe01f64` |

Downloaded on 2026-10-26. The mini script is 279,523 bytes and the license is 11,355 bytes.
SheetJS CE is licensed under Apache-2.0; the complete license and copyright notice
are retained in `SHEETJS-LICENSE.txt` and in the original script header.

Primary references:

- Installation and vendoring: https://docs.sheetjs.com/docs/getting-started/installation/standalone/
- Parse options: https://docs.sheetjs.com/docs/api/parse-options/
- Dates and the 1900/1904 systems: https://docs.sheetjs.com/docs/csf/features/dates/
- Local workers: https://docs.sheetjs.com/docs/demos/bigdata/worker/
- Security advisories: https://cdn.sheetjs.com/advisories/
- ZIP format: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT

Do not substitute the older npm `xlsx` package. Update the fixed version, tests,
source URL, license and digest together when reviewing a future upgrade.
