# Sources

Everything was downloaded on 24 September 2026, except the map's centroids, fetched on 28 September 2026. Files in `data/sources` are
committed as downloaded or, where noted, as the one table taken from a larger
file. Files too large to commit are listed with their SHA-256 so a fresh
download can be checked against the one used here.

## Committed

| File | Publisher and title | Address | SHA-256 |
|---|---|---|---|
| `data/sources/CTSOP1_1_2025_03_31.csv` | VOA, Council Tax: stock of properties, 2025, table CTSOP1.1 (homes by band, every area level), taken from `CTSOP1.1.zip` | https://assets.publishing.service.gov.uk/media/6a0ad444c75cc34a8ff8f397/CTSOP1.1.zip | `a8091b22f018d63443546fbda522150ff5f2fc2c339b8f6c698e9549f7b62a92` |
| `data/sources/Table_10_2026-27.ods` | MHCLG, Council Tax levels set by local authorities in England 2026 to 2027, Table 10 | https://assets.publishing.service.gov.uk/media/6a02eeeccd2e0e8b5b20b449/Table_10_2026-27.ods | `b5b8345743fb722e48699243d1654a3e35b96c89a14c6eb26888035c3e38feb0` |
| `data/sources/2025_Local_Authority_Drop_Down.xlsx` | MHCLG, Council Taxbase 2025 in England, local authority level data | https://assets.publishing.service.gov.uk/media/696f605ff6aa424b452e3359/2025_Local_Authority_Drop_Down.xlsx | `9fd74444f25278b53f7666dc23ff060d1996adcfe27e74caf63aef2b5b19af06` |
| `data/sources/hpssa46_median_by_lsoa.csv` | ONS, House price statistics for small areas, dataset 46: median price paid by LSOA, sheet 1a, four periods taken by `scripts/extract_hpssa.py` | https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/housing/datasets/medianpricepaidbylowerlayersuperoutputareahpssadataset46/current/hpssadataset46medianpricepaidforresidentialpropertiesbylsoa.zip | `85b492a66b03591e10432734f352c22f8189968c19480e1144807a3507dbbf61` |
| `data/sources/lsoa21_pwc.csv` | ONS, Lower layer Super Output Areas (December 2021) population-weighted centroids, V4, fetched page by page by `scripts/fetch_centroids.py` on 28 September 2026 | https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LSOA_PopCentroids_EW_2021_V4/FeatureServer/0 | `99b1c993582a20b32a4fff19abd47ddd68f5031cb635ce248e60337b34486a7f` |

## Too large to commit

Read once by `scripts/build_prices.py`, which writes the small files in
`data/derived` and records these checksums in `data/derived/MANIFEST.json`.

| File | Publisher and title | Address | SHA-256 |
|---|---|---|---|
| `pp-2020.csv` | HM Land Registry, Price Paid Data, 2020 | http://prod.publicdata.landregistry.gov.uk.s3-website-eu-west-1.amazonaws.com/pp-2020.csv | `8e75657aa9bb3d527e852726cf031805330361e1d81d64cab5379a5f6ece4177` |
| `pp-2021.csv` | as above, 2021 | .../pp-2021.csv | `64464a336e5cf38244e3e92cd1786280c9226d4c40cb1b55a36eb8baf5f528fa` |
| `pp-2022.csv` | as above, 2022 | .../pp-2022.csv | `1c6ed604089b95db4cffaa76f384f325f55b19c6fed54e485ebdd587f537cd7c` |
| `pp-2023.csv` | as above, 2023 | .../pp-2023.csv | `b5df7249b00201fe0a8d9ce42aabd1526a6a9ca79d2cd66eefd9d4a9f3a36478` |
| `pp-2025.csv` | as above, 2025 | .../pp-2025.csv | `00031f353d91cec625ad2212dd2f436eb77fc31e0776d5bf17fe4587fc4e0c24` |
| `nspl_may_2026.zip` | ONS, National Statistics Postcode Lookup, May 2026 | https://www.arcgis.com/sharing/rest/content/items/7668e0d35cab4f6db6f15f03be610fb0/data | `e0ccd5b3d90fdb537c29afc85b33c6c7ff8647e89e390f2e9ae48530f85f42c1` |
| `CTSOP1.1.zip` | VOA stock of properties, the archive the CSV above came from | as above | `e1979a4196e23207489a6e049ddb10197cd127ab775be5828ee662743fe4fbe7` |
| `hpssa46.zip` | ONS HPSSA dataset 46, the archive the CSV above came from | as above | `bcd46de2f2176df4c147dcb85daf681f6aa694c49b44ea9fe76e63b982a7704d` |

## Sales used

Category A sales (standard sales at market value) with deleted records
dropped, placed in 2021 LSOAs by postcode:

| Period | Category A sales | Placed in an area | Postcode not in the lookup |
|---|---:|---:|---:|
| 2020 | 753,243 | 753,093 | 150 |
| 2021 | 1,086,854 | 1,086,634 | 220 |
| April 2021 to March 2022 | 998,978 | 998,801 | 177 |
| April 2022 to March 2023 | 873,041 | 872,966 | 75 |
| 2025 | 794,895 | 794,690 | 205 |

The four earlier periods exist only to check the rebuild against the ONS. The
analysis uses 2025.

## Used by the app at run time

- **postcodes.io** (https://postcodes.io), an open postcode lookup built on
  the ONS postcode directory. The app sends the postcode a reader types and
  reads back `codes.lsoa21` and `codes.admin_district`. Nothing else is sent.

## Traps, and what was done about them

- **Two sets of small areas.** HPSSA 46 uses 2011 LSOAs; everything else here
  uses 2021 LSOAs. Most codes did not change. The price check compares only
  areas whose code exists in both (32,454 of them for 2020), never a mapped
  one. The Land Registry covers Wales too, so Welsh areas are in the price
  check, though not in the analysis.
- **Barnsley and Sheffield.** Both took new council codes after a boundary
  change (E08000038 and E08000039). The VOA table still uses the old ones
  (E08000016 and E08000019). `verify.RECODED` maps them, in one place.
- **Suppressed bands.** The VOA prints "-" for one to four homes and rounds
  every other count to the nearest ten. See the README for how "-" is counted
  and how much that choice matters.
- **Table 10's four precept columns.** Line 16 appears four times, once each
  for county, police, fire and combined authority charges. The loader insists
  on finding exactly four and adds them.
- **The latest ONS small-area prices.** HPSSA 46's latest release covers the
  year to March 2023, which is why 2025 prices are rebuilt from the Land
  Registry rather than taken from the ONS.

## Licences

VOA, MHCLG and ONS data: Open Government Licence v3.0. HM Land Registry Price
Paid Data: Open Government Licence v3.0; contains HM Land Registry data ©
Crown copyright and database right 2026. The postcode lookup contains OS data
© Crown copyright and database right 2026, Royal Mail data © Royal Mail
copyright and database right 2026, and National Statistics data © Crown
copyright and database right 2026.
The centroids contain OS data © Crown copyright and database right 2021,
under the same licence.
