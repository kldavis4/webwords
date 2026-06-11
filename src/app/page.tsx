"use client";

import {
  Check,
  Clock3,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { type FormEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dictionaryWords from "@/data/dictionary.json";
import {
  areAdjacent,
  buildDictionaryIndex,
  createRound,
  createSeededRng,
  isWordOnBoard,
  normalizeWord,
  ROUND_SECONDS,
  scoreWord,
  sortAnswers,
  type Round,
  type Tile,
  wordFromPath
} from "@/lib/boggle";
import { useGameSound } from "@/lib/useGameSound";

type FoundWord = {
  score: number;
  seconds: number;
  word: string;
};

type Toast = {
  id: number;
  kind: "good" | "neutral" | "warning";
  text: string;
};

const initialToast: Toast = {
  id: 0,
  kind: "neutral",
  text: "Ready"
};

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function classNames(...names: Array<false | null | string | undefined>): string {
  return names.filter(Boolean).join(" ");
}

export default function Home() {
  const [dictionary] = useState(() => buildDictionaryIndex(dictionaryWords as string[]));
  const [round, setRound] = useState<Round>(() => createRound(dictionary, createSeededRng("wordweb-initial-board")));
  const [foundWords, setFoundWords] = useState<FoundWord[]>([]);
  const [path, setPath] = useState<Tile[]>([]);
  const [typedWord, setTypedWord] = useState("");
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [isPaused, setIsPaused] = useState(false);
  const [toast, setToast] = useState<Toast>(initialToast);
  const pathRef = useRef<Tile[]>([]);
  const finishSoundPlayedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const { isMuted, play, toggleMuted } = useGameSound();

  const isFinished = timeLeft === 0;
  const currentWord = wordFromPath(path);
  const totalScore = foundWords.reduce((sum, word) => sum + word.score, 0);
  const foundWordSet = useMemo(() => new Set(foundWords.map((word) => word.word)), [foundWords]);
  const missingWords = useMemo(
    () => round.answers.filter((word) => !foundWordSet.has(word)).sort(sortAnswers),
    [foundWordSet, round.answers]
  );
  const longestWord = foundWords.reduce((longest, next) => {
    if (next.word.length > longest.length) {
      return next.word;
    }

    return longest;
  }, "");
  const progress = round.answers.length > 0 ? Math.round((foundWords.length / round.answers.length) * 100) : 0;
  const pathPoints = path.map((tile) => `${tile.col * 100 + 50},${tile.row * 100 + 50}`).join(" ");

  useEffect(() => {
    if (isPaused || isFinished) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isFinished, isPaused]);

  useEffect(() => {
    if (!isFinished || finishSoundPlayedRef.current) {
      return;
    }

    finishSoundPlayedRef.current = true;
    play("finish");
  }, [isFinished, play]);

  const pushToast = useCallback((text: string, kind: Toast["kind"] = "neutral") => {
    setToast((current) => ({
      id: current.id + 1,
      kind,
      text
    }));
  }, []);

  const updatePath = useCallback((pathUpdate: Tile[] | ((currentPath: Tile[]) => Tile[])) => {
    setPath((currentPath) => {
      const nextPath = typeof pathUpdate === "function" ? pathUpdate(currentPath) : pathUpdate;
      pathRef.current = nextPath;

      return nextPath;
    });
  }, []);

  const clearPath = useCallback(() => updatePath([]), [updatePath]);

  const tileFromElement = useCallback(
    (element: Element | null) => {
      const tileElement = element?.closest("[data-tile-index]");

      if (!(tileElement instanceof HTMLElement)) {
        return null;
      }

      const tileIndex = Number(tileElement.dataset.tileIndex);

      if (!Number.isInteger(tileIndex)) {
        return null;
      }

      return round.board[tileIndex] ?? null;
    },
    [round.board]
  );

  const addTileToPath = useCallback(
    (tile: Tile) => {
      const currentPath = pathRef.current;
      const existingIndex = currentPath.findIndex((selectedTile) => selectedTile.index === tile.index);
      let nextPath: Tile[] | null = null;

      if (existingIndex >= 0 && existingIndex === currentPath.length - 2) {
        nextPath = currentPath.slice(0, -1);
      } else if (existingIndex !== -1) {
        return;
      } else if (currentPath.length === 0) {
        nextPath = [tile];
      } else if (areAdjacent(currentPath[currentPath.length - 1], tile)) {
        nextPath = [...currentPath, tile];
      }

      if (!nextPath) {
        return;
      }

      updatePath(nextPath);
      play("tile");
    },
    [play, updatePath]
  );

  const startNewRound = useCallback(() => {
    const nextRound = createRound(dictionary);

    setRound(nextRound);
    setFoundWords([]);
    clearPath();
    setTypedWord("");
    setTimeLeft(ROUND_SECONDS);
    finishSoundPlayedRef.current = false;
    setIsPaused(false);
    play("new");
    pushToast("New board", "neutral");
  }, [clearPath, dictionary, play, pushToast]);

  const resetRound = useCallback(() => {
    setFoundWords([]);
    clearPath();
    setTypedWord("");
    setTimeLeft(ROUND_SECONDS);
    finishSoundPlayedRef.current = false;
    setIsPaused(false);
    play("reset");
    pushToast("Round reset", "neutral");
  }, [clearPath, play, pushToast]);

  const togglePause = useCallback(() => {
    setIsPaused((paused) => {
      play(paused ? "resume" : "pause");

      return !paused;
    });
  }, [play]);

  const submitWord = useCallback(
    (value: string, options: { clearPathOnInvalid?: boolean } = {}) => {
      const word = normalizeWord(value);
      const rejectWord = (message: string) => {
        play("invalid");
        pushToast(message, "warning");

        if (options.clearPathOnInvalid) {
          clearPath();
        }
      };

      if (isPaused) {
        rejectWord("Paused");
        return;
      }

      if (isFinished) {
        rejectWord("Time");
        return;
      }

      if (word.length < 3) {
        rejectWord("Too short");
        return;
      }

      if (foundWordSet.has(word)) {
        rejectWord("Already found");
        clearPath();
        setTypedWord("");
        return;
      }

      if (!dictionary.words.has(word)) {
        rejectWord("Not in dictionary");
        return;
      }

      if (!isWordOnBoard(round.board, word)) {
        rejectWord("Not on board");
        return;
      }

      const points = scoreWord(word);

      setFoundWords((currentWords) => [
        {
          score: points,
          seconds: ROUND_SECONDS - timeLeft,
          word
        },
        ...currentWords
      ]);
      clearPath();
      setTypedWord("");
      play("valid");
      pushToast(`+${points} ${word}`, "good");
    },
    [clearPath, dictionary.words, foundWordSet, isFinished, isPaused, play, pushToast, round.board, timeLeft]
  );

  const handleBoardPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isPaused || isFinished) {
      return;
    }

    const tile = tileFromElement(event.target as Element | null);

    if (!tile) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerIdRef.current = event.pointerId;
    isDraggingRef.current = true;
    setTypedWord("");
    updatePath([tile]);
    play("tile");
  };

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || activePointerIdRef.current !== event.pointerId) {
        return;
      }

      event.preventDefault();

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      activePointerIdRef.current = null;
      isDraggingRef.current = false;

      const selectedWord = wordFromPath(pathRef.current);

      if (selectedWord.length >= 3) {
        submitWord(selectedWord, { clearPathOnInvalid: true });
      } else {
        clearPath();
      }
    },
    [clearPath, submitWord]
  );

  const cancelDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || activePointerIdRef.current !== event.pointerId) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      activePointerIdRef.current = null;
      isDraggingRef.current = false;
      clearPath();
    },
    [clearPath]
  );

  const handleBoardPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || activePointerIdRef.current !== event.pointerId) {
      return;
    }

    const tile = tileFromElement(document.elementFromPoint(event.clientX, event.clientY));

    if (!tile) {
      return;
    }

    event.preventDefault();
    addTileToPath(tile);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitWord(typedWord || wordFromPath(pathRef.current) || currentWord);
  };

  return (
    <main className="game-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">WordWeb</p>
          <h1>Boggle</h1>
        </div>
        <div className="topbar-actions" aria-label="Round controls">
          <button className="icon-button" onClick={resetRound} title="Reset round" type="button">
            <RotateCcw aria-hidden="true" size={20} />
          </button>
          <button className="icon-button" onClick={startNewRound} title="New board" type="button">
            <Shuffle aria-hidden="true" size={20} />
          </button>
          <button
            aria-label={isMuted ? "Turn sound on" : "Mute sound"}
            aria-pressed={!isMuted}
            className={classNames("icon-button", !isMuted && "sound-on")}
            onClick={toggleMuted}
            title={isMuted ? "Turn sound on" : "Mute sound"}
            type="button"
          >
            {isMuted ? <VolumeX aria-hidden="true" size={20} /> : <Volume2 aria-hidden="true" size={20} />}
          </button>
          <button
            className="icon-button strong"
            disabled={isFinished}
            onClick={togglePause}
            title={isPaused ? "Resume" : "Pause"}
            type="button"
          >
            {isPaused ? <Play aria-hidden="true" size={20} /> : <Pause aria-hidden="true" size={20} />}
          </button>
        </div>
      </header>

      <section className="game-grid">
        <aside className="status-panel" aria-label="Round status">
          <div className="metric-row">
            <div className="metric">
              <Clock3 aria-hidden="true" size={18} />
              <span>Time</span>
              <strong>{formatTime(timeLeft)}</strong>
            </div>
            <div className="metric">
              <Trophy aria-hidden="true" size={18} />
              <span>Score</span>
              <strong>{totalScore}</strong>
            </div>
          </div>

          <div className="progress-block">
            <div>
              <span>Found</span>
              <strong>
                {foundWords.length}/{round.answers.length}
              </strong>
            </div>
            <progress aria-label="Found words progress" max={100} value={progress} />
          </div>

          <dl className="detail-list">
            <div>
              <dt>Longest</dt>
              <dd>{longestWord || "-"}</dd>
            </div>
            <div>
              <dt>Best left</dt>
              <dd>{isFinished ? missingWords[0] || "-" : "-"}</dd>
            </div>
            <div>
              <dt>Potential</dt>
              <dd>{round.answers.length}</dd>
            </div>
          </dl>

          {isFinished ? (
            <div className="endcap">
              <Sparkles aria-hidden="true" size={22} />
              <span>Round complete</span>
            </div>
          ) : null}
        </aside>

        <section className="board-stage" aria-label="Boggle board">
          <div className="current-word" aria-live="polite">
            <span>Current</span>
            <strong>{currentWord || typedWord.toUpperCase() || "-"}</strong>
          </div>

          <div className="board-frame">
            <div
              className="board"
              data-testid="boggle-board"
              onPointerCancel={cancelDrag}
              onPointerDown={handleBoardPointerDown}
              onPointerMove={handleBoardPointerMove}
              onPointerUp={finishDrag}
            >
              <svg aria-hidden="true" className="path-lines" viewBox="0 0 400 400">
                {path.length > 1 ? <polyline points={pathPoints} /> : null}
              </svg>

              {round.board.map((tile) => {
                const selectedIndex = path.findIndex((selectedTile) => selectedTile.index === tile.index);

                return (
                  <button
                    aria-label={`${tile.value} tile, row ${tile.row + 1}, column ${tile.col + 1}`}
                    className={classNames(
                      "tile",
                      tile.value === "QU" && "qu",
                      selectedIndex !== -1 && "selected",
                      selectedIndex === path.length - 1 && "last"
                    )}
                    data-tile-index={tile.index}
                    disabled={isPaused || isFinished}
                    key={tile.id}
                    type="button"
                  >
                    <span className="tile-letter">{tile.value}</span>
                    {selectedIndex !== -1 ? <span className="order-badge">{selectedIndex + 1}</span> : null}
                  </button>
                );
              })}

              {isPaused || isFinished ? (
                <div className="board-cover">
                  <strong>{isFinished ? "Time" : "Paused"}</strong>
                </div>
              ) : null}
            </div>

            <form className="word-form" onSubmit={handleSubmit}>
              <label className="sr-only" htmlFor="word-entry">
                Word
              </label>
              <input
                autoComplete="off"
                disabled={isPaused || isFinished}
                id="word-entry"
                inputMode="text"
                onChange={(event) => setTypedWord(normalizeWord(event.target.value))}
                placeholder="WORD"
                spellCheck={false}
                value={typedWord}
              />
              <button
                className="icon-button"
                disabled={isPaused || isFinished || (!currentWord && !typedWord)}
                onClick={() => {
                  clearPath();
                  setTypedWord("");
                  play("clear");
                }}
                title="Clear"
                type="button"
              >
                <X aria-hidden="true" size={20} />
              </button>
              <button
                className="icon-button submit"
                disabled={isPaused || isFinished || (!currentWord && !typedWord)}
                title="Check word"
                type="submit"
              >
                <Check aria-hidden="true" size={20} />
              </button>
            </form>
          </div>

          <div className={classNames("toast", toast.kind)} key={toast.id} role="status">
            {toast.text}
          </div>
        </section>

        <aside className="word-panel" aria-label="Found words">
          <div className="panel-heading">
            <h2>Found</h2>
            <span>{foundWords.length}</span>
          </div>

          {foundWords.length > 0 ? (
            <ul className="word-list">
              {foundWords.map((word) => (
                <li className="word-chip" key={`${word.word}-${word.seconds}`}>
                  <strong>{word.word}</strong>
                  <span>{word.score}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">No words yet</div>
          )}

          {isFinished ? (
            <div className="answers">
              <div className="panel-heading">
                <h2>Best Missing</h2>
                <span>{missingWords.length}</span>
              </div>
              <ol>
                {missingWords.slice(0, 12).map((word) => (
                  <li key={word}>
                    <span>{word}</span>
                    <strong>{scoreWord(word)}</strong>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </aside>
      </section>
    </main>
  );
}
