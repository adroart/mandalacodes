/**
 * Which keynotes name a challenge inside the energy, rather than the energy
 * lived well. The card entrance shows the lived-well keynotes on top and these
 * below them (Adrian, 2026-11-27). Every card has seven: four lived well, then
 * these three, in that order on its `_Keywords:_` line. A keynote that is not
 * listed here is shown with the lived-well ones. Every phrase here must appear
 * on a card (tests/unit/keynoteChallenges.test.ts). Change this list whenever a
 * challenge keynote is reworded.
 */
export const KEYNOTE_CHALLENGES: ReadonlySet<string> = new Set([
  // 1
  "Dry Spells", "Waiting for Inspiration", "Forcing It",
  // 2
  "Feeling Lost", "Needing Control", "Losing Yourself in Others",
  // 3
  "Unsettled", "Rushing", "Fear of Chaos",
  // 4
  "Needing Reasons", "Nit-Picking", "Not Wanting to Know",
  // 5
  "Restlessness", "Moving Too Soon", "Expecting the Worst",
  // 6
  "Friction With Others", "A Fight Brewing", "Needing to Be Right",
  // 7
  "Needing Credit", "Us and Them", "Bossiness",
  // 8
  "Fear of Standing Out", "Loneliness", "Trying to Fit In",
  // 9
  "Boredom", "Going in Circles", "Putting It Off",
  // 10
  "Self-Conscious", "Searching for Yourself", "Self-Absorbed",
  // 11
  "Head in the Clouds", "Too Many Ideas", "Daydreaming",
  // 12
  "A Guarded Heart", "Feeling Superior", "Hurtful Words",
  // 13
  "Expecting Bad News", "Holding Grudges", "Only Seeing Your Side",
  // 14
  "Settling for Less", "Work You Hate", "Feeling Powerless",
  // 15
  "Dull Days", "Going to Extremes", "Feeling Empty",
  // 16
  "Unfinished Plans", "Not Caring", "Easily Fooled",
  // 17
  "A Closed Mind", "Opinionated", "Self-Criticism",
  // 18
  "Fault-Finding", "Needing to Be Right", "Never Good Enough",
  // 19
  "Giving Until Empty", "Needing to Be Needed", "Withdrawing",
  // 20
  "Too Busy to Be Present", "Going Through the Motions", "Rushing Around",
  // 21
  "Controlling Others", "Holding On Too Tight", "Giving In",
  // 22
  "Blaming Others", "Swallowing Feelings", "Keeping Up Appearances",
  // 23
  "Overcomplicating", "Scattered", "Saying Too Much",
  // 24
  "Hooked on Habits", "Repeating Patterns", "Frozen by Worry",
  // 25
  "A Tight Chest", "Needless Worry", "Going Cold",
  // 26
  "Never Satisfied", "Can't Rest", "Showing Off",
  // 27
  "Self-Sacrifice", "Selfishness", "Fussing Over Others",
  // 28
  "Feeling Pointless", "Afraid to Live", "Reckless Risks",
  // 29
  "Doubting When It's Hard", "Holding Back", "Overcommitting",
  // 30
  "Wanting What You Don't Need", "Crashing After Hope", "Too Serious",
  // 31
  "Needing Attention", "Public Embarrassment", "Looking Down on Others",
  // 32
  "Fear of Failure", "Always Rushing", "Stuck in Old Ways",
  // 33
  "Repeating Mistakes", "Bottling It Up", "Quick to Judge",
  // 34
  "The Easy Way Out", "Pushing Too Hard", "Busy but Powerless",
  // 35
  "Wanting It All Now", "Easily Bored", "Never Slowing Down",
  // 36
  "Fear of Pain", "Nervousness", "Living in Crisis",
  // 37
  "Expecting Something Back", "Clinging to Old Ties", "Turning Cold",
  // 38
  "Fighting the Wrong Battle", "Giving Up Too Soon", "Picking Fights",
  // 39
  "Easily Triggered", "Feeling Trapped", "Stirring Things Up",
  // 40
  "Exhaustion", "Overdoing It", "Resentment",
  // 41
  "Living on Hope", "Dreaming, Not Doing", "Rushing Into Things",
  // 42
  "Waiting for Life to Start", "Expecting Too Much", "Half-Finished Things",
  // 43
  "Too Busy to Listen", "Worrying", "Talking Over Others",
  // 44
  "Repeating Lessons", "Keeping People Away", "Misjudging People",
  // 45
  "Fear of Not Having Enough", "Holding On Too Tight", "Throwing Your Weight Around",
  // 46
  "Worrying How It Turns Out", "Unable to Play", "Not Taking Anything Seriously",
  // 47
  "Worn Out and Trapped", "Inherited Fears", "Hopelessness",
  // 48
  "Feeling Inadequate", "Playing It Safe", "Cutting Corners",
  // 49
  "Reacting Without Thinking", "Pushing People Away", "Too Comfortable to Change",
  // 50
  "Carrying Too Much", "Letting Things Slide", "Ignoring Problems",
  // 51
  "Bracing for the Worst", "Avoiding Change", "Snapping at People",
  // 52
  "Feeling Stuck", "Can't Sit Still", "Wound Up",
  // 53
  "Chasing the Next Thing", "Fear of Starting", "Losing Interest",
  // 54
  "Never Enough", "Wanting More and More", "Aiming Too Low",
  // 55
  "Chasing Highs", "Blaming the World", "Complaining",
  // 56
  "Always on the Move", "Too Much at Once", "Sulking",
  // 57
  "Hesitating", "Acting From Fear", "Uneasy for No Reason",
  // 58
  "Restless for More", "Living for Tomorrow", "Fixing Other People",
  // 59
  "Keeping Secrets", "Feeling Left Out", "Intruding",
  // 60
  "Rigid Rules", "No Structure", "Feeling Boxed In",
  // 61
  "A Restless Mind", "Losing the Magic", "Blind Belief",
  // 62
  "Lost in Details", "Overplanning", "Correcting Everyone",
  // 63
  "Self-Doubt", "Suspicion", "Endless Questions",
  // 64
  "Copying Others", "Confusion", "Not Knowing Where to Start",
]);

/** A card's keynotes split into the lived-well ones and the challenges, each in card order. */
export function splitKeynotes(keywords: readonly string[]): { gifts: string[]; challenges: string[] } {
  const gifts: string[] = [];
  const challenges: string[] = [];
  for (const keyword of keywords) (KEYNOTE_CHALLENGES.has(keyword.trim()) ? challenges : gifts).push(keyword);
  return { gifts, challenges };
}
