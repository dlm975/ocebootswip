# Oce Boots: product upload rules

When the user sends a shorthand list (and photos) to create products in the Oce Boots Shopify store, follow these rules. They mirror the user's "OCEBOOTS upload builder" artifact (https://claude.ai/artifact/TdNEnPr7dXerKGcyejwCCx) and keep products compatible with the eBay upload builder (https://claude.ai/artifact/Gtt9mYF2XLL4MQEh1xNDbr).

## Shorthand

One product per line: name, US size(s), NZD price, condition (optional, default New). Several sizes (`8,8.5,9`) make one product with a variant per size. Conditions: New, Like New, Lightly Worn, Moderately Worn, Heavily Worn. Ask if a size is not in the chart below; never guess.

## Product fields

- Status: **DRAFT always**. Collections are automated; do not add any.
- Vendor `Oce Boots`. Handle: title in lowercase with dashes + `-DDMMYY` (creation date).
- Options: `Size` (e.g. `US 10 - UK 9 - EU 44`) and `Condition`.
- Every variant: price = NZD base price, 1 in stock, inventory tracked, policy DENY (no overselling), 1 kg, requires shipping, taxable.
- Description (HTML), matching recent listings: `<p><strong>Condition: X.</strong></p>`, a short paragraph on colourway and upper, then a list of style/ART code (only if given), sole configuration, colours, listed sizes and condition, then "The product photos show the exact pair offered. Check the photos and select the listed size and condition before ordering."
- SEO description (`global.description_tag`) filled in.
- Size label image in metafield `custom.custom_actual_size_label` (file_reference). The eBay builder flags products without it.
- Photos sent in chat: match each to its product. The size label/tongue close-up goes in the metafield.

## Size charts

Nike (default): US→UK/EU
4→3.5/36, 4.5→4/36.5, 5→4.5/37.5, 5.5→5/38, 6→5.5/38.5, 6.5→6/39, 7→6/40, 7.5→6.5/40.5, 8→7/41, 8.5→7.5/42, 9→8/42.5, 9.5→8.5/43, 10→9/44, 10.5→9.5/44.5, 11→10/45, 11.5→10.5/45.5, 12→11/46, 12.5→11.5/47, 13→12/47.5, 13.5→12.5/48, 14→13/48.5, 15→14/49.5

Adidas (title contains "adidas"): UK = US − 0.5; EU by UK:
4→36 2/3, 4.5→37 1/3, 5→38, 5.5→38 2/3, 6→39 1/3, 6.5→40, 7→40 2/3, 7.5→41 1/3, 8→42, 8.5→42 2/3, 9→43 1/3, 9.5→44, 10→44 2/3, 10.5→45 1/3, 11→46, 11.5→46 2/3, 12→47 1/3, 12.5→48, 13→48 2/3, 13.5→49 1/3, 14→50

## Market prices (standard for every new or repriced product)

Set fixed prices on each market's price list: price = NZD × factor + fee, rounded **up** to the next .90 (Iceland: up to the next whole number ending in 90). Middle East/Asia and Nigeria get no fixed price (they follow the base price). The user confirmed these rates are current as of Oct 2026.

| Market | Price list ID | Currency | Factor | Fee |
|---|---|---|---|---|
| New Zealand | 30729896247 | NZD | 1 | 19.90 |
| Australia | 30729929015 | AUD | 0.8267 | 20.67 |
| Canada | 34250785079 | CAD | 0.8200 | 36.90 |
| Europe ("International") | 30729961783 | EUR | 0.5130 | 23.09 |
| Germany+ | 38291374391 | EUR | 0.5130 | 35.91 |
| UK | 30730027319 | GBP | 0.4400 | 19.80 |
| USA/MX | 30751260983 | USD | 0.5933 | 35.60 |
| Switzerland | 38291636535 | CHF | 0.48381 | 21.78 |
| Norway | 38291702071 | NOK | 5.52347 | 248.61 |
| Iceland | 38291669303 | ISK | 71.7174 | 3227.98 |
| Poland | 38291603767 | PLN | 2.22734 | 100.25 |
| Sweden | 38291570999 | SEK | 5.78715 | 260.48 |
| Denmark | 38291538231 | DKK | 3.83483 | 268.44 |

Price list IDs are `gid://shopify/PriceList/<id>`. Use `priceListFixedPricesByProductUpdate` when all variants share a price, otherwise `priceListFixedPricesAdd` per variant. Pass large inputs as GraphQL variables (documents are capped at 16,384 characters).

Exception: the "FG/AG Studs for Nike" and "FG/AG Studs for Adidas" listings stay on automatic pricing.
