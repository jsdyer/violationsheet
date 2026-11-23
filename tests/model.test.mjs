import test from "node:test";
import assert from "node:assert/strict";
import { describe, findService, pointsFor, publishedEnds, rateChange } from "../web/model.mjs";

const sheet = {
  years: [2023, 2024, 2025],
  services: [
    { id: "1", name: "British Columbia" },
    { id: "40", name: "Langley Township, municipal" },
    { id: "88", name: "Kitimat" },
  ],
  violations: [{ id: "64", name: "Property crime" }],
  cells: {
    1: { 64: { 2023: [100, 200], 2024: [110, 210], 2025: [90, 180] } },
    40: { 64: { 2023: [10, 50], 2024: [null, null], 2025: [12, 40] } },
    88: { 64: { 2025: [0, 0] } },
  },
};

test("a service outside the starter list is still found", () => {
  const presets = ["Langley Township RCMP", "Vancouver"];
  assert.equal(presets.includes("Kitimat"), false);
  assert.equal(findService(sheet.services, "Kitimat").id, "88");
  assert.equal(findService(sheet.services, "langley").name, "Langley Township, municipal");
});

test("a missing year is not read as zero", () => {
  const points = pointsFor(sheet, "40", "64");
  assert.equal(points.find((point) => point.year === 2024).incidents, null);
  assert.equal(points.find((point) => point.year === 2024).rate, null);
  const ends = publishedEnds(points);
  assert.equal(ends.latest.year, 2025);
  assert.equal(ends.previous.year, 2023);
});

test("a real zero stays zero and a missing rate is not a change", () => {
  const ends = publishedEnds(pointsFor(sheet, "88", "64"));
  assert.equal(ends.latest.incidents, 0);
  assert.equal(ends.previous, null);
  assert.equal(rateChange(ends.latest, ends.previous), null);
  assert.match(describe("Kitimat", "Property crime", ends.latest, ends.previous, 180), /0 property crime incidents/);
  assert.match(describe("Kitimat", "Property crime", ends.latest, ends.previous, 180), /not called a rise or a fall/);
});

test("the sentence uses the previous published rate and the provincial rate", () => {
  const points = pointsFor(sheet, "40", "64");
  const ends = publishedEnds(points);
  const sentence = describe("Langley Township, municipal", "Property crime", ends.latest, ends.previous, 180);
  assert.match(sentence, /12 property crime incidents in 2025/);
  assert.match(sentence, /down .* from 2023/);
  assert.match(sentence, /180 per 100,000/);
  assert.doesNotMatch(sentence, /2024/);
});
