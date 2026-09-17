/**
 * Backdrop filenames for the location and region catalogs.
 * `regionBackground` and `defaultBackground` back-fill `LocationSeed.background`
 * when no location-specific image applies.
 */

import type { Region } from "./seed";

/** Backdrop used while travelling toward a region, when no single place applies. */
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
  "Westeros (travel)": "region-westeros-travel",
};

/** Last resort when neither a place nor its region has a backdrop. */
export const defaultBackground = "default";
