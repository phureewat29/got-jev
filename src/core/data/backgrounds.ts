/**
 * Backdrop filenames for the location and region catalogs.
 * `regionBackground` and `defaultBackground` back-fill `LocationSeed.background`
 * when no location-specific image applies.
 */

import type { Region } from "./seed";

/** Backdrop for a whole country, used when a place in it has no picture of its own. */
export const regionBackground: Record<Region, string> = {
  "The North": "region-the-north",
  "The Wall": "region-the-wall",
  "Beyond the Wall": "region-beyond-the-wall",
  Riverlands: "region-riverlands",
  "The Vale": "region-the-vale",
  "Iron Islands": "region-iron-islands",
  Westerlands: "region-westerlands",
  Crownlands: "region-crownlands",
  Stormlands: "region-stormlands",
  "The Reach": "region-the-reach",
  Dorne: "region-dorne",
  Essos: "region-essos",
  "The Roads": "region-westeros-travel",
};

/** Last resort when neither a place nor its region has a backdrop. */
export const defaultBackground = "default";
