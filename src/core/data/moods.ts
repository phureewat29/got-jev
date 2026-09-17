import type { MoodSeed } from "./seed";

export const moods = [
  { id: "martial", feel: "An army in motion before the killing starts: muster, march, the ride to the field", examples: ["the host forming up before the Battle of the Bastards", "the royal column riding down the kingsroad"] },
  { id: "battle", feel: "Violence in motion: steel, charges, sieges, killing", examples: ["Jon at Hardhome", "the Battle of the Bastards"] },
  { id: "tense", feel: "Danger poised but not struck: standoff, stealth, threat, pursuit", examples: ["sneaking past wights", "a hostile hall"] },
  { id: "scheming", feel: "Power traded in a room: whispers, leverage, a bargain with a knife behind it", examples: ["the small council beneath the Iron Throne", "Littlefinger choosing whose secret to sell"] },
  { id: "ominous", feel: "Dread and wrongness: the supernatural, cold wind, omen", examples: ["the Haunted Forest at dusk", "a raven's warning"] },
  { id: "mystical", feel: "The old powers listening: weirwood, ritual, prophecy, a vision taking hold", examples: ["the heart tree at Winterfell", "the green dreams"] },
  { id: "sorrowful", feel: "Grief, loss, farewell, defeat, remembrance", examples: ["a burial at the Wall", "news from Winterfell"] },
  { id: "romantic", feel: "Intimacy, longing, tenderness between two people", examples: ["the cave with Ygritte", "Daenerys and Drogo beneath the stars"] },
  { id: "calm", feel: "Solitary stillness and safety: quiet reflection, rest, snowfall", examples: ["alone on the Wall at dawn", "snowfall over a sleeping castle"] },
  { id: "relaxed", feel: "Warmth and ease among others: feast, tavern, camaraderie, humour", examples: ["wine with Sam by the fire", "swapping stories in the common hall"] },
  { id: "bustling", feel: "A crowd going about its business: market, harbour, a city street, trade and noise", examples: ["the Braavosi canals at market hour", "the quays of Lannisport at first light"] },
  { id: "curious", feel: "Discovery and wonder: exploration, a mystery unfolding", examples: ["a hidden passage under Winterfell", "Sam poring over scrolls in the Citadel"] },
  { id: "triumphant", feel: "Victory, arrival, an oath fulfilled, honour won", examples: ["riding through Winterfell's gates", "Jon raised as Lord Commander"] },
] as const satisfies ReadonlyArray<MoodSeed>;

export type MoodId = (typeof moods)[number]["id"];
