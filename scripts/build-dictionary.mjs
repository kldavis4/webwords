import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import wordListPath from "word-list";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "src", "data", "dictionary.json");

const exactBlocklist = new Set([
  "ARSE",
  "ASSES",
  "ASSHOLE",
  "BASTARD",
  "BITCH",
  "BITCHES",
  "BOLLOCKS",
  "BULLSHIT",
  "CHINK",
  "COCK",
  "COCKS",
  "CRAP",
  "CUNT",
  "DAMN",
  "DICK",
  "DICKS",
  "FAG",
  "FAGS",
  "FUCK",
  "FUCKED",
  "FUCKER",
  "FUCKING",
  "FUCKS",
  "GOOK",
  "HELL",
  "KIKE",
  "NIGGER",
  "PISS",
  "PRICK",
  "PUSSY",
  "SHIT",
  "SHITS",
  "SLUT",
  "SPIC",
  "TITS",
  "TWAT",
  "WANK",
  "WHORE"
]);

const rawWords = await readFile(wordListPath, "utf8");
const words = Array.from(
  new Set(
    rawWords
      .split(/\r?\n/)
      .map((word) => word.trim().toUpperCase())
      .filter((word) => word.length >= 3 && word.length <= 12)
      .filter((word) => /^[A-Z]+$/.test(word))
      .filter((word) => !exactBlocklist.has(word))
  )
).sort((a, b) => a.localeCompare(b));

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(words)}\n`);

console.log(`Generated ${words.length.toLocaleString()} Boggle words.`);
