import { getStore } from "@netlify/blobs";
import { normaliseFixtureData } from "../functions/_shared/calendar.js";
import { DEFAULT_OFFER, publicOffer } from "../functions/_shared/offer.js";
import { validAssetId } from "../functions/_shared/image-core.js";

const store = () => getStore({ name: "fixtures", consistency: "strong" });
const EMPTY = { fixtures: [], updatedAt: null };
const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": "public, max-age=300", "X-TTP-Runtime": "edge" }
});

export default async (request, context) => {
  if (request.method !== "GET") return context.next();
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  if (![null, "display-public", "offer-public", "logo"].includes(action)) return context.next();
  const activeStore = store();
  if (action === "display-public") {
    const [fixtureData, offerData] = await Promise.all([
      activeStore.get("current", { type: "json" }),
      activeStore.get("offer", { type: "json" })
    ]);
    return json({ fixtures: normaliseFixtureData(fixtureData || EMPTY), offer: publicOffer(offerData || DEFAULT_OFFER) });
  }
  if (action === "offer-public") return json(publicOffer((await activeStore.get("offer", { type: "json" })) || DEFAULT_OFFER));
  if (action === "logo") {
    const id = url.searchParams.get("id") || "";
    if (!validAssetId(id)) return json({ error: "Logo not found" }, 404);
    const meta = await activeStore.get(`offer-logo/${id}/meta`, { type: "json" });
    const data = meta && await activeStore.get(`offer-logo/${id}/original/${meta.sha256}`, { type: "arrayBuffer" });
    return data
      ? new Response(data, { headers: { "Content-Type": meta.contentType, "Cache-Control": "public, max-age=31536000, immutable", "X-TTP-Runtime": "edge" } })
      : json({ error: "Logo not found" }, 404);
  }
  return json(normaliseFixtureData((await activeStore.get("current", { type: "json" })) || EMPTY));
};

export const config = { path: "/api/fixtures" };
