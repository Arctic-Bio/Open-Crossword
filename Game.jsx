import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Lightbulb, RefreshCw, Trophy, AlertCircle, CheckCircle2, Sparkles, Plus, ChevronRight, Settings2 } from 'lucide-react';

// --- Configuration & Constants ---
const THEMES = [
  { name: "Nature", topics: ["nature", "forest", "wildlife", "ecology", "plants", "animals", "environment", "ocean", "mountain"] },
  { name: "Space", topics: ["space", "astronomy", "planets", "cosmos", "galaxy", "stars", "universe", "rocket", "orbit"] },
  { name: "Food", topics: ["cuisine", "cooking", "ingredients", "dining", "baking", "spices", "kitchen", "recipe", "fruit"] },
  { name: "Technology", topics: ["computing", "digital", "internet", "robotics", "software", "ai", "hardware", "network", "code"] },
  { name: "Geography", topics: ["geography", "landscape", "cities", "continents", "oceans", "maps", "travel", "world", "country"] },
  { name: "Music", topics: ["music", "melody", "instruments", "rhythm", "jazz", "orchestra", "song", "sound", "band"] },
  { name: "Sports", topics: ["athletics", "stadium", "competition", "fitness", "soccer", "tennis", "ball", "game", "team"] },
  { name: "Science", topics: ["laboratory", "physics", "chemistry", "biology", "genetics", "energy", "experiment", "formula"] }
];

const SIZE_CONFIGS = {
  tiny: { label: "Tiny", minWords: 5, maxWords: 6, gridDimension: 10 },
  bite: { label: "Bite-sized", minWords: 9, maxWords: 12, gridDimension: 13 },
  normal: { label: "Normal", minWords: 16, maxWords: 19, gridDimension: 16 },
  large: { label: "Large", minWords: 22, maxWords: 29, gridDimension: 22 },
  massive: { label: "Massive", minWords: 40, maxWords: 51, gridDimension: 28 }
};

// --- Procedural Generation Logic ---

async function fetchWordsForTheme(theme, targetCount) {
  // Use a variety of related topics to fill the word pool
  const topicList = [...theme.topics].sort(() => 0.5 - Math.random());
  let allWords = [];
  const seenWords = new Set();

  // Helper to filter and add words
  const processData = (data) => {
    data.forEach(item => {
      const word = item.word.toUpperCase();
      if (
        !word.includes(" ") && 
        !word.includes("-") &&
        word.length >= 3 && 
        word.length <= 10 &&
        item.defs && item.defs.length > 0 &&
        !seenWords.has(word)
      ) {
        seenWords.add(word);
        allWords.push({
          word: word,
          clue: item.defs[0].split('\t')[1] || item.defs[0]
        });
      }
    });
  };

  // 1. Primary Attempt: Fetch across multiple related topics simultaneously
  const fetchPromises = topicList.slice(0, 3).map(topic => 
    fetch(`https://api.datamuse.com/words?topics=${topic}&md=d&max=100`)
      .then(res => res.ok ? res.json() : [])
      .catch(() => [])
  );

  const results = await Promise.all(fetchPromises);
  results.forEach(processData);

  // 2. Fallback: If still not enough, try broader "means like" search
  if (allWords.length < targetCount) {
    const fallbackTopic = theme.name.toLowerCase();
    try {
      const res = await fetch(`https://api.datamuse.com/words?ml=${fallbackTopic}&md=d&max=150`);
      if (res.ok) {
        const data = await res.json();
        processData(data);
      }
    } catch (e) {}
  }

  // 3. Last Resort: Generic common words if the topic is too niche for the requested size
  if (allWords.length < targetCount) {
    try {
      const res = await fetch(`https://api.datamuse.com/words?sp=????*&md=d&max=100`);
      if (res.ok) {
        const data = await res.json();
        processData(data);
      }
    } catch (e) {}
  }

  if (allWords.length >= targetCount) {
    return allWords.sort(() => 0.5 - Math.random()).slice(0, targetCount);
  }
  
  // Only return what we found if it's a reasonable amount, otherwise fail
  return allWords.length >= 5 ? allWords : null;
}

const generateCrosswordLayout = (wordsData, gridSize) => {
  let grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
  const placedWords = [];
  const sortedWords = [...wordsData].sort((a, b) => b.word.length - a.word.length);

  const canPlace = (word, row, col, isVertical) => {
    if (isVertical && row + word.length > gridSize) return false;
    if (!isVertical && col + word.length > gridSize) return false;

    let intersections = 0;
    for (let i = 0; i < word.length; i++) {
      const r = isVertical ? row + i : row;
      const c = isVertical ? col : col + i;
      const char = word[i];
      if (grid[r][c] !== null && grid[r][c] !== char) return false;
      if (grid[r][c] === char) intersections++;
      
      if (grid[r][c] === null) {
        if (isVertical) {
          if (c > 0 && grid[r][c - 1] !== null) return false;
          if (c < gridSize - 1 && grid[r][c + 1] !== null) return false;
        } else {
          if (r > 0 && grid[r - 1][c] !== null) return false;
          if (r < gridSize - 1 && grid[r + 1][c] !== null) return false;
        }
      }
    }
    if (isVertical) {
      if (row > 0 && grid[row - 1][col] !== null) return false;
      if (row + word.length < gridSize && grid[row + word.length][col] !== null) return false;
    } else {
      if (col > 0 && grid[row][col - 1] !== null) return false;
      if (col + word.length < gridSize && grid[row][col + word.length] !== null) return false;
    }
    return placedWords.length === 0 || intersections > 0;
  };

  const place = (wordObj, row, col, isVertical) => {
    for (let i = 0; i < wordObj.word.length; i++) {
      const r = isVertical ? row + i : row;
      const c = isVertical ? col : col + i;
      grid[r][c] = wordObj.word[i];
    }
    placedWords.push({ ...wordObj, row, col, isVertical });
  };

  for (const wordObj of sortedWords) {
    let bestMoves = [];
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        for (let v of [true, false]) {
          if (canPlace(wordObj.word, r, c, v)) {
            let score = 0;
            for(let i=0; i<wordObj.word.length; i++) {
              if (grid[v ? r+i : r][v ? c : c+i] !== null) score++;
            }
            bestMoves.push({ r, c, v, score });
          }
        }
      }
    }
    if (bestMoves.length > 0) {
      bestMoves.sort((a, b) => b.score - a.score);
      const topMoves = bestMoves.filter(m => m.score === bestMoves[0].score);
      const move = topMoves[Math.floor(Math.random() * topMoves.length)];
      place(wordObj, move.r, move.c, move.v);
    }
  }

  const numberedGrid = grid.map(row => row.map(cell => ({ char: cell, num: null })));
  const finalClues = { across: [], down: [] };
  let currentNum = 1;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (!grid[r][c]) continue;
      const isStartOfAcross = (c === 0 || !grid[r][c - 1]) && (c + 1 < gridSize && grid[r][c + 1]);
      const isStartOfDown = (r === 0 || !grid[r - 1][c]) && (r + 1 < gridSize && grid[r + 1][c]);
      if (isStartOfAcross || isStartOfDown) {
        numberedGrid[r][c].num = currentNum;
        if (isStartOfAcross) {
          const w = placedWords.find(pw => pw.row === r && pw.col === c && !pw.isVertical);
          if (w) finalClues.across.push({ ...w, num: currentNum, len: w.word.length });
        }
        if (isStartOfDown) {
          const w = placedWords.find(pw => pw.row === r && pw.col === c && pw.isVertical);
          if (w) finalClues.down.push({ ...w, num: currentNum, len: w.word.length });
        }
        currentNum++;
      }
    }
  }
  return { grid: numberedGrid, clues: finalClues, size: gridSize, wordCount: placedWords.length };
};

export default function App() {
  const [gameState, setGameState] = useState('setup');
  const [selectedSize, setSelectedSize] = useState('bite');
  const [theme, setTheme] = useState("");
  const [crossword, setCrossword] = useState(null);
  const [userGrid, setUserGrid] = useState([]);
  const [selectedCell, setSelectedCell] = useState({ r: 0, c: 0 });
  const [direction, setDirection] = useState('across'); 
  const [errorStats, setErrorStats] = useState({ received: 0, needed: 0 });
  const [showErrors, setShowErrors] = useState(false);

  const checkWinCondition = useCallback((gridToCheck, layout) => {
    return gridToCheck.every((row, ri) => 
      row.every((cell, ci) => !layout.grid[ri][ci].char || cell === layout.grid[ri][ci].char)
    );
  }, []);

  const startNewGame = useCallback(async (sizeKey = selectedSize) => {
    setGameState('loading');
    setShowErrors(false);
    
    const config = SIZE_CONFIGS[sizeKey];
    const t = THEMES[Math.floor(Math.random() * THEMES.length)];
    setTheme(t.name);

    const words = await fetchWordsForTheme(t, config.maxWords);
    const count = words ? words.length : 0;

    if (!words || count < Math.min(config.minWords, 5)) {
      setErrorStats({ received: count, needed: config.minWords });
      setGameState('error');
      return;
    }

    const layout = generateCrosswordLayout(words, config.gridDimension);
    
    // Check if the generator actually managed to link enough words
    // We allow a slightly lower threshold than requested if the layout was tight
    if (layout.wordCount < Math.min(config.minWords, 5)) {
      startNewGame(sizeKey); 
      return;
    }

    setCrossword(layout);
    setUserGrid(layout.grid.map(row => row.map(cell => cell.char ? "" : null)));
    
    outer: for (let r = 0; r < layout.size; r++) {
      for (let c = 0; c < layout.size; c++) {
        if (layout.grid[r][c].char) {
          setSelectedCell({ r, c });
          break outer;
        }
      }
    }
    setGameState('playing');
  }, [selectedSize]);

  const handleCellClick = (r, c) => {
    if (selectedCell.r === r && selectedCell.c === c) {
      setDirection(prev => prev === 'across' ? 'down' : 'across');
    } else {
      setSelectedCell({ r, c });
    }
  };

  const handleKeyDown = (e) => {
    if (gameState !== 'playing') return;
    const { r, c } = selectedCell;

    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      const newGrid = [...userGrid.map(row => [...row])];
      newGrid[r][c] = e.key.toUpperCase();
      setUserGrid(newGrid);
      setShowErrors(false);
      
      let nr = r, nc = c;
      if (direction === 'across') nc++; else nr++;
      if (nr < crossword.size && nc < crossword.size && crossword.grid[nr][nc].char) {
        setSelectedCell({ r: nr, c: nc });
      }
      if (checkWinCondition(newGrid, crossword)) setGameState('won');

    } else if (e.key === 'Backspace') {
      const newGrid = [...userGrid.map(row => [...row])];
      if (newGrid[r][c] === "") {
        let nr = r, nc = c;
        if (direction === 'across') nc--; else nr--;
        if (nr >= 0 && nc >= 0 && crossword.grid[nr][nc].char) {
          setSelectedCell({ r: nr, c: nc });
          newGrid[nr][nc] = "";
        }
      } else {
        newGrid[r][c] = "";
      }
      setUserGrid(newGrid);
      setShowErrors(false);
    } else if (e.key.startsWith('Arrow')) {
      let nr = r, nc = c;
      if (e.key === 'ArrowRight') nc++;
      if (e.key === 'ArrowLeft') nc--;
      if (e.key === 'ArrowDown') nr++;
      if (e.key === 'ArrowUp') nr--;
      if (nr >= 0 && nr < crossword.size && nc >= 0 && nc < crossword.size && crossword.grid[nr][nc].char) {
        setSelectedCell({ r: nr, c: nc });
      }
    } else if (e.key === ' ') {
      setDirection(d => d === 'across' ? 'down' : 'across');
    }
  };

  const activeClue = crossword ? [...crossword.clues.across, ...crossword.clues.down].find(cl => {
    if (direction === 'across') return cl.row === selectedCell.r && selectedCell.c >= cl.col && selectedCell.c < cl.col + cl.len && !cl.isVertical;
    return cl.col === selectedCell.c && selectedCell.r >= cl.row && selectedCell.r < cl.row + cl.len && cl.isVertical;
  }) : null;

  const solveCurrentWord = () => {
    if (!activeClue) return;
    const newGrid = [...userGrid.map(row => [...row])];
    for (let i = 0; i < activeClue.len; i++) {
      const r = activeClue.isVertical ? activeClue.row + i : activeClue.row;
      const c = activeClue.isVertical ? activeClue.col : activeClue.col + i;
      newGrid[r][c] = crossword.grid[r][c].char;
    }
    setUserGrid(newGrid);
    setShowErrors(false);
    if (checkWinCondition(newGrid, crossword)) setGameState('won');
  };

  const revealLetter = () => {
    const { r, c } = selectedCell;
    const newGrid = [...userGrid.map(row => [...row])];
    newGrid[r][c] = crossword.grid[r][c].char;
    setUserGrid(newGrid);
    setShowErrors(false);
    if (checkWinCondition(newGrid, crossword)) setGameState('won');
  };

  const checkErrors = () => {
    setShowErrors(true);
    setTimeout(() => setShowErrors(false), 3000);
  };

  if (gameState === 'setup') {
      return (
          <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
              <div className="max-w-md w-full bg-white rounded-[48px] p-8 shadow-2xl shadow-slate-200 border border-slate-100">
                  <div className="text-center mb-8">
                      <div className="w-16 h-16 bg-indigo-600 rounded-2xl rotate-3 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                          <Settings2 className="text-white" size={32} />
                      </div>
                      <h1 className="text-3xl font-black text-slate-900 tracking-tighter text-center">Open Cross</h1>
                      <p className="text-slate-500 mt-1">Select your difficulty</p>
                  </div>

                  <div className="space-y-3 mb-8">
                      {Object.entries(SIZE_CONFIGS).map(([key, config]) => (
                          <button
                            key={key}
                            onClick={() => setSelectedSize(key)}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${selectedSize === key ? 'border-indigo-600 bg-indigo-50 ring-4 ring-indigo-50' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                          >
                              <div className="text-left">
                                  <div className={`font-bold ${selectedSize === key ? 'text-indigo-900' : 'text-slate-700'}`}>{config.label}</div>
                                  <div className="text-xs text-slate-400 font-medium">{config.minWords}-{config.maxWords} words</div>
                              </div>
                              {selectedSize === key && <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white"><ChevronRight size={14} /></div>}
                          </button>
                      ))}
                  </div>

                  <button 
                    onClick={() => startNewGame()}
                    className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-lg hover:bg-slate-800 shadow-xl transition-all active:scale-[0.98]"
                  >
                      Start Game
                  </button>
              </div>
          </div>
      );
  }

  if (gameState === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-900 font-black text-xl tracking-tight">Generating {theme} Puzzle...</p>
        <p className="text-slate-400 text-sm mt-1 animate-pulse italic">Scaling to {SIZE_CONFIGS[selectedSize].label} size</p>
      </div>
    );
  }

  if (gameState === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 p-6 text-center max-w-sm mx-auto">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">API Connection Issue</h2>
            <p className="text-slate-500 text-sm leading-relaxed mb-4">
                We couldn't fetch enough word data for <span className="text-indigo-600 font-semibold">"{theme}"</span> at this time.
            </p>
        </div>
        <button onClick={() => setGameState('setup')} className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold">Try Different Settings</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 flex flex-col items-center outline-none" onKeyDown={handleKeyDown} tabIndex="0">
      <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-8 items-start justify-center">
        
        <div className="flex-1 flex flex-col gap-4 w-full">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tighter leading-none">OPEN CROSS</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-widest">{theme}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{SIZE_CONFIGS[selectedSize].label}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setGameState('setup')} 
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all"
              >
                <Plus size={14} /> New Puzzle
              </button>
              <button 
                onClick={checkErrors} 
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 shadow-sm transition-all"
              >
                <CheckCircle2 size={14} /> Check Errors
              </button>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-8 rounded-[40px] shadow-sm border border-slate-200 overflow-auto max-h-[70vh] flex items-center justify-center">
            <div 
              className="grid gap-px bg-slate-200 border border-slate-200 w-fit"
              style={{ gridTemplateColumns: `repeat(${crossword.size}, 1fr)` }}
            >
              {userGrid.map((row, r) => row.map((cell, c) => {
                const isBlack = crossword.grid[r][c].char === null;
                const isSelected = selectedCell.r === r && selectedCell.c === c;
                const isError = showErrors && cell !== "" && cell !== crossword.grid[r][c].char;
                
                const isInSelectedWord = activeClue && (
                  activeClue.isVertical 
                  ? (c === activeClue.col && r >= activeClue.row && r < activeClue.row + activeClue.len)
                  : (r === activeClue.row && c >= activeClue.col && c < activeClue.col + activeClue.len)
                );

                const cellSizeClass = crossword.size > 22 ? 'w-5 h-5 sm:w-6 sm:h-6 text-[10px]' : crossword.size > 16 ? 'w-6 h-6 sm:w-8 sm:h-8 text-xs' : 'w-8 h-8 sm:w-11 sm:h-11 text-sm sm:text-lg';

                return (
                  <div 
                    key={`${r}-${c}`}
                    onClick={() => isBlack ? null : handleCellClick(r, c)}
                    className={`relative ${cellSizeClass} flex items-center justify-center font-bold select-none cursor-pointer transition-all duration-200
                      ${isBlack ? 'bg-slate-900' : 'bg-white'}
                      ${isSelected ? 'bg-indigo-600 text-white z-20 scale-105 shadow-xl' : isInSelectedWord ? 'bg-indigo-50 text-indigo-900' : ''}
                      ${isError ? 'bg-red-500 text-white animate-pulse' : ''}
                    `}
                  >
                    {crossword.grid[r][c].num && (
                      <span className={`absolute top-0.5 left-0.5 text-[6px] sm:text-[9px] leading-none font-black ${isSelected || isError ? 'text-white/70' : 'text-indigo-300'}`}>
                        {crossword.grid[r][c].num}
                      </span>
                    )}
                    {cell}
                  </div>
                );
              }))}
            </div>
          </div>

          <div className="bg-indigo-600 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row gap-4 items-center">
            <div className="bg-white/20 w-12 h-12 shrink-0 rounded-2xl font-black text-xl flex items-center justify-center">{activeClue?.num || '-'}</div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="text-[10px] opacity-70 font-black uppercase tracking-widest mb-1">{direction} • {activeClue?.len || 0} Letters</div>
              <p className="font-medium text-sm sm:text-lg leading-tight italic">{activeClue?.clue || "Select a square to begin"}</p>
            </div>
            <div className="flex gap-2 shrink-0">
                <button 
                    onClick={solveCurrentWord} 
                    className="bg-white text-indigo-600 p-3 rounded-2xl hover:bg-indigo-50 transition-all shadow-md active:scale-95" 
                    title="Solve Word"
                >
                    <Sparkles size={20} />
                </button>
                <button 
                    onClick={revealLetter} 
                    className="bg-indigo-500 text-white border border-indigo-400 p-3 rounded-2xl hover:bg-indigo-400 transition-all active:scale-95" 
                    title="Reveal Letter"
                >
                    <Lightbulb size={20} />
                </button>
            </div>
          </div>
        </div>

        <div className="lg:w-96 w-full space-y-4 lg:sticky lg:top-8 shrink-0">
          <div className="bg-white rounded-[40px] shadow-sm border border-slate-200 overflow-hidden h-[80vh] flex flex-col">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <span className="font-black text-slate-800 text-sm uppercase tracking-widest">Clues</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">{crossword.wordCount} words</span>
            </div>
            <div className="overflow-y-auto p-6 space-y-8 scrollbar-hide">
              <div>
                <h3 className="text-xs font-black text-indigo-600 mb-4 uppercase tracking-tighter border-b border-indigo-50 pb-2">Across</h3>
                <div className="grid gap-1">
                    {crossword.clues.across.map(cl => (
                    <div key={cl.num} className={`group py-3 px-4 rounded-2xl text-sm cursor-pointer transition-all ${activeClue === cl && direction === 'across' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-600'}`}
                        onClick={() => { setSelectedCell({r: cl.row, c: cl.col}); setDirection('across'); }}>
                        <span className={`font-black mr-3 transition-colors ${activeClue === cl && direction === 'across' ? 'text-white' : 'text-indigo-300'}`}>{cl.num}</span> 
                        <span className="leading-snug">{cl.clue}</span>
                    </div>
                    ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-black text-indigo-600 mb-4 uppercase tracking-tighter border-b border-indigo-50 pb-2">Down</h3>
                <div className="grid gap-1">
                    {crossword.clues.down.map(cl => (
                    <div key={cl.num} className={`group py-3 px-4 rounded-2xl text-sm cursor-pointer transition-all ${activeClue === cl && direction === 'down' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-600'}`}
                        onClick={() => { setSelectedCell({r: cl.row, c: cl.col}); setDirection('down'); }}>
                        <span className={`font-black mr-3 transition-colors ${activeClue === cl && direction === 'down' ? 'text-white' : 'text-indigo-300'}`}>{cl.num}</span> 
                        <span className="leading-snug">{cl.clue}</span>
                    </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {gameState === 'won' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[56px] p-12 max-w-sm w-full text-center shadow-2xl animate-in zoom-in duration-300">
            <div className="w-24 h-24 bg-yellow-400 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-yellow-100 rotate-6">
              <Trophy className="text-white" size={48} />
            </div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Victory!</h2>
            <p className="text-slate-500 mt-3 mb-10 leading-relaxed font-medium">You dominated the <strong>{SIZE_CONFIGS[selectedSize].label}</strong> grid.</p>
            <button 
                onClick={() => setGameState('setup')} 
                className="w-full bg-slate-900 text-white py-5 rounded-[28px] font-black text-lg hover:bg-slate-800 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
            >
                Next Challenge <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
