# Sailboat lines from published drawings

Realistic sailing-vessel outlines, traced by hand from a published sail-plan
drawing and lofted into 3D. The trace is the data; everything else is
regenerated from it:

```bash
node scripts/sailboat-lines.mjs
```

| Boat               | Trace                           | Profile                             | Plan                             | Body plan                            | Loft                             |
| ------------------ | ------------------------------- | ----------------------------------- | -------------------------------- | ------------------------------------ | -------------------------------- |
| Hans Christian 38T | [json](hans-christian-38t.json) | ![](hans-christian-38t-profile.svg) | ![](hans-christian-38t-plan.svg) | ![](hans-christian-38t-bodyplan.svg) | ![](hans-christian-38t-loft.svg) |

## Sources

| Boat               | Spec page                                               | Drawing                                                                             |
| ------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Hans Christian 38T | <https://sailboatdata.com/sailboat/hans-christian-38t/> | <https://sailboatdata.com/wp-content/uploads/2023/03/hans_christian_38_drawing.jpg> |

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
   LOA, which excludes the bowsprit and any stern spar. Check draft, LWL and
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
