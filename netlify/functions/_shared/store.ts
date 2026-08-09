import type { Context } from "@netlify/functions";
import { getDeployStore, getStore } from "@netlify/blobs";

export function getFixtureStore(context?: Context) {
  if (context?.deploy?.context === "production") return getStore({ name: "fixtures", consistency: "strong" });
  return getDeployStore({ name: "fixtures" });
}
