import { describe, it, expect } from "vitest";
import { verifyVisuals } from "./article-visuals";

const body = "Josh Hoover threw for 3,100 yards and 31 touchdowns. Indiana went 7-1 in the Big Ten. \"He gets the call and sees the picture,\" Cignetti said. The opener is Sept. 5 against North Texas.";

describe("verifyVisuals", () => {
  it("keeps a verbatim callout and drops a paraphrased one", () => {
    expect(verifyVisuals({ stats: [], callout: "“He gets the call and sees the picture,”", calloutSpeaker: "Cignetti", facts: [], watching: [], questions: [] }, body).callout).toBe("He gets the call and sees the picture,");
    expect(verifyVisuals({ stats: [], callout: "He sees the whole picture", calloutSpeaker: "Cignetti", facts: [], watching: [], questions: [] }, body).callout).toBeNull();
  });
  it("keeps stats whose numbers the body carries", () => {
    const v = verifyVisuals({ stats: [{ value: "3,100", label: "yards", critical: false }, { value: "7-1", label: "Big Ten", critical: false }, { value: "12", label: "wins", critical: true }], callout: null, calloutSpeaker: null, facts: [], watching: [], questions: [] }, body);
    expect(v.stats.map((s) => s.value)).toEqual(["3,100", "7-1"]);
    const thin = verifyVisuals({ stats: [{ value: "Sept. 5", label: "opener", critical: false }, { value: "B", label: "grade", critical: false }, { value: "31", label: "touchdowns", critical: false }], callout: null, calloutSpeaker: null, facts: [], watching: [], questions: [] }, body);
    expect(thin.stats).toEqual([]); // a date and a grade are not stats; one number is not a strip
  });
  it("drops thin or banned questions", () => {
    const v = verifyVisuals({ stats: [], callout: null, calloutSpeaker: null, facts: [], watching: [{ title: "Q?", body: "It remains to be seen." }], questions: [{ question: "Who starts?", why: "short" }] }, body);
    expect(v.watching).toEqual([]); expect(v.questions).toEqual([]);
  });
});
