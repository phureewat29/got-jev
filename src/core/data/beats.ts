import type { BeatSeed } from "./seed";

export const beats = [
  { id: "battle", name: "Pitched battle", definition: "Two armies in the open; terrain, cavalry, a plan that survives ninety seconds", example: "Battle of the Bastards", background: "beat-battle" },
  { id: "duel", name: "Skirmish or duel", definition: "Small personal fight — trial by combat or a sudden ambush by a handful", example: "Bronn vs Ser Vardis at the Eyrie" },
  { id: "intrigue", name: "Council or court intrigue", definition: "Powerful people trading information, threats and favours; no steel drawn", example: "Small council beneath the Iron Throne", background: "beat-intrigue" },
  { id: "feast", name: "Feast", definition: "Long tables, too much wine, a singer, social danger dressed as hospitality", example: "Robert's welcoming feast at Winterfell", background: "beat-feast" },
  { id: "wedding", name: "Wedding", definition: "Public ceremony — the most dangerous event in the setting", example: "The Red Wedding", background: "beat-wedding" },
  { id: "trial", name: "Execution or trial", definition: "Formal judgement and its carrying out before a crowd", example: "Ned Stark on the steps of Baelor's Sept", background: "beat-trial" },
  { id: "journey", name: "Journey or travel", definition: "Movement between places as the scene: road, camp, weather, saddle talk", example: "The royal procession down the kingsroad" },
  { id: "oath", name: "Oath or ritual", definition: "A binding spoken before gods or witnesses; a rite performed correctly", example: "Jon's vow before the weirwood grove" },
  { id: "siege", name: "Siege", definition: "Army outside walls, garrison inside, time as the weapon", example: "Stannis at Storm's End", background: "beat-siege" },
  { id: "parley", name: "Negotiation or parley", definition: "Enemies under truce talking terms at least one intends to break", example: "The Dragonpit Summit", background: "beat-parley" },
  { id: "vision", name: "Vision or dream", definition: "Prophetic or magical sight: greensight, flames, warging", example: "House of the Undying", background: "beat-vision" },
  { id: "stealth", name: "Stealth or escape", definition: "Moving unseen, getting out, discovery as the clock", example: "Theon and Sansa leaping from Winterfell's walls" },
  { id: "supernatural", name: "Supernatural encounter", definition: "The uncanny in person: Others, wights, shadows, resurrection", example: "Massacre at Hardhome", background: "beat-supernatural" },
  { id: "quiet", name: "Tender or quiet moment", definition: "Two characters, low stakes, honesty; the scene that makes the next death land", example: "Jaime and Brienne in the Harrenhal bathhouse" },
] as const satisfies ReadonlyArray<BeatSeed>;

export type BeatId = (typeof beats)[number]["id"];
