import { cache } from "react";
import { db } from "./db";

const PATHS: Record<string, string> = {
  autogallery: "/cars",
  "auto-parts": "/parts",
  "auto-accessories": "/accessories",
  "auto-technology": "/technology",
  "auto-care": "/auto-care",
  "vehicle-finance": "/finance",
  imports: "/imports",
};

/** Divisions are data. Known divisions get friendly paths; any division the Super Admin creates lands on /division/[slug]. */
export const divisionHref = (slug: string) => PATHS[slug] ?? `/division/${slug}`;

export const getDivisions = cache(async () => db.division.findMany({ where: { isVisible: true }, orderBy: { sortOrder: "asc" } }));
