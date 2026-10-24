import type { ProfileKey } from '../lib/astrology/types';

/**
 * The "what this placement means" copy shown in the in-your-chart popup,
 * one entry per profile position.
 *
 * This file is the single place to author placement copy. Each position has:
 *   - body: what the position is, and what Shadow, Gift and Siddhi look like
 *     there. Paragraphs are separated by a blank line.
 *   - lines: six short notes, index 0 = line 1, on how each line moves
 *     through this position.
 *   - frame: the sentence the card's theme phrase (data/placementThemes.ts)
 *     drops into. `{card}` becomes the card's name, `{theme}` its phrase.
 *   - questions: three prompts that turn the reading into practice.
 *
 * Every reading is assembled from these pieces, so 11 positions, 66 line
 * notes and 64 theme phrases cover every card in every position on every
 * line. No em dashes (comma / period / colon instead).
 */
export interface PlacementDescription {
  /** What the position is. Paragraphs separated by a blank line. */
  body: string;
  /** Six notes, line 1 first. */
  lines: readonly [string, string, string, string, string, string];
  /** Sentence frame with {card} and {theme} slots. */
  frame: string;
  /** Three contemplation prompts. */
  questions: readonly string[];
}

export const PLACEMENT_DESCRIPTIONS: Record<ProfileKey, PlacementDescription> = {
  lifesWork: {
    body:
      "Your Life's Work is what you put into the world: the way you contribute through work, creativity and presence, and the first thing others notice about you. It is conscious, so you can usually recognize it.\n\n" +
      'In shadow, your expression is driven by survival: proving yourself, copying others, working only to get by. In gift, your work feels like play and flows without strain. At its peak, there is no gap between who you are and what you offer.',
    lines: [
      'You express through mastery. Your work rests on deep knowledge, and you need solid ground before you share.',
      'You express through natural talent. You shine when others call you out, not when you push, and you need time alone to recharge.',
      'You express through trial and error. Your path looks varied, and that variety is the work.',
      'You express through people. Opportunities arrive through friends and community, and your work spreads by word of mouth.',
      'You express by solving problems for others. People see you as the one with answers, so reputation matters.',
      'You express through example. Your work ripens over a lifetime, and others come to look to you.',
    ],
    frame: "With {card} in your Life's Work, what you offer the world is {theme}.",
    questions: [
      'What do people naturally come to me for?',
      'When does my work feel like play, and when does it feel like survival?',
      'How do I most naturally share what I do?',
    ],
  },
  evolution: {
    body:
      "Your Evolution is the challenge you were born to grow through. It sits directly opposite your Life's Work, and the two work as a pair: your Life's Work is what you put into the world, your Evolution is what keeps testing whether you can.\n\n" +
      'It is conscious, so you can see it if you look. It usually appears as the same problem wearing different faces, a pattern that repeats across jobs, relationships and years. It is not solved once. It becomes your discipline, and the more you work with it, the more it becomes your strength.\n\n' +
      'In shadow, it feels like bad luck or a flaw in you. In gift, you recognize it as your training ground. At its peak, the challenge and your growth are the same thing.',
    lines: [
      'You meet it by understanding. Study your pattern and get to its root before you try to change it.',
      'You meet it by letting go of effort. Overthinking keeps you stuck; space and stillness let the change happen, and others often notice it before you do.',
      'You meet it through collision. Mistakes are your curriculum, and every break teaches what the last one could not.',
      'You meet it through people. Your challenge plays out in relationships, and the right friend or community changes everything.',
      'You meet it under expectation. People assume you have already mastered this; your work is offering practical help without carrying everyone else’s hopes.',
      'You meet it in phases. Early trial and error, then a period of stepping back, then living your answer as an example.',
    ],
    frame: 'With {card} in your Evolution, the challenge that keeps returning is about {theme}.',
    questions: [
      'What challenge keeps returning in different forms?',
      'How do I usually grow: by understanding, letting go, colliding, connecting, being tested, or stepping back?',
      "Where does this card's shadow show up in that pattern?",
    ],
  },
  radiance: {
    body:
      'Your Radiance is your vitality: your health, your energy, and the quality people feel in your presence. It is unconscious, so others often sense it before you do. Your body and your radiance are linked; when one is worn down, the other dims.\n\n' +
      'In shadow, stress settles in the body and your energy feels flat or forced. In gift, you are naturally magnetic and well. At its peak, simply being present lifts the people around you.',
    lines: [
      'You stay vital through physical foundation. Food, routine and body care are not optional for you.',
      'You stay vital through rest and natural rhythm. Solitude and unhurried time restore you.',
      'You stay vital through variety and play. Rigid routines drain you; changing things up keeps you alive.',
      'You stay vital through your people. The right friendships are medicine, and the wrong ones cost you.',
      'You stay vital by being useful. Purpose fuels your body, but other people’s expectations can drain it.',
      'You stay vital through perspective. Stepping back and letting life ripen keeps your energy clear.',
    ],
    frame: 'With {card} in your Radiance, your vitality depends on {theme}.',
    questions: [
      'When do people say I seem most alive?',
      'What drains my energy that I keep putting up with?',
      'What does this card ask of my body?',
    ],
  },
  purpose: {
    body:
      'Your Purpose is the deep why beneath everything: what grounds you and gives your life meaning. It is unconscious and often becomes clear later in life. It is also the bridge into your Venus Sequence, because purpose is usually found through relationship.\n\n' +
      'In shadow, you feel ungrounded, restless, or unsure why any of it matters. In gift, you feel anchored and your choices line up. At its peak, being alive is itself the purpose.',
    lines: [
      'You find your ground through knowing. You feel steady when you understand yourself and stand in your own authority.',
      'You find your ground by being left alone. Your purpose shows itself when no one is pushing you toward it.',
      'You find your ground through life’s ups and downs. It is built from what survived the shakes.',
      'You find your ground through belonging. Your purpose lives in your closest bonds.',
      'You find your ground through service. You feel steady when you are genuinely useful.',
      'You find your ground through trust. Your purpose unfolds over a long arc, and patience is part of it.',
    ],
    frame: 'With {card} in your Purpose, what grounds you is {theme}.',
    questions: [
      'When have I felt most grounded and sure?',
      'Who or what do I feel responsible for holding?',
      'What would still matter to me if nothing else did?',
    ],
  },
  attraction: {
    body:
      'Your Attraction is who and what you draw toward you, especially the relationships that come to teach you. It is unconscious, so the pattern is easier to see in the people around you than in yourself. Whatever you have not resolved tends to arrive wearing someone else’s face.\n\n' +
      'In shadow, you keep drawing the same difficult dynamic. In gift, you attract relationships that help you grow. At its peak, everyone you meet becomes a teacher and love has no conditions.',
    lines: [
      'You attract through depth. People are drawn to your foundation, and you need to feel secure before you open.',
      'You attract through your natural being. People are drawn to what you are not trying to show, and you need space inside closeness.',
      'You attract through chemistry and change. Bonds made and broken are how you learn what fits.',
      'You attract through friendship first. Your deepest relationships grow out of your circle.',
      'You attract through projection. People see in you what they need, which can swing from admiration to disappointment.',
      'You attract through high standards. You hold out for what is real, and relationships deepen with time.',
    ],
    frame: 'With {card} in your Attraction, the relationships you draw in revolve around {theme}.',
    questions: [
      'What pattern keeps showing up in the people I attract?',
      'What are they reflecting back about me?',
      "What does this card's gift look like in a relationship?",
    ],
  },
  iq: {
    body:
      'Your IQ is how your mind relates to feeling: the stories, beliefs and personal rules you formed roughly between ages 14 and 21. It is conscious, so you can hear it in your own opinions about how life and love should work.\n\n' +
      'In shadow, your values turn into judgments and your opinions harden. In gift, your mind is clear and your values are flexible. At its peak, you hold no fixed position and see each moment fresh.',
    lines: [
      'Your thinking forms through study. You need certainty and build your beliefs on research.',
      'Your thinking forms through instinct. You know things you cannot always explain.',
      'Your thinking forms through questioning. You test and drop ideas until something holds.',
      'Your thinking forms through your circle. Your views are shaped by the people you trust.',
      'Your thinking forms around other people’s needs. You develop the ideas people expect you to deliver.',
      'Your thinking forms at a distance. You watch from above and hold to ideals.',
    ],
    frame: 'With {card} in your IQ, the stories your mind tells revolve around {theme}.',
    questions: [
      'What rules about life and love did I take on as a teenager?',
      'Which of them still serve me?',
      'Where does my thinking turn into judgment?',
    ],
  },
  eq: {
    body:
      'Your EQ is how you protect yourself emotionally, the defenses you built roughly between ages 7 and 14. It is conscious, so you can catch it in the moment you feel hurt or threatened. Most people either react outward or shut down inward.\n\n' +
      'In shadow, your defenses run you: you blow up, go cold, or disappear. In gift, you can feel fully without being swept away. At its peak, you are emotionally free.',
    lines: [
      'You defend by taking control. You soften when you feel safe enough not to know.',
      'You defend by withdrawing. You soften when you are invited back without pressure.',
      'You defend by fighting or leaving. You soften when you see each clash as a lesson.',
      'You defend through loyalty and allies. You soften when you trust a bond enough to be honest.',
      'You defend behind a capable face. You soften when you let someone see you struggle.',
      'You defend by rising above it. You soften when you come back down into feeling.',
    ],
    frame: 'With {card} in your EQ, your defenses gather around {theme}.',
    questions: [
      'What do I do when I feel hurt: explode, go silent, or disappear?',
      'When did I first learn to protect myself this way?',
      'What would softening look like here?',
    ],
  },
  sq: {
    body:
      'Your SQ is your self-worth and the openness of your heart, shaped from birth to about age 7. It sits at the centre of the whole chart, where your sense of being lovable meets everything else. It is unconscious, so it usually shows in how you treat yourself when no one is watching.\n\n' +
      'In shadow, love feels conditional and you feel you have to earn your place. In gift, you accept yourself and love moves freely. At its peak, you become love itself.',
    lines: [
      'Your heart opens when you feel secure. Safety comes first, then trust.',
      'Your heart opens when you are accepted as you are, without being asked to perform.',
      'Your heart opens when you are forgiven. Mistakes met with kindness are what soften you.',
      'Your heart opens through warmth from your people. Their kindness heals you.',
      'Your heart opens when you are truly seen, past what others expect of you.',
      'Your heart opens through trust built over time.',
    ],
    frame: 'With {card} in your SQ, your sense of worth rests on {theme}.',
    questions: [
      'When do I feel I have to earn love?',
      'What did I need as a small child that I can give myself now?',
      "How does this card's gift feel in my body when I accept myself?",
    ],
  },
  core: {
    body:
      'Your Vocation is the work that gives you energy rather than draining it. It carries the same code as your Core, your deepest wound and deepest potential, set before you were born. That is why people often find their vocation by circling back to what once hurt.\n\n' +
      'In shadow, work becomes an escape from the wound and ends in burnout. In gift, your work heals you as you do it. At its peak, work becomes devotion.',
    lines: [
      'You work best as a specialist, going deep into one field.',
      'You work best from natural talent, on your own terms and at your own pace.',
      'You work best by trying many roles until the right one fits.',
      'You work best through collaboration and the people you know.',
      'You work best as the one others turn to when something needs solving.',
      'You work best as a mentor whose experience guides others.',
    ],
    frame: 'With {card} in your Vocation, the work that gives you energy involves {theme}.',
    questions: [
      'What work leaves me with more energy than I started with?',
      'What old hurt shows up in the work I am drawn to?',
      "What would this card's gift look like as a daily practice?",
    ],
  },
  culture: {
    body:
      'Your Culture is the kind of group, team or community where you thrive. It is unconscious, so you usually know it by how you feel inside a group rather than by planning it. The right culture multiplies your gifts; the wrong one dims them.\n\n' +
      'In shadow, you either fit nowhere or lose yourself to fit in. In gift, you find your place and contribute naturally. At its peak, you feel at one with the whole.',
    lines: [
      'You thrive in small, focused groups built on skill.',
      'You thrive in loose groups that leave you space.',
      'You thrive in changing, project-based groups.',
      'You thrive in close circles of trusted friends.',
      'You thrive in larger groups where you lead or advise.',
      'You thrive in groups you guide from the edge, by example.',
    ],
    frame: 'With {card} in your Culture, you thrive in groups built around {theme}.',
    questions: [
      'In which groups have I felt most myself?',
      'What drains me in the wrong group?',
      'What role do I naturally take when a group is working well?',
    ],
  },
  pearl: {
    body:
      'Your Pearl is how prosperity and success come to you. It is conscious, and it points to the simple heart of what you are here to give, which is also what brings abundance back. Prosperity here is something shared, not hoarded.\n\n' +
      'In shadow, you chase money and live in scarcity. In gift, generosity brings abundance. At its peak, prosperity is a state of spirit, not a balance.',
    lines: [
      'Abundance comes through quality and depth.',
      'Abundance comes through doing what you naturally love.',
      'Abundance comes through invention and taking risks.',
      'Abundance comes through relationships and trust.',
      'Abundance comes through practical value that reaches many people.',
      'Abundance comes through being an example people trust.',
    ],
    frame: 'With {card} in your Pearl, abundance flows through {theme}.',
    questions: [
      'What do I give that people value most?',
      'Where do I chase instead of offer?',
      "What would success look like if it matched this card's gift?",
    ],
  },
};

/** The assembled card sentence for one position. */
export function placementSentence(key: ProfileKey, cardName: string, theme: string): string {
  return PLACEMENT_DESCRIPTIONS[key].frame.replace('{card}', cardName).replace('{theme}', theme);
}
