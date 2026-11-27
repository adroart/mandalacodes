/**
 * Which keynotes name a challenge inside the energy, rather than the energy
 * lived well. The card entrance shows the lived-well keynotes on top and these
 * below them (Adrian, 2026-11-27). The cards themselves are not changed: their
 * `_Keywords:_` lines keep their words and order, and this list only sorts them
 * for display. A keynote that is not listed here is shown with the lived-well
 * ones. Every phrase here must appear on a card (tests/unit/keynoteChallenges.test.ts).
 */
export const KEYNOTE_CHALLENGES: ReadonlySet<string> = new Set([
  // 1
  'The Dry Spell Between', 'Waiting for the Next Wave',
  // 2
  'Feeling Lost',
  // 3
  'Not Yet Settled', 'The Pull to Hurry',
  // 4
  'Needing a Reason',
  // 5
  'Restless Waiting', 'Moving Too Soon',
  // 6
  'Friction Between Two People', 'Feeling a Quarrel Coming', 'The Need to Be Right',
  // 7
  'Wanting to Be Seen', 'Us and Them',
  // 8
  'The Fear of Standing Out', 'Alone for a While',
  // 9
  'Bored With Good Work', 'Going in Circles',
  // 10
  'Watching Your Every Step', 'Searching for Yourself',
  // 11
  'Lost in a Haze',
  // 12
  'Keeping Your Heart Guarded',
  // 13
  'Hearing Only Bad News',
  // 14
  'Settling for Less',
  // 15
  'The Grey Days',
  // 16
  'Plans Left on the Table',
  // 17
  'A Mind Made Up Young',
  // 18
  'Seeing the Flaw First', 'Needing to Be Right',
  // 19
  'Giving Until Empty', 'Needing to Be Needed',
  // 20
  'Busy Instead of Present',
  // 21, 45
  'Deciding for Others', 'Holding On Too Tight',
  // 22
  'Blaming Someone Else', 'Swallowing What You Feel',
  // 23
  'A Life Grown Too Complicated',
  // 24
  'Going Round in Circles',
  // 25
  'A Tight Chest', 'Worry With No Cause',
  // 26
  "Never Feeling It's Enough", 'Unable to Rest',
  // 28
  'Days With No Point', 'Afraid to Really Live',
  // 29
  'Doubts at the Hard Moments', 'Holding a Part Back',
  // 30
  "Wanting What You Don't Need", 'The Crash After Hope',
  // 31
  'Needing to Be Seen', 'Falling in Front of Everyone',
  // 32
  'Afraid of Failing', 'Rushing Through the Day',
  // 33
  'The Same Mistake Again',
  // 34
  'Taking the Easy Way', 'Pushing Too Hard', 'Busy but Powerless',
  // 35
  'Wanting It All Now',
  // 36
  'The Fear of Suffering',
  // 37
  'Hoping for Something Back',
  // 38
  'Fighting the Wrong Thing',
  // 39
  'Buttons Being Pushed',
  // 40
  'Tired All the Way Down',
  // 41
  'Living on Hope',
  // 42
  'Waiting for Life to Start',
  // 43
  'Too Busy to Hear',
  // 44
  'The Same Lesson Returning', "Kept at Arm's Length",
  // 45
  'The Fear of Not Enough',
  // 46
  'Worrying How It Goes',
  // 47
  'Worn Out and Hemmed In', 'Old Fears Handed Down',
  // 48
  'Fear of Not Being Enough',
  // 49
  'Set Off Before You Think',
  // 50
  'Carrying Too Much',
  // 51
  'Braced for the Next Blow',
  // 52
  'Feeling Stuck',
  // 53
  'Always Chasing the Next Thing', 'Fear at the Start',
  // 54
  'Never Enough',
  // 55
  'Chasing the Next High', 'Blaming the World',
  // 56
  'Always on the Move',
  // 58
  'Restless for More', 'Chasing Tomorrow',
  // 59
  'Holding Something Back',
  // 60
  'A Rule Kept Too Long',
  // 61
  'A Restless Mind',
  // 62
  'Lost in the Details', 'Planning Too Much',
  // 63
  'Doubt Turned Inward',
]);

/** A card's keynotes split into the lived-well ones and the challenges, each in card order. */
export function splitKeynotes(keywords: readonly string[]): { gifts: string[]; challenges: string[] } {
  const gifts: string[] = [];
  const challenges: string[] = [];
  for (const keyword of keywords) (KEYNOTE_CHALLENGES.has(keyword.trim()) ? challenges : gifts).push(keyword);
  return { gifts, challenges };
}
