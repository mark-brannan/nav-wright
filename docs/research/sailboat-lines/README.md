# Sailboat lines from published drawings

Realistic sailing-vessel outlines, traced by hand from a published sail-plan
drawing and lofted into 3D. The trace is the data; everything else, these
SVGs and the shipped mesh `models/<id>-lines.glb` (MODELS.md), is
regenerated from it:

```bash
node scripts/sailboat-lines.mjs
```

The playground's vessels page (`npm run dev`, then `/vessels.html`) shows
each mesh in the 3D bearing view beside these drawings.

| Boat                          | Trace                                      | Profile                                        | Plan                                        | Body plan                                       | Loft                                        |
| ----------------------------- | ------------------------------------------ | ---------------------------------------------- | ------------------------------------------- | ----------------------------------------------- | ------------------------------------------- |
| Hans Christian 38T            | [json](hans-christian-38t.json)            | ![](hans-christian-38t-profile.svg)            | ![](hans-christian-38t-plan.svg)            | ![](hans-christian-38t-bodyplan.svg)            | ![](hans-christian-38t-loft.svg)            |
| Com-Pac 16                    | [json](com-pac-16.json)                    | ![](com-pac-16-profile.svg)                    | ![](com-pac-16-plan.svg)                    | ![](com-pac-16-bodyplan.svg)                    | ![](com-pac-16-loft.svg)                    |
| Catalina 30 Mk II             | [json](catalina-30-mkii.json)              | ![](catalina-30-mkii-profile.svg)              | ![](catalina-30-mkii-plan.svg)              | ![](catalina-30-mkii-bodyplan.svg)              | ![](catalina-30-mkii-loft.svg)              |
| Westsail 32                   | [json](westsail-32.json)                   | ![](westsail-32-profile.svg)                   | ![](westsail-32-plan.svg)                   | ![](westsail-32-bodyplan.svg)                   | ![](westsail-32-loft.svg)                   |
| Cheoy Lee Clipper 48 schooner | [json](cheoy-lee-clipper-48-schooner.json) | ![](cheoy-lee-clipper-48-schooner-profile.svg) | ![](cheoy-lee-clipper-48-schooner-plan.svg) | ![](cheoy-lee-clipper-48-schooner-bodyplan.svg) | ![](cheoy-lee-clipper-48-schooner-loft.svg) |
| Wyoming                       | [json](wyoming.json)                       | ![](wyoming-profile.svg)                       | ![](wyoming-plan.svg)                       | ![](wyoming-bodyplan.svg)                       | ![](wyoming-loft.svg)                       |
| Thomas W. Lawson              | [json](thomas-w-lawson.json)               | ![](thomas-w-lawson-profile.svg)               | ![](thomas-w-lawson-plan.svg)               | ![](thomas-w-lawson-bodyplan.svg)               | ![](thomas-w-lawson-loft.svg)               |

## Sources

| Boat                          | Spec page                                                               | Drawing                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hans Christian 38T            | <https://sailboatdata.com/sailboat/hans-christian-38t/>                 | <https://sailboatdata.com/wp-content/uploads/2023/03/hans_christian_38_drawing.jpg>                                                                                                                                                                                                                                                                                                                                                                       |
| Com-Pac 16                    | <https://sailboatdata.com/sailboat/com-pac-16/>                         | <https://sailboatdata.com/wp-content/uploads/2023/03/ComPac_16_drawing.jpeg>                                                                                                                                                                                                                                                                                                                                                                              |
| Catalina 30 Mk II             | <https://sailboatdata.com/sailboat/catalina-30-mkii/>                   | <https://sailboatdata.com/wp-content/uploads/2023/03/catalina_30_mkii_drawing.jpg>                                                                                                                                                                                                                                                                                                                                                                        |
| Westsail 32                   | <https://sailboatdata.com/sailboat/westsail-32/>                        | <https://sailboatdata.com/wp-content/uploads/2023/03/westsail_32_drawing-1.jpg>                                                                                                                                                                                                                                                                                                                                                                           |
| Cheoy Lee Clipper 48 schooner | <https://sailboatdata.com/sailboat/clipper-48-schooner-cheoy-lee/>      | <https://sailboatdata.com/wp-content/uploads/2023/03/cheoy_lee_clipper_48_sch_drawing.jpg>, keel and plan from <https://sailboatdata.com/wp-content/uploads/2023/03/clipper_48_drawing.jpg>                                                                                                                                                                                                                                                               |
| Wyoming                       | <https://maine-maritime-museum-store.myshopify.com/products/wyoming>    | Capt. Douglas K. Lee's 1996 sail plan <https://cdn.shopify.com/s/files/1/0020/7962/1185/products/Wyoming_profile_sail_plan_resize.jpg>; his deck plan <https://cowboystatedaily.imgix.net/Wyoming-schooner-drawing-profile-10.28.23.jpg>; midship section, International Marine Engineering, Jan 1910 <https://archive.org/details/internationalma151910newy>; end stations from the six-master _Mertie B. Crowley_'s lines (Maine Maritime Museum store) |
| Thomas W. Lawson              | <https://archive.org/details/sim_nautical-research-journal_1953-04_5_4> | H. S. Scott's 1953 rigging sheet from the Fore River builder's plans, Nautical Research Journal, Apr 1953, pp. 7–8; deck plan, Marine Engineering, Nov 1902 <https://archive.org/details/marine-engineering_1902-11>; midship section, Marine Engineering, Oct 1901 <https://archive.org/details/marine-engineering_1901-10>; end stations from the _Mertie B. Crowley_                                                                                   |

The drawings are not committed; the json records each URL and the size it had.
sailboatdata.com sits behind Cloudflare: a plain `curl` gets a challenge page.
A browser user agent gets the file, and the spec page then comes back as a
printable PDF:

```bash
curl -sSL --compressed -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" -o drawing.jpg "<drawing url>"
```

## Method

1. **Read the drawing's layout.** sailboatdata drawings put an accommodation
   plan above a sail-plan profile, on one shared x scale. Check it: a point
   both views draw (the bowsprit tip) should have the same x in each.
2. **Calibrate on the profile.** Transom top to stem head is the published
   LOA, which excludes the bowsprit and any stern spar. Where something hangs
   aft of the transom in the outline (an outboard rudder), `profile.loaFromX`
   names the two ends. Check draft, LWL and
   beam against the spec page; they should agree within a few percent.
3. **Trace by hand** off gridded enlargements of the scan, in source pixels:
   the profile outline (sheer, stem, forefoot, keel, rudder, counter), the
   boot-top, the coachroof, the rig as straight lines, and the plan's
   half-breadths about its centreline. A column scan for dark pixels helps
   along clean stretches; rigging crossing the outline defeats it, so the
   reading is by eye.
4. **Write down what is not traced.** Anything inferred goes in the json's
   `notes`, and the plan marks where inference starts.
5. **Loft.** With no lines plan, each section is a rounded canoe body (deck
   half-breadth from the plan, sheer from the profile) down to an assumed
   depth, 40% of draft at its deepest, with the keel below it as a fin
   following the traced profile. The body plan shows the result; that
   assumption is the first thing to change if it looks wrong.

## Hans Christian 38T findings

| Quantity                            | Traced   | Published                                             |
| ----------------------------------- | -------- | ----------------------------------------------------- |
| LOA (calibration)                   | 37.92 ft | 37.92 ft                                              |
| LWL                                 | 33.75 ft | 33.0 ft                                               |
| Beam                                | 12.38 ft | 12.33 ft                                              |
| Draft                               | 6.23 ft  | 6.0 ft                                                |
| Sparred length, boomkin to bowsprit | 47.9 ft  | about 47 ft, measured on hull _Symphony_ by her owner |

- The plan draws a boomkin aft of the transom; the profile does not (its
  backstay lands on the transom top). The boomkin is taken from the plan.
- Forward of the plan's x 455 the drawn outline runs straight on into the
  bowsprit platform; the deck's closure to the stem head is a guess.
- The rig is to scale: masthead about 55 ft above the waterline, 2.3 hull
  half-lengths. The profile drawings in `src/hulls.tsx` keep masts under one
  unit to fit their 440 x 240 viewBox, so this rig does not drop into that
  frame unchanged.

## Range of sizes and forms

| Boat                          | LOA                  | Form                                         | LWL traced / spec                | Beam             | Draft           |
| ----------------------------- | -------------------- | -------------------------------------------- | -------------------------------- | ---------------- | --------------- |
| Com-Pac 16                    | 16.0 ft              | shoal keel, outboard rudder (not traced)     | 14.44 / 14.0 ft                  | 6.48 / 6.0 ft    | 1.72 / 1.5 ft   |
| Catalina 30 Mk II             | 29.92 ft             | fin keel, spade rudder                       | 25.3 / 25.0 ft                   | 10.94 / 10.83 ft | 5.55 / 5.25 ft  |
| Westsail 32                   | 32.0 ft              | double-ender, long keel, transom-hung rudder | 27.1 / 27.5 ft                   | 11.1 / 11.0 ft   | 4.77 / 5.0 ft   |
| Hans Christian 38T            | 37.92 ft             | long keel, cutter                            | 33.75 / 33.0 ft                  | 12.38 / 12.33 ft | 6.23 / 6.0 ft   |
| Cheoy Lee Clipper 48 schooner | 47.92 ft             | long keel, two masts                         | 34.74 / 34.0 ft                  | 13.23 / 13.0 ft  | 6.21 / 6.0 ft   |
| Wyoming                       | 350 ft over the rail | wooden six-masted cargo schooner, 1909       | 322 ft / none published          | 49.97 / 50 ft    | 27.73 / 27.5 ft |
| Thomas W. Lawson              | 403.33 ft            | steel seven-masted cargo schooner, 1902      | 373.08 / 368 ft, rudder included | 50 / 50 ft       | 26.19 / 26.5 ft |

LWL here is the hull body's. The script's printout runs to the lowest point
of any section, so a rudder hung aft stretches it: Catalina 26.63 ft, Westsail
28.96 ft.

- **Com-Pac 16** reads 8% wide and 15% deep. The masthead height agrees with
  the spec within 2.3%, so the scale holds and the drawing itself is fuller
  than the spec sheet. The rudder hangs aft of the transom and is left out.
- **Catalina 30 Mk II** stands in for the Mk I, whose drawing stops at the
  waterline; it is the same hull with a new deck. Its keel is drawn about 6%
  deep, and the rig reads between the standard and tall rigs. Forward of plan
  x 524 the deck closure is a guess.
- **Westsail 32**: the outboard rudder is the outline's aft-most point, so
  `loaFromX` takes LOA from the sternpost head. The upper deck line is the
  bulwark caprail and is not the sheer. The plan is shifted from the profile
  and mapped onto it through the stern and bow points.
- **Cheoy Lee Clipper 48 schooner**: the schooner drawing stops at the
  waterline and has no plan, so keel, rudder and plan come from the ketch
  drawing of the same Luders hull.
- **Wyoming** and **Thomas W. Lawson**, the two largest schooners built, are
  the top of the range. Neither has a sailboatdata page; their drawings are
  period journals, a museum reconstruction and a 1953 rigging sheet. Each is
  lofted from traced stations (`sections`) rather than the canoe-body
  default: her own published midship section, and the six-master _Mertie B.
  Crowley_'s lines fore and aft of it, since no lines plan of either ship is
  free online. Wyoming's are held by Maine Maritime Museum (Lee's set), the
  Lawson's by Royal Museums Greenwich (MSA0301) and Mystic Seaport (12.60).
  - **Wyoming**: 350 ft is length over the rail, reaching onto the knee of
    the head; the carved head forward of it is left out. Lee's drawings and a
    broadside photo space the masts about 47 ft apart against the 1910
    journal's 44 ft 6 in; Lee's spacing is kept. The Crowley's after
    stations tumble home enough to put a 52 ft beam under water, so above
    their widest point they are taken plumb.
  - **Thomas W. Lawson**: Scott's sheet is a fold-out over two scan leaves,
    stitched at frame station 10. Its drawn scale bar reads 2.6% off;
    length between perpendiculars (367.9 / 369.25 ft) and the topmast
    (59.5 / 59.5 ft) agree with the 403 ft 4 in calibration, so that holds.
    The poop and topgallant forecastle run the full beam (`houseBreadth`).
