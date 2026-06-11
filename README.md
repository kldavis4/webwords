# WordWeb Boggle

A Next.js implementation of a dictionary-backed Boggle word search game.

## Run

```bash
npm install
npm run dev
```

The dictionary is generated before dev, build, and typecheck runs.

## Dictionary

The playable word list is generated from `src/data/source/enable1.txt` with a small curated blocklist in
`src/data/blocked-words.json`.
