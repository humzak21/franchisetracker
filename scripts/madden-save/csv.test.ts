import { expect, it } from "vitest";
import { csvRecords } from "../../shared/history/csv";
import { toCsv } from "./csv";

it("writes what the app's CSV reader reads back", () => {
  const text = toCsv(
    ["player", "team", "note", "ir"],
    [
      ["Drake Maye", "NE", 'says "hi", twice', true],
      ["A.J. Brown", null, "line\nbreak", false],
    ],
  );
  expect([...csvRecords(text)]).toEqual([
    ["player", "team", "note", "ir"],
    ["Drake Maye", "NE", 'says "hi", twice', "yes"],
    ["A.J. Brown", "", "line\nbreak", "no"],
  ]);
});
