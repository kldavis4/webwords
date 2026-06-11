import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(root, "src", "data", "source", "enable1.txt");
const blocklistPath = path.join(root, "src", "data", "blocked-words.json");
const outputPath = path.join(root, "src", "data", "dictionary.json");

const blockedWords = JSON.parse(await readFile(blocklistPath, "utf8"));
const exactBlocklist = new Set(blockedWords.map((word) => word.toUpperCase()));

const rawWords = await readFile(sourcePath, "utf8");
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

console.log(`Generated ${words.length.toLocaleString()} Boggle words from ENABLE1.`);
