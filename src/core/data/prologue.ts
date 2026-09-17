export const openingLocationId = "castle-black" as const;

export const openingMoodId = "calm" as const;

/**
 * The opening is deliberately unspent: an ordinary morning, no duty pressing, the
 * roads named but none of them chosen. It states where Jon stands and stops, so the
 * first thing that happens in the story is whatever the player decides.
 */
export const prologue = {
  jon: "I am Jon Snow, Lord Eddard Stark's bastard son. He brought me to Winterfell as a babe and raised me alongside his trueborn children. I never knew my mother, not even her name — my father would never speak of her.\n\nI took the black and rode north to the Wall, where Lord Commander Mormont armed me with his own blade, Longclaw, forged of Valyrian steel. Ghost, my direwolf, came out of the snow and has followed me since.",
  narrator: "Morning at Castle Black, and for once nothing is asked of you. The Wall throws its shadow across the yard until midday, and the brothers move through it at their own pace — hauling firewood, mending leather, arguing over a game of tiles. Nobody is waiting on you.\n\nThe world lies open in every direction. North of the gate the haunted forest goes on until the maps give up. South the kingsroad runs the length of the realm, past Winterfell, past the Neck, all the way to King's Landing. East at Eastwatch there are ships that will carry a man to Braavos and beyond, and no one at this gate will ask where you are going.\n\nWhat do you do?",
} as const;
