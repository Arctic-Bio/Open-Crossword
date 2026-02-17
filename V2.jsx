import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Trophy, Sparkles, ChevronRight, Settings2, ArrowRight, ArrowDown, Lightbulb, CheckCircle2, AlertCircle, Trash2, Eye, PencilLine } from 'lucide-react';

// --- Configuration & Constants ---
const THEMES = [
  { name: "Nature", topics: ["nature", "wildlife", "environment", "forest", "ocean"] },
  { name: "Space", topics: ["astronomy", "planets", "cosmos", "galaxy", "nasa"] },
  { name: "Food", topics: ["cuisine", "cooking", "ingredients", "fruit", "baking"] },
  { name: "Tech", topics: ["computing", "digital", "internet", "robotics", "code"] },
  { name: "Places", topics: ["geography", "cities", "continents", "mountains", "travel"] },
  { name: "Music", topics: ["music", "instruments", "rhythm", "jazz", "opera"] },
  { name: "Sports", topics: ["athletics", "stadium", "competition", "soccer", "fitness"] },
  { name: "Science", topics: ["physics", "chemistry", "biology", "genetics", "lab"] }
];

const SIZE_CONFIGS = {
  tiny:    { label: "Tiny",    targetWords: 8,  gridDimension: 13 },
  bite:    { label: "Bite",    targetWords: 12, gridDimension: 15 },
  normal:  { label: "Normal",  targetWords: 18, gridDimension: 18 },
  large:   { label: "Large",   targetWords: 25, gridDimension: 22 },
};

// --- Helper Functions ---

const fetchWordsForTheme = async (themeName, customTopic, targetCount) => {
  // Use custom topic if provided, otherwise pick from theme list
  const selectedTheme = THEMES.find(t => t.name === themeName);
  const topic = customTopic || (selectedTheme ? selectedTheme.topics[Math.floor(Math.random() * selectedTheme.topics.length)] : "general");
  const poolSize = targetCount + 50; 
  
  const urls = [
    `https://api.datamuse.com/words?ml=${encodeURIComponent(topic)}&md=d&max=100`,
    `https://api.datamuse.com/words?topics=${encodeURIComponent(topic)}&md=d&max=100`
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      
      const filtered = data
        .filter(item => {
          const word = item.word.toUpperCase();
          // Filter out phrases/spaces and ensure we have a definition
          return /^[A-Z]{3,10}$/.test(word) && item.defs && item.defs.length > 0;
        })
        .map(item => ({
          word: item.word.toUpperCase(),
          clue: item.defs[0].split('\t').pop().trim().replace(/^\w/, c => c.toUpperCase())
        }));

      if (filtered.length >= 5) return filtered.slice(0, poolSize);
    } catch (e) { console.error(e); }
  }
  
  return [{ word: "GALAXY", clue: "A system of millions or billions of stars" }];
};

const attemptLayout = (words, targetCount, size) => {
  const grid = Array(size).fill(null).map(() => Array(size).fill(null));
  const placedWords = [];

  const getCharAt = (r, c) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return undefined;
    return grid[r][c];
  };

  const canPlace = (word, r, c, dir) => {
    if (dir === 'across' && (c < 0 || c + word.length > size)) return false;
    if (dir === 'down' && (r < 0 || r + word.length > size)) return false;

    // --- LINE EXCLUSION RULE ---
    if (dir === 'across' && placedWords.some(pw => pw.dir === 'across' && pw.r === r)) return false;
    if (dir === 'down' && placedWords.some(pw => pw.dir === 'down' && pw.c === c)) return false;

    const dr = dir === 'across' ? 0 : 1;
    const dc = dir === 'across' ? 1 : 0;
    const pr = dir === 'across' ? 1 : 0; 
    const pc = dir === 'across' ? 0 : 1; 
    
    let intersections = 0;

    if (getCharAt(r - dr, c - dc) !== null) return false;
    if (getCharAt(r + dr * word.length, c + dc * word.length) !== null) return false;

    for (let i = 0; i < word.length; i++) {
      const currR = r + (i * dr);
      const currC = c + (i * dc);
      const existing = getCharAt(currR, currC);

      if (existing !== null) {
        if (existing !== word[i]) return false;
        intersections++;
      } else {
        if (getCharAt(currR - pr, currC - pc) !== null) return false;
        if (getCharAt(currR + pr, currC + pc) !== null) return false;
      }
    }

    return (intersections > 0 || placedWords.length === 0) ? { possible: true, intersections } : false;
  };

  const place = (wordObj, r, c, dir, intersections) => {
    const cells = [];
    for (let i = 0; i < wordObj.word.length; i++) {
      const cr = dir === 'across' ? r : r + i;
      const cc = dir === 'across' ? c + i : c;
      grid[cr][cc] = wordObj.word[i];
      cells.push({ r: cr, c: cc });
    }
    placedWords.push({ ...wordObj, r, c, dir, cells, intersections });
  };

  const pool = [...words].sort((a, b) => b.word.length - a.word.length);
  const first = pool.shift();
  if (!first) return null;
  
  place(first, Math.floor(size / 2), Math.floor((size - first.word.length) / 2), 'across', 0);

  for (let cycle = 0; cycle < 15; cycle++) { 
    for (let i = 0; i < pool.length; i++) {
      if (placedWords.length >= targetCount) break;
      const wordObj = pool[i];
      let candidates = [];

      for (const pw of placedWords) {
        for (let idxP = 0; idxP < pw.word.length; idxP++) {
          for (let idxW = 0; idxW < wordObj.word.length; idxW++) {
            if (pw.word[idxP] === wordObj.word[idxW]) {
              const dir = pw.dir === 'across' ? 'down' : 'across';
              const r = dir === 'across' ? pw.r + idxP : pw.r + idxP - idxW;
              const c = dir === 'across' ? pw.c + idxP - idxW : pw.c + idxP;
              
              const check = canPlace(wordObj.word, r, c, dir);
              if (check) {
                candidates.push({ r, c, dir, intersections: check.intersections });
              }
            }
          }
        }
      }
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.intersections - a.intersections);
        const best = candidates[0];
        place(wordObj, best.r, best.c, best.dir, best.intersections);
        pool.splice(i, 1);
        i--;
      }
    }
  }

  if (placedWords.length < 3) return null;

  const finalGrid = Array(size).fill(null).map(() => Array(size).fill({ char: null, num: null }));
  let numCounter = 1;
  const numMap = new Map();

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const startsAcross = placedWords.some(w => w.r === r && w.c === c && w.dir === 'across');
      const startsDown = placedWords.some(w => w.r === r && w.c === c && w.dir === 'down');
      if (startsAcross || startsDown) {
        numMap.set(`${r}-${c}`, numCounter++);
      }
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) {
        finalGrid[r][c] = { char: grid[r][c], num: numMap.get(`${r}-${c}`) || null };
      }
    }
  }

  return {
    grid: finalGrid,
    placedWords: placedWords.map(w => ({ ...w, num: numMap.get(`${w.r}-${w.c}`) })).sort((a, b) => a.num - b.num),
    size
  };
};

const generateBestCrossword = (wordPool, targetCount, size) => {
  let best = null;
  let maxScore = -1;
  for (let i = 0; i < 40; i++) {
    const res = attemptLayout([...wordPool].sort(() => Math.random() - 0.5), targetCount, size);
    if (res) {
      const score = res.placedWords.length * 100 + res.placedWords.reduce((a, b) => a + b.intersections, 0);
      if (score > maxScore) {
        maxScore = score;
        best = res;
      }
    }
  }
  return best;
};

export default function App() {
  const [gameState, setGameState] = useState('setup');
  const [selectedSize, setSelectedSize] = useState('bite');
  const [theme, setTheme] = useState(THEMES[0].name);
  const [customTopic, setCustomTopic] = useState("");
  const [crossword, setCrossword] = useState(null);
  const [userGrid, setUserGrid] = useState([]);
  const [selectedCell, setSelectedCell] = useState({ r: 0, c: 0 });
  const [direction, setDirection] = useState('across');
  const [cellSize, setCellSize] = useState(40);
  const [showErrors, setShowErrors] = useState(false);
  const hiddenInputRef = useRef(null);

  useEffect(() => {
    const updateSize = () => {
      if (!crossword) return;
      const padding = window.innerWidth < 640 ? 40 : 120;
      const availableWidth = Math.min(window.innerWidth - padding, 800);
      setCellSize(Math.max(20, Math.floor(availableWidth / crossword.size)));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [crossword]);

  const startNewGame = useCallback(async () => {
    setGameState('loading');
    const config = SIZE_CONFIGS[selectedSize];
    const isCustom = theme === 'CUSTOM';
    const words = await fetchWordsForTheme(isCustom ? null : theme, isCustom ? customTopic : null, config.targetWords);
    const layout = generateBestCrossword(words, config.targetWords, config.gridDimension);
    
    if (layout) {
      setCrossword(layout);
      setUserGrid(Array(layout.size).fill(null).map(() => Array(layout.size).fill("")));
      setSelectedCell({ r: layout.placedWords[0].r, c: layout.placedWords[0].c });
      setDirection(layout.placedWords[0].dir);
      setGameState('playing');
      setShowErrors(false);
      setTimeout(() => hiddenInputRef.current?.focus(), 300);
    } else {
      setGameState('setup');
    }
  }, [selectedSize, theme, customTopic]);

  const handleCellClick = (r, c) => {
    if (!crossword.grid[r][c].char) return;
    if (selectedCell.r === r && selectedCell.c === c) {
      setDirection(d => d === 'across' ? 'down' : 'across');
    } else {
      setSelectedCell({ r, c });
      const availableDirections = crossword.placedWords.filter(w => w.cells.some(cell => cell.r === r && cell.c === c));
      if (availableDirections.length === 1) setDirection(availableDirections[0].dir);
    }
    hiddenInputRef.current?.focus();
  };

  const revealWord = (wordObj) => {
    const newGrid = [...userGrid.map(row => [...row])];
    wordObj.cells.forEach((cell, idx) => {
      newGrid[cell.r][cell.c] = wordObj.word[idx];
    });
    setUserGrid(newGrid);
    checkWinCondition(newGrid);
  };

  const checkWinCondition = (currentGrid) => {
    const isWon = currentGrid.every((row, r) => 
      row.every((cell, c) => !crossword.grid[r][c].char || cell === crossword.grid[r][c].char)
    );
    if (isWon) setGameState('won');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace') {
      const newGrid = [...userGrid];
      if (newGrid[selectedCell.r][selectedCell.c] === "") {
        const dr = direction === 'down' ? -1 : 0;
        const dc = direction === 'across' ? -1 : 0;
        const nr = selectedCell.r + dr, nc = selectedCell.c + dc;
        if (nr >= 0 && nr < crossword.size && nc >= 0 && nc < crossword.size && crossword.grid[nr][nc].char) {
          setSelectedCell({ r: nr, c: nc });
        }
      } else {
        newGrid[selectedCell.r][selectedCell.c] = "";
      }
      setUserGrid(newGrid);
    } else if (e.key.startsWith('Arrow')) {
      const map = { ArrowUp: [-1,0], ArrowDown: [1,0], ArrowLeft: [0,-1], ArrowRight: [0,1] };
      const [dr, dc] = map[e.key];
      let nr = selectedCell.r + dr, nc = selectedCell.c + dc;
      if (nr >= 0 && nr < crossword.size && nc >= 0 && nc < crossword.size && crossword.grid[nr][nc].char) {
        setSelectedCell({ r: nr, c: nc });
      }
    }
  };

  const handleInput = (e) => {
    const char = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
    if (!char) return;
    const newGrid = userGrid.map((row, r) => row.map((cell, c) => r === selectedCell.r && c === selectedCell.c ? char : cell));
    setUserGrid(newGrid);
    const dr = direction === 'down' ? 1 : 0, dc = direction === 'across' ? 1 : 0;
    const nr = selectedCell.r + dr, nc = selectedCell.c + dc;
    if (nr < crossword.size && nc < crossword.size && crossword.grid[nr][nc].char) setSelectedCell({ r: nr, c: nc });
    e.target.value = "";
    checkWinCondition(newGrid);
  };

  const activeClue = crossword?.placedWords.find(w => w.dir === direction && w.cells.some(c => c.r === selectedCell.r && c.c === selectedCell.c)) 
                   || crossword?.placedWords.find(w => w.cells.some(c => c.r === selectedCell.r && c.c === selectedCell.c));

  if (gameState === 'setup') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-white rounded-[3rem] p-8 shadow-2xl border border-slate-100 text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-100 rotate-6">
            <Sparkles className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter mb-1">OPEN CROSS</h1>
          <p className="text-slate-400 font-bold mb-8 uppercase text-[8px] tracking-[0.2em] italic">Custom Theme Engine</p>
          
          <div className="space-y-6 text-left">
            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Select Theme</label>
              <div className="grid grid-cols-3 gap-1.5">
                {THEMES.map(t => (
                  <button 
                    key={t.name} 
                    onClick={() => setTheme(t.name)} 
                    className={`py-2 px-1 rounded-xl text-[10px] font-black transition-all border-2 ${theme === t.name ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}
                  >
                    {t.name}
                  </button>
                ))}
                <button 
                  onClick={() => setTheme('CUSTOM')} 
                  className={`py-2 px-1 rounded-xl text-[10px] font-black transition-all border-2 flex items-center justify-center gap-1 ${theme === 'CUSTOM' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}
                >
                  <PencilLine size={12} /> Custom
                </button>
              </div>
            </div>

            {theme === 'CUSTOM' && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Describe your theme</label>
                <input 
                  type="text" 
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  placeholder="e.g. 90s Movies, Dinosaurs..."
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 transition-all shadow-inner placeholder:text-slate-300"
                />
              </div>
            )}

            <div>
              <label className="text-[9px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Difficulty Size</label>
              <div className="flex gap-2">
                {Object.entries(SIZE_CONFIGS).map(([id, cfg]) => (
                  <button 
                    key={id} 
                    onClick={() => setSelectedSize(id)} 
                    className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all border-2 ${selectedSize === id ? 'bg-slate-800 border-slate-800 text-white' : 'bg-slate-50 border-transparent text-slate-400'}`}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            <button 
              disabled={theme === 'CUSTOM' && !customTopic.trim()}
              onClick={startNewGame} 
              className={`w-full py-5 text-white rounded-[1.5rem] font-black text-lg mt-2 shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 ${theme === 'CUSTOM' ? 'bg-emerald-600 shadow-emerald-100 hover:bg-emerald-700' : 'bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700'} disabled:opacity-30 disabled:pointer-events-none`}
            >
              Generate <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <h2 className="text-xl font-black text-slate-800 tracking-widest uppercase animate-pulse">
          Indexing {theme === 'CUSTOM' ? customTopic : theme}...
        </h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans overflow-x-hidden">
      <input ref={hiddenInputRef} type="text" className="absolute opacity-0" onInput={handleInput} onKeyDown={handleKeyDown} autoCapitalize="characters" autoComplete="off" />
      
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
           <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'CUSTOM' ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
             <Sparkles size={16} className="text-white" />
           </div>
           <h1 className="text-sm font-black text-slate-800 tracking-tighter uppercase">
             {theme === 'CUSTOM' ? customTopic : theme} <span className={theme === 'CUSTOM' ? 'text-emerald-600' : 'text-indigo-600'}>Puzzle</span>
           </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowErrors(!showErrors)} className={`p-2.5 rounded-xl transition-all ${showErrors ? 'bg-red-500 text-white shadow-lg' : 'bg-slate-100 text-slate-500'}`}><AlertCircle size={18} /></button>
          <button onClick={() => setGameState('setup')} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200"><Settings2 size={18} /></button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row p-4 sm:p-10 gap-8 max-w-[1400px] mx-auto w-full items-start">
        <div className="flex-1 w-full flex flex-col gap-6">
          <div className="bg-white rounded-[2.5rem] shadow-xl p-3 sm:p-8 flex items-center justify-center overflow-auto border border-slate-100">
            <div className="grid bg-slate-900 p-1 border-4 border-slate-900 rounded-xl overflow-hidden shrink-0 shadow-2xl" style={{ gridTemplateColumns: `repeat(${crossword.size}, ${cellSize}px)`, gap: '1px' }}>
              {userGrid.map((row, r) => row.map((cell, c) => {
                const isBlack = !crossword.grid[r][c].char;
                const isSelected = selectedCell.r === r && selectedCell.c === c;
                const inWord = activeClue?.cells.some(cell => cell.r === r && cell.c === c);
                const isWrong = showErrors && cell !== "" && cell !== crossword.grid[r][c].char;
                const num = crossword.grid[r][c].num;

                return (
                  <div 
                    key={`${r}-${c}`} 
                    onClick={() => handleCellClick(r, c)} 
                    className={`relative flex items-center justify-center font-black transition-all duration-150 ${isBlack ? 'bg-slate-900' : 'bg-white cursor-pointer'}`} 
                    style={{ width: cellSize, height: cellSize }}
                  >
                    {!isBlack && (
                      <>
                        {inWord && !isSelected && <div className={`absolute inset-0 animate-pulse duration-1000 ${theme === 'CUSTOM' ? 'bg-emerald-50' : 'bg-indigo-50'}`} />}
                        {isSelected && <div className={`absolute inset-0 z-[2] ${theme === 'CUSTOM' ? 'bg-emerald-600' : 'bg-indigo-600'}`} />}
                        {num && <span className={`absolute top-0.5 left-0.5 text-[8px] sm:text-[9px] font-black leading-none z-[5] ${isSelected ? 'text-white' : 'text-slate-400'}`}>{num}</span>}
                        <span className={`relative z-10 transition-transform ${isSelected ? 'text-white scale-110' : 'text-slate-800'} ${isWrong ? 'text-red-500' : ''}`} style={{ fontSize: cellSize > 30 ? '1rem' : '0.8rem' }}>{cell}</span>
                      </>
                    )}
                  </div>
                );
              }))}
            </div>
          </div>

          <div className={`p-6 sm:p-10 rounded-[2rem] shadow-2xl flex flex-col sm:flex-row items-center gap-6 cursor-pointer text-white transition-all ${theme === 'CUSTOM' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100'}`} onClick={() => hiddenInputRef.current?.focus()}>
             <div className="p-4 rounded-2xl bg-white/20 shrink-0 shadow-lg">{direction === 'across' ? <ArrowRight size={24} /> : <ArrowDown size={24} />}</div>
             <div className="text-center sm:text-left flex-1">
                <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${theme === 'CUSTOM' ? 'text-emerald-100' : 'text-indigo-200'}`}>{activeClue?.num} {direction}</p>
                <p className="text-lg sm:text-2xl font-bold leading-tight">{activeClue?.clue}</p>
             </div>
             <button onClick={(e) => { e.stopPropagation(); revealWord(activeClue); }} className="bg-white/10 hover:bg-white/20 p-4 px-6 rounded-2xl text-xs font-black uppercase tracking-widest backdrop-blur-sm border border-white/10">Reveal</button>
          </div>
        </div>

        <div className="w-full lg:w-96 shrink-0 h-full">
          <div className="bg-white rounded-[2.5rem] shadow-xl flex flex-col h-[500px] lg:h-[750px] border border-slate-100">
            <div className="p-6 border-b font-black text-[10px] uppercase tracking-widest text-slate-400 bg-slate-50/50 flex justify-between items-center">
               <span>Clue Repository</span>
               <button onClick={() => { if(window.confirm('Clear all progress?')) setUserGrid(userGrid.map(row => row.map(() => ""))) }} className="p-2 hover:bg-red-50 text-red-300 rounded-lg transition-colors"><Trash2 size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-8">
              {['across', 'down'].map(dir => {
                const clues = crossword.placedWords.filter(w => w.dir === dir);
                if (clues.length === 0) return null;
                return (
                  <div key={dir}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2 ${theme === 'CUSTOM' ? 'text-emerald-500' : 'text-indigo-500'}`}>
                      <div className={`w-3 h-0.5 ${theme === 'CUSTOM' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div> {dir}
                    </p>
                    <div className="space-y-1">
                      {clues.map(w => {
                        const isDone = w.cells.every(c => userGrid[c.r][c.c] === w.word[w.cells.indexOf(c)]);
                        const isActive = activeClue?.num === w.num && direction === dir;
                        return (
                          <div 
                            key={w.num} 
                            onClick={() => { setSelectedCell({r: w.r, c: w.c}); setDirection(dir); hiddenInputRef.current?.focus(); }} 
                            className={`p-4 rounded-xl cursor-pointer text-xs font-bold flex gap-4 transition-all ${isActive ? (theme === 'CUSTOM' ? 'bg-emerald-600 text-white shadow-xl translate-x-1' : 'bg-indigo-600 text-white shadow-xl translate-x-1') : 'hover:bg-slate-50 text-slate-600'}`}
                          >
                            <span className={`w-4 shrink-0 font-black ${isActive ? 'text-white' : 'text-slate-300'}`}>{w.num}</span>
                            <span className={`leading-tight flex-1 ${isDone && !isActive ? 'opacity-40 line-through' : ''}`}>{w.clue}</span>
                            {isDone && <CheckCircle2 size={14} className={isActive ? "text-white" : "text-green-500"} />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {gameState === 'won' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] p-12 max-w-sm w-full text-center shadow-3xl scale-in-center animate-in zoom-in duration-300">
            <div className="w-24 h-24 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-yellow-100">
              <Trophy size={48} className="text-white" />
            </div>
            <h2 className="text-4xl font-black text-slate-800 mb-2 tracking-tighter">PERFECT!</h2>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-8">You solved the {theme === 'CUSTOM' ? customTopic : theme} grid</p>
            <button onClick={() => setGameState('setup')} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">New Puzzle</button>
          </div>
        </div>
      )}
    </div>
  );
}

