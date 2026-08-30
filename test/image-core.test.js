import test from "node:test";
import assert from "node:assert/strict";
import { inspectImage, validAssetId } from "../netlify/functions/_shared/image-core.js";
test("inspects real PNG dimensions and transparency", () => assert.deepEqual(inspectImage(Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,2,88,0,0,1,104])), { contentType: "image/png", width: 600, height: 360, transparency: true }));
test("rejects malformed and validates opaque IDs", () => { assert.throws(() => inspectImage(Uint8Array.of(255,216,255))); assert.equal(validAssetId("logo-12345678-1234-4abc-8abc-123456789abc"), true); assert.equal(validAssetId("../state"), false); });
