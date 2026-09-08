import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/*.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgresql://postgres:postgres@localhost:5432/jugendleiter2026",
  },
  verbose: true,
  strict: true,
  /**
   * Exclude PostGIS system tables/views from schema introspection.
   * Without this, `db:push` tries to drop spatial_ref_sys and PostGIS views.
   */
  tablesFilter: ["!spatial_ref_sys", "!geography_columns", "!geometry_columns", "!raster_columns", "!raster_overviews"],
});
