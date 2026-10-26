import { describe, expect, test } from "vitest";
import { confidentMatch, rankCandidates, sameSchool, type RankableCandidate } from "./espnMatch";

const candidate = (over: Partial<RankableCandidate>): RankableCandidate => ({
  name: "Jeremiah Smith",
  league: "college",
  position: "WR",
  teamAbbr: "OSU",
  college: "Ohio State",
  ...over,
});

describe("ESPN matching", () => {
  test("school names compare loosely", () => {
    expect(sameSchool("Ohio St.", "Ohio State")).toBe(true);
    expect(sameSchool("Miami (FL)", "Miami")).toBe(true);
    expect(sameSchool("University of Texas", "Texas")).toBe(true);
    expect(sameSchool("North Carolina", "North Carolina State")).toBe(false);
    expect(sameSchool(null, "Texas")).toBe(false);
  });

  test("ranks the exact name at the player's school and position first", () => {
    const subject = {
      name: "Jeremiah Smith",
      position: "WR" as const,
      college: "Ohio State",
      teamAbbr: null,
    };
    const ranked = rankCandidates(subject, [
      candidate({ name: "Jeremiah Smith", college: "Alabama", position: "LB", teamAbbr: "ALA" }),
      candidate({ name: "Jeremiah Smithson" }),
      candidate({}),
    ]);
    expect(ranked[0]).toMatchObject({ college: "Ohio State", position: "WR", name: "Jeremiah Smith" });
    expect(ranked[2]?.name).toBe("Jeremiah Smithson");
  });

  test("only suggests a match the school and position back up", () => {
    const subject = {
      name: "Jeremiah Smith",
      position: "WR" as const,
      college: "Ohio State",
      teamAbbr: null,
    };
    expect(confidentMatch(subject, [candidate({ college: "Alabama" })])).toBeNull();
    expect(confidentMatch(subject, [candidate({ position: "LB" })])).toBeNull();
    expect(confidentMatch(subject, [candidate({})])).toMatchObject({ college: "Ohio State" });
    // Nothing on record to disagree with: the exact name stands.
    expect(confidentMatch({ ...subject, college: null, position: null }, [candidate({})])).not.toBeNull();
  });
});
