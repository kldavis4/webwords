export const BOARD_SIZE = 4;
export const ROUND_SECONDS = 180;
export const MIN_ROUND_WORDS = 36;

export type Tile = {
  col: number;
  id: string;
  index: number;
  row: number;
  value: string;
};

export type DictionaryIndex = {
  prefixes: Set<string>;
  words: Set<string>;
};

export type Round = {
  answers: string[];
  board: Tile[];
};

export type RandomSource = () => number;

const DICE = [
  ["A", "A", "E", "E", "G", "N"],
  ["A", "B", "B", "J", "O", "O"],
  ["A", "C", "H", "O", "P", "S"],
  ["A", "F", "F", "K", "P", "S"],
  ["A", "O", "O", "T", "T", "W"],
  ["C", "I", "M", "O", "T", "U"],
  ["D", "E", "I", "L", "R", "X"],
  ["D", "E", "L", "R", "V", "Y"],
  ["D", "I", "S", "T", "T", "Y"],
  ["E", "E", "G", "H", "N", "W"],
  ["E", "E", "I", "N", "S", "U"],
  ["E", "H", "R", "T", "V", "W"],
  ["E", "I", "O", "S", "S", "T"],
  ["E", "L", "R", "T", "T", "Y"],
  ["H", "I", "M", "N", "QU", "U"],
  ["H", "L", "N", "N", "R", "Z"]
];

function shuffle<T>(values: T[], rng: RandomSource): T[] {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function normalizeWord(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, "");
}

export function createSeededRng(seed: string): RandomSource {
  let state = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6d2b79f5;

    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildDictionaryIndex(words: string[]): DictionaryIndex {
  const normalizedWords = new Set<string>();
  const prefixes = new Set<string>();

  for (const word of words) {
    const normalized = normalizeWord(word);

    if (normalized.length < 3 || normalized.length > BOARD_SIZE * BOARD_SIZE) {
      continue;
    }

    normalizedWords.add(normalized);

    for (let end = 1; end <= normalized.length; end += 1) {
      prefixes.add(normalized.slice(0, end));
    }
  }

  return {
    prefixes,
    words: normalizedWords
  };
}

export function createBoard(rng: RandomSource = Math.random): Tile[] {
  return shuffle(DICE, rng).map((die, index) => {
    const value = die[Math.floor(rng() * die.length)];

    return {
      col: index % BOARD_SIZE,
      id: `${index}-${value}-${Math.floor(rng() * 100000)}`,
      index,
      row: Math.floor(index / BOARD_SIZE),
      value
    };
  });
}

export function areAdjacent(first: Tile, second: Tile): boolean {
  const rowDistance = Math.abs(first.row - second.row);
  const colDistance = Math.abs(first.col - second.col);

  return first.index !== second.index && rowDistance <= 1 && colDistance <= 1;
}

export function wordFromPath(path: Tile[]): string {
  return path.map((tile) => tile.value).join("");
}

export function scoreWord(word: string): number {
  const length = normalizeWord(word).length;

  if (length < 3) {
    return 0;
  }

  if (length <= 4) {
    return 1;
  }

  if (length === 5) {
    return 2;
  }

  if (length === 6) {
    return 3;
  }

  if (length === 7) {
    return 5;
  }

  return 11;
}

function neighborsFor(index: number): number[] {
  const row = Math.floor(index / BOARD_SIZE);
  const col = index % BOARD_SIZE;
  const neighbors: number[] = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) {
        continue;
      }

      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;

      if (nextRow >= 0 && nextRow < BOARD_SIZE && nextCol >= 0 && nextCol < BOARD_SIZE) {
        neighbors.push(nextRow * BOARD_SIZE + nextCol);
      }
    }
  }

  return neighbors;
}

const NEIGHBORS = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => neighborsFor(index));

export function isWordOnBoard(board: Tile[], rawWord: string): boolean {
  const word = normalizeWord(rawWord);

  if (word.length < 3) {
    return false;
  }

  const search = (tile: Tile, offset: number, used: Set<number>): boolean => {
    if (!word.startsWith(tile.value, offset)) {
      return false;
    }

    const nextOffset = offset + tile.value.length;

    if (nextOffset === word.length) {
      return true;
    }

    used.add(tile.index);

    for (const neighborIndex of NEIGHBORS[tile.index]) {
      if (!used.has(neighborIndex) && search(board[neighborIndex], nextOffset, used)) {
        used.delete(tile.index);
        return true;
      }
    }

    used.delete(tile.index);
    return false;
  };

  return board.some((tile) => search(tile, 0, new Set<number>()));
}

export function solveBoard(board: Tile[], dictionary: DictionaryIndex): string[] {
  const found = new Set<string>();

  const visit = (tile: Tile, currentWord: string, used: Set<number>) => {
    const nextWord = currentWord + tile.value;

    if (!dictionary.prefixes.has(nextWord)) {
      return;
    }

    used.add(tile.index);

    if (dictionary.words.has(nextWord)) {
      found.add(nextWord);
    }

    for (const neighborIndex of NEIGHBORS[tile.index]) {
      if (!used.has(neighborIndex)) {
        visit(board[neighborIndex], nextWord, used);
      }
    }

    used.delete(tile.index);
  };

  for (const tile of board) {
    visit(tile, "", new Set<number>());
  }

  return Array.from(found).sort(sortAnswers);
}

export function createRound(dictionary: DictionaryIndex, rng: RandomSource = Math.random): Round {
  let bestRound: Round = {
    answers: [],
    board: createBoard(rng)
  };

  bestRound.answers = solveBoard(bestRound.board, dictionary);

  for (let attempt = 0; attempt < 160; attempt += 1) {
    const board = createBoard(rng);
    const answers = solveBoard(board, dictionary);

    if (answers.length > bestRound.answers.length) {
      bestRound = {
        answers,
        board
      };
    }

    if (answers.length >= MIN_ROUND_WORDS) {
      return {
        answers,
        board
      };
    }
  }

  return bestRound;
}

export function sortAnswers(first: string, second: string): number {
  const scoreDifference = scoreWord(second) - scoreWord(first);

  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  const lengthDifference = second.length - first.length;

  if (lengthDifference !== 0) {
    return lengthDifference;
  }

  return first.localeCompare(second);
}
