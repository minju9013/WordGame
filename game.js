// ---------- 상태 ----------
let step = 1;           // 현재 단계 (STEPS.id)
let gameType = "word";  // "word": 단어 맞추기, "match": 선긋기, "trace": 따라쓰기
let level = 1;          // (단어 맞추기) 1: 그림+글자, 2: 그림만, 3: 글자만
let current = null;     // 현재 문제 { target, options, level, step }
let locked = false;     // 정답 맞춘 뒤 잠금
let history = [];       // 지나온 문제 기록
let historyIndex = -1;  // 현재 보고 있는 문제의 위치
let bag = [];           // 셔플 백: 모든 단어를 한 번씩 소진 후 다시 채움

const $question = document.getElementById("question");
const $cards = document.getElementById("cards");
const $message = document.getElementById("message");
const $nextBtn = document.getElementById("nextBtn");
const $prevBtn = document.getElementById("prevBtn");
const $tabs = document.getElementById("tabs");
const $stepDropdown = document.getElementById("stepDropdown");
const $stepDdBtn = document.getElementById("stepDdBtn");
const $stepDdLabel = document.getElementById("stepDdLabel");
const $stepDdMenu = document.getElementById("stepDdMenu");

const $play = document.querySelector(".play");
const $footer = document.querySelector(".footer");
const $match = document.getElementById("match");
const $matchLeft = document.getElementById("matchLeft");
const $matchRight = document.getElementById("matchRight");
const $matchSvg = document.getElementById("matchSvg");
const $matchBoard = document.getElementById("matchBoard");
const $matchHint = document.getElementById("matchHint");

const MATCH_HINT_DEFAULT = "그림과 글자를 선으로 이어요 ✏️";
let matchState = null;   // 선긋기 게임 상태

const $trace = document.getElementById("trace");
const $traceEmoji = document.getElementById("traceEmoji");
const $traceWord = document.getElementById("traceWord");
const $traceGrid = document.getElementById("traceGrid");
const $traceClear = document.getElementById("traceClear");
const $brushSelect = document.getElementById("brushSelect");

let traceWords = [];     // 따라쓰기: 현재 단계 단어들
let traceIndex = 0;      // 현재 보고 있는 단어 위치
let traceDrawing = false;
let traceBrush = 0.03;   // 펜 굵기 = 칸 너비 대비 비율

const TRACE_GUIDE_ROWS = 2;  // 흐린 가이드 글자 줄 수
const TRACE_EMPTY_ROWS = 1;  // 빈칸(혼자 쓰기) 줄 수

// ---------- 단계 ----------
function getWords() {
  const s = STEPS.find((x) => x.id === step);
  return s ? s.words : STEPS[0].words;
}

function initStepSelect() {
  $stepDdMenu.innerHTML = STEPS.map(
    (s) => `<li class="dropdown-item" role="option" data-value="${s.id}">
      <span class="check">${s.id === step ? "✓" : ""}</span>${s.label}
    </li>`
  ).join("");
  syncStepSelect();
}

function openStepMenu() {
  $stepDdMenu.hidden = false;
  $stepDropdown.classList.add("open");
  $stepDdBtn.setAttribute("aria-expanded", "true");
}
function closeStepMenu() {
  $stepDdMenu.hidden = true;
  $stepDropdown.classList.remove("open");
  $stepDdBtn.setAttribute("aria-expanded", "false");
}
function toggleStepMenu() {
  if ($stepDdMenu.hidden) openStepMenu();
  else closeStepMenu();
}

function resetGameState() {
  bag = [];
  history = [];
  historyIndex = -1;
  locked = false;
}

// ---------- 유틸 ----------
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 이모지를 SVG 이미지로 변환 (Twemoji) — 기기와 무관하게 동일하게 표시
function svgEmoji(el) {
  if (!el || typeof twemoji === "undefined") return;
  twemoji.parse(el, {
    folder: "svg",
    ext: ".svg",
    base: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/",
  });
}

// 한 칸(box)의 패딩 안쪽 영역에 모든 내용이 들어가도록, els의 폰트를 줄여 맞춤
// (그림(이모지)과 글자 모두, box 안의 모든 자식이 패딩 안에 들어오게 함)
function fitStack(box, els) {
  if (!box) return;
  els = els.filter(Boolean);
  if (!els.length) return;

  // 먼저 CSS 기본 크기로 리셋
  els.forEach((e) => (e.style.fontSize = ""));

  const cs = getComputedStyle(box);
  const padL = parseFloat(cs.paddingLeft);
  const padR = parseFloat(cs.paddingRight);
  const padT = parseFloat(cs.paddingTop);
  const padB = parseFloat(cs.paddingBottom);
  const maxW = box.clientWidth - padL - padR;   // 패딩 제외한 가로
  const maxH = box.clientHeight - padT - padB;  // 패딩 제외한 세로

  let sizes = els.map((e) => parseFloat(getComputedStyle(e).fontSize));
  let guard = 0;

  while (guard++ < 100) {
    const kids = Array.from(box.children);
    // 실제로 차지하는 내용 높이(맨 위 자식 top ~ 맨 아래 자식 bottom)
    const top = Math.min(...kids.map((k) => k.getBoundingClientRect().top));
    const bottom = Math.max(...kids.map((k) => k.getBoundingClientRect().bottom));
    const usedH = bottom - top;

    const tooTall = usedH > maxH + 0.5;
    const tooWide = els.some((e) => e.scrollWidth > maxW + 0.5);
    if (!tooTall && !tooWide) break;
    if (sizes.every((s) => s <= 12)) break;

    sizes = sizes.map((s) => Math.max(12, s * 0.95));
    els.forEach((e, i) => (e.style.fontSize = sizes[i] + "px"));
  }
}

// 현재 화면의 문제/카드 내용을 각 칸에 맞춰 조정
function fitAll() {
  // 문제: 이모지 + 글자를 함께 줄여 420px 칸 안에 맞춤
  fitStack($question, [
    $question.querySelector(".q-emoji"),
    $question.querySelector(".q-word"),
  ]);

  // 보기 카드: 카드마다 글자(또는 그림)를 카드 안에 맞춤
  $cards.querySelectorAll(".card").forEach((card) => {
    fitStack(card, [card.firstElementChild]);
  });
}

// 한글 단어 소리내어 읽어주기 (지원하는 브라우저에서)
function speak(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = 0.85;
    u.pitch = 1.2;
    window.speechSynthesis.speak(u);
  } catch (e) { /* 무시 */ }
}

// ---------- 효과음 (Web Audio — 외부 파일 없이 동작) ----------
let audioCtx = null;

function getAudioCtx() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  } catch (e) {
    return null;
  }
}

function tone(ctx, { freq, start, dur, type = "sine", vol = 0.22, slideTo = null }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 40), start + dur);
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

// 틀렸을 때: 띵~~ (높은 음이 길게 내려가는 소리)
function playWrongSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(ctx, { freq: 880, start: t, dur: 0.55, vol: 0.28, slideTo: 180 });
  tone(ctx, { freq: 660, start: t + 0.08, dur: 0.45, type: "triangle", vol: 0.12, slideTo: 140 });
}

// 정답: 짧은 딩동 + 박수
function playCorrectSound() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(ctx, { freq: 523, start: t, dur: 0.12, vol: 0.2 });
  tone(ctx, { freq: 659, start: t + 0.13, dur: 0.12, vol: 0.22 });
  tone(ctx, { freq: 784, start: t + 0.26, dur: 0.18, vol: 0.24 });
  playApplause(ctx, t + 0.2);
}

function playClap(ctx, when, vol = 0.22) {
  const len = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);

  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = 1400;
  filter.Q.value = 0.6;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(vol, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
  src.start(when);
}

function playApplause(ctx, startAt) {
  for (let i = 0; i < 14; i++) {
    playClap(ctx, startAt + i * 0.07 + Math.random() * 0.04, 0.16 + Math.random() * 0.08);
  }
}

// 셔플 백에서 다음 정답 단어 뽑기
// → 모든 단어를 한 번씩 보여준 뒤에야 다시 반복 (같은 단어 연속 노출 방지)
function nextTarget() {
  const words = getWords();
  if (bag.length === 0) {
    bag = shuffle(words);
    // 새 묶음 맨 앞이 직전 단어와 같으면 한 칸 뒤로 보내 연속 중복 방지
    if (current && bag.length > 1 && bag[0].word === current.target.word) {
      [bag[0], bag[1]] = [bag[1], bag[0]];
    }
  }
  return bag.shift();
}

// ---------- 문제 만들기 ----------
function buildQuestion() {
  const words = getWords();
  // 정답 단어(셔플 백) + 보기용 오답 단어 1개
  const target = nextTarget();
  let distractor = pick(words);
  while (distractor.word === target.word) distractor = pick(words);

  const options = shuffle([target, distractor]);
  return { target, options, level, step };
}

// 새 문제: 기록에 추가하고 보여주기
function newQuestion() {
  const q = buildQuestion();
  // 이전으로 돌아간 상태였다면 그 뒤 기록은 지움
  history = history.slice(0, historyIndex + 1);
  history.push(q);
  historyIndex = history.length - 1;
  showQuestion(q);
}

// 기록된 문제 보여주기
function showQuestion(q) {
  current = q;
  step = q.step;
  level = q.level;
  syncStepSelect();
  syncTabs();

  locked = false;
  $message.textContent = "";
  $message.className = "message";

  renderQuestion();
  renderCards();
  updateNav();

  // 레이아웃이 그려진 뒤 글자 크기를 칸에 맞게 조정
  requestAnimationFrame(fitAll);
}

// 이전 문제로
function prevQuestion() {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  showQuestion(history[historyIndex]);
}

// 다음 문제로 (앞쪽 기록이 있으면 이동, 없으면 새 문제)
function nextQuestion() {
  if (historyIndex < history.length - 1) {
    historyIndex += 1;
    showQuestion(history[historyIndex]);
  } else {
    newQuestion();
  }
}

// 이전 버튼 활성/비활성 표시 (단어 맞추기)
function updateNav() {
  $prevBtn.disabled = historyIndex <= 0;
  $nextBtn.disabled = false;
}

// 단계 드롭다운 동기화 (라벨 + 선택 표시)
function syncStepSelect() {
  const cur = STEPS.find((s) => s.id === step) || STEPS[0];
  $stepDdLabel.textContent = cur.label;
  $stepDdMenu.querySelectorAll(".dropdown-item").forEach((li) => {
    const isCur = Number(li.dataset.value) === step;
    li.classList.toggle("active", isCur);
    const check = li.querySelector(".check");
    if (check) check.textContent = isCur ? "✓" : "";
  });
}

// 현재 상태(게임 종류/난이도)에 맞는 탭 하이라이트
function currentTab() {
  if (gameType === "match") return "match";
  if (gameType === "trace") return "trace";
  return "w" + level;
}
function syncTabs() {
  const active = currentTab();
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === active);
  });
}

function renderQuestion() {
  const { target } = current;
  let html = "";

  if (level === 1) {
    // 그림 + 글자 함께
    html = `
      <div class="q-emoji">${target.emoji}</div>
      <div class="q-word">${target.word}</div>
      <div class="q-hint">같은 단어 카드를 찾아요</div>`;
  } else if (level === 2) {
    // 그림만 보여주기
    html = `
      <div class="q-emoji">${target.emoji}</div>
      <div class="q-hint">이 그림은 어떤 단어일까요?</div>`;
  } else {
    // 글자만 보여주기
    html = `
      <div class="q-word">${target.word}</div>
      <div class="q-hint">이 글자에 맞는 그림을 찾아요</div>`;
  }

  $question.innerHTML = html;
  svgEmoji($question);

  // 문제를 누르면 단어를 읽어줌 (글자만 모드에선 자동으로 한 번 읽어줌)
  $question.onclick = () => speak(target.word);
  if (level === 3) speak(target.word);
}

function renderCards() {
  const { options } = current;
  $cards.innerHTML = "";

  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "card";

    if (level === 3) {
      // 글자만 모드: 보기 카드는 그림(이모지)
      btn.innerHTML = `<span class="c-emoji">${opt.emoji}</span>`;
    } else {
      // 그림+글자 / 그림만 모드: 보기 카드는 단어(글자)
      btn.innerHTML = `<span class="c-word">${opt.word}</span>`;
    }

    btn.onclick = () => handleAnswer(opt, btn);
    $cards.appendChild(btn);
  });

  svgEmoji($cards);
}

// ---------- 정답 처리 ----------
function handleAnswer(opt, btn) {
  if (locked) return;

  const isCorrect = opt.word === current.target.word;

  if (isCorrect) {
    locked = true;
    btn.classList.add("correct");

    $message.textContent = pick(PRAISE);
    $message.className = "message";

    speak(current.target.word);
    playCorrectSound();
    celebrate();

    // 잠깐 뒤 자동으로 다음 문제
    setTimeout(() => { if (locked) newQuestion(); }, 2600);
  } else {
    btn.classList.add("wrong");
    $message.textContent = pick(ENCOURAGE);
    $message.className = "message gentle wrong-flash";
    playWrongSound();
    setTimeout(() => {
      btn.classList.remove("wrong");
      $message.classList.remove("wrong-flash");
    }, 650);
  }
}

// ---------- 폭죽 효과 ----------
function celebrate() {
  if (typeof confetti !== "function") return;

  // 가운데에서 팡!
  confetti({
    particleCount: 120,
    spread: 90,
    startVelocity: 45,
    origin: { y: 0.6 },
    scalar: 1.2,
  });

  // 양쪽에서 한 번 더
  setTimeout(() => {
    confetti({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
    confetti({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
  }, 250);
}

// ============================================================
//  선긋기(매칭) 모드 (level 4)
// ============================================================

// 현재 게임 종류에 맞게 화면 전환
function updateModeView() {
  $play.hidden = gameType !== "word";
  $match.hidden = gameType !== "match";
  $trace.hidden = gameType !== "trace";
  // 선긋기는 하단 버튼 숨김, 단어 맞추기·따라쓰기는 이전/다음 사용
  $footer.hidden = gameType === "match";
}

// 새 라운드 시작 / 다시 시작
function startMatchRound() {
  const words = getWords();
  const count = Math.min(3, words.length);
  const chosen = shuffle(words).slice(0, count);
  const rightOrder = shuffle(chosen);

  matchState = {
    connections: [],   // [{ left, right, line }]
    matched: 0,
    total: count,
    selected: null,    // 톡 눌러 선택한 점
    dragFrom: null,    // 드래그 시작 아이템
    moved: false,
    previewLine: null,
    startX: 0,
    startY: 0,
  };

  $matchLeft.innerHTML = chosen.map((w) => matchItemHTML("left", w, true)).join("");
  $matchRight.innerHTML = rightOrder.map((w) => matchItemHTML("right", w, false)).join("");
  $matchSvg.innerHTML = "";
  $matchHint.textContent = MATCH_HINT_DEFAULT;
  $matchHint.className = "match-hint";
  svgEmoji($matchLeft);
}

function matchItemHTML(side, w, showEmoji) {
  const content = showEmoji
    ? `<span class="m-emoji">${w.emoji}</span>`
    : `<span class="m-word">${w.word}</span>`;
  return `<div class="match-item" data-side="${side}" data-word="${w.word}">
      <div class="match-card">${content}</div>
      <div class="match-dot"></div>
    </div>`;
}

// 좌표 유틸 (보드 기준 픽셀 좌표)
function dotCenter(item) {
  const dot = item.querySelector(".match-dot");
  const r = dot.getBoundingClientRect();
  const b = $matchBoard.getBoundingClientRect();
  return { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
}
function boardXY(clientX, clientY) {
  const b = $matchBoard.getBoundingClientRect();
  return { x: clientX - b.left, y: clientY - b.top };
}
function svgLine(x1, y1, x2, y2, klass) {
  const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
  ln.setAttribute("x1", x1);
  ln.setAttribute("y1", y1);
  ln.setAttribute("x2", x2);
  ln.setAttribute("y2", y2);
  ln.setAttribute("class", klass);
  $matchSvg.appendChild(ln);
  return ln;
}
function itemFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest(".match-item") : null;
}

function setSelected(item) {
  clearSelected();
  matchState.selected = item;
  item.classList.add("sel");
}
function clearSelected() {
  if (matchState && matchState.selected) {
    matchState.selected.classList.remove("sel");
    matchState.selected = null;
  }
}

// 두 아이템 연결 시도 (정답/오답 처리)
function tryConnect(a, b) {
  if (!a || !b || a === b) return;
  if (a.dataset.side === b.dataset.side) return;
  if (a.classList.contains("matched") || b.classList.contains("matched")) return;

  const left = a.dataset.side === "left" ? a : b;
  const right = a.dataset.side === "right" ? a : b;
  const correct = left.dataset.word === right.dataset.word;

  if (correct) {
    left.classList.add("matched");
    right.classList.add("matched");
    const c1 = dotCenter(left);
    const c2 = dotCenter(right);
    const line = svgLine(c1.x, c1.y, c2.x, c2.y, "match-line");
    matchState.connections.push({ left, right, line });
    matchState.matched += 1;

    speak(left.dataset.word);
    playCorrectSound();

    if (matchState.matched >= matchState.total) {
      $matchHint.textContent = pick(PRAISE);
      celebrate();
      setTimeout(() => { if (gameType === "match") startMatchRound(); }, 2800);
    }
  } else {
    playWrongSound();
    const c1 = dotCenter(a);
    const c2 = dotCenter(b);
    const line = svgLine(c1.x, c1.y, c2.x, c2.y, "match-line-wrong");
    a.classList.add("wrong");
    b.classList.add("wrong");
    setTimeout(() => {
      line.remove();
      a.classList.remove("wrong");
      b.classList.remove("wrong");
    }, 550);
  }
}

// 크기/방향 변경 시 연결된 선 다시 그리기
function redrawMatchLines() {
  if (gameType !== "match" || !matchState) return;
  matchState.connections.forEach(({ left, right, line }) => {
    const c1 = dotCenter(left);
    const c2 = dotCenter(right);
    line.setAttribute("x1", c1.x);
    line.setAttribute("y1", c1.y);
    line.setAttribute("x2", c2.x);
    line.setAttribute("y2", c2.y);
  });
}

// ----- 포인터(마우스/터치) 이벤트 -----
function onMatchDown(e) {
  if (gameType !== "match" || !matchState) return;
  const item = e.target.closest(".match-item");
  if (!item || item.classList.contains("matched")) return;
  e.preventDefault();
  getAudioCtx(); // 첫 상호작용에서 오디오 활성화

  // 남아있을 수 있는 임시 선(미리보기/오답) 정리
  $matchSvg.querySelectorAll(".match-line-preview, .match-line-wrong").forEach((l) => l.remove());

  matchState.dragFrom = item;
  matchState.moved = false;
  matchState.startX = e.clientX;
  matchState.startY = e.clientY;

  const c = dotCenter(item);
  matchState.previewLine = svgLine(c.x, c.y, c.x, c.y, "match-line-preview");
}

function onMatchMove(e) {
  if (!matchState || !matchState.dragFrom) return;
  const p = boardXY(e.clientX, e.clientY);
  if (Math.hypot(e.clientX - matchState.startX, e.clientY - matchState.startY) > 8) {
    matchState.moved = true;
  }
  if (matchState.previewLine) {
    matchState.previewLine.setAttribute("x2", p.x);
    matchState.previewLine.setAttribute("y2", p.y);
  }
}

function onMatchUp(e) {
  if (!matchState || !matchState.dragFrom) return;
  const from = matchState.dragFrom;
  matchState.dragFrom = null;
  if (matchState.previewLine) {
    matchState.previewLine.remove();
    matchState.previewLine = null;
  }

  const drop = itemFromPoint(e.clientX, e.clientY);
  const droppedOnOther =
    drop && drop !== from &&
    drop.dataset.side !== from.dataset.side &&
    !drop.classList.contains("matched");

  if (droppedOnOther) {
    clearSelected();
    tryConnect(from, drop);
    return;
  }

  if (!matchState.moved) {
    // 톡 두 번 눌러 잇기
    const sel = matchState.selected;
    if (sel && sel !== from && sel.dataset.side !== from.dataset.side) {
      clearSelected();
      tryConnect(sel, from);
    } else if (sel === from) {
      clearSelected();
    } else {
      setSelected(from);
    }
  } else {
    clearSelected();
  }
}

function onMatchCancel() {
  if (!matchState) return;
  if (matchState.previewLine) {
    matchState.previewLine.remove();
    matchState.previewLine = null;
  }
  matchState.dragFrom = null;
}

$matchBoard.addEventListener("pointerdown", onMatchDown);
window.addEventListener("pointermove", onMatchMove);
window.addEventListener("pointerup", onMatchUp);
window.addEventListener("pointercancel", onMatchCancel);

// ============================================================
//  따라쓰기 모드 (trace)
// ============================================================

// 따라쓰기 시작: 현재 단계 단어를 순서대로, 첫 단어부터
function startTrace() {
  traceWords = getWords();
  traceIndex = 0;
  showTrace();
}

function showTrace() {
  if (!traceWords.length) return;
  const w = traceWords[traceIndex];

  $traceEmoji.textContent = w.emoji;
  $traceWord.textContent = w.word;
  svgEmoji($trace);

  // 단어를 누르면 소리 다시 듣기
  $traceEmoji.onclick = () => speak(w.word);
  $traceWord.onclick = () => speak(w.word);

  // 글자 수만큼 열, (가이드 줄 + 빈 줄) 만큼 행
  const chars = [...w.word];
  $traceGrid.style.gridTemplateColumns = `repeat(${chars.length}, 1fr)`;

  const rows = TRACE_GUIDE_ROWS + TRACE_EMPTY_ROWS;
  let html = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < chars.length; c++) {
      const guide = r < TRACE_GUIDE_ROWS ? `<span class="guide">${chars[c]}</span>` : "";
      html += `<div class="trace-cell">${guide}<canvas></canvas></div>`;
    }
  }
  $traceGrid.innerHTML = html;

  requestAnimationFrame(setupAllTraceCanvases);
  updateTraceNav();
  speak(w.word);
}

// 각 칸 캔버스 크기 설정 + 그리기 이벤트 연결
function setupAllTraceCanvases() {
  $traceGrid.querySelectorAll("canvas").forEach(setupTraceCanvas);
  fitTraceGuides();
}

// 가이드 글씨를 칸 크기에 꽉 차게 맞춤 (작은 화면에서도 크게)
function fitTraceGuides() {
  $traceGrid.querySelectorAll(".trace-cell").forEach((cell) => {
    const guide = cell.querySelector(".guide");
    if (!guide) return;
    const r = cell.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // 칸의 짧은 변에 맞춰 글자 크기 결정 (여백 살짝)
    guide.style.fontSize = Math.floor(Math.min(r.width, r.height) * 0.86) + "px";
  });
}

function setupTraceCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.5, rect.width * traceBrush);
  ctx.strokeStyle = "#6b4ea0";
  canvas._ctx = ctx;
  canvas._w = rect.width;

  if (!canvas._bound) {
    canvas.addEventListener("pointerdown", onTraceDown);
    canvas.addEventListener("pointermove", onTraceMove);
    canvas.addEventListener("pointerup", onTraceUp);
    canvas.addEventListener("pointercancel", onTraceUp);
    canvas._bound = true;
  }
}

function traceXY(canvas, e) {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function onTraceDown(e) {
  const canvas = e.currentTarget;
  if (!canvas._ctx) return;
  e.preventDefault();
  getAudioCtx();
  traceDrawing = true;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  const p = traceXY(canvas, e);
  const ctx = canvas._ctx;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  // 점 하나라도 찍히도록
  ctx.lineTo(p.x + 0.01, p.y + 0.01);
  ctx.stroke();
}

function onTraceMove(e) {
  if (!traceDrawing) return;
  const canvas = e.currentTarget;
  if (!canvas._ctx) return;
  e.preventDefault();
  const p = traceXY(canvas, e);
  const ctx = canvas._ctx;
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function onTraceUp(e) {
  traceDrawing = false;
}

function clearTrace() {
  $traceGrid.querySelectorAll("canvas").forEach((c) => {
    if (c._ctx) c._ctx.clearRect(0, 0, c.width, c.height);
  });
}

// 펜 굵기 변경 (그린 내용은 유지, 앞으로 그릴 선 굵기만 바꿈)
function setTraceBrush(factor) {
  traceBrush = factor;
  $traceGrid.querySelectorAll("canvas").forEach((c) => {
    if (c._ctx) c._ctx.lineWidth = Math.max(1.5, (c._w || 100) * traceBrush);
  });
  $brushSelect.querySelectorAll(".brush-btn").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.brush) === traceBrush);
  });
}

$brushSelect.addEventListener("click", (e) => {
  const btn = e.target.closest(".brush-btn");
  if (!btn) return;
  setTraceBrush(Number(btn.dataset.brush));
});

function tracePrev() {
  if (traceIndex <= 0) return;
  traceIndex -= 1;
  showTrace();
}
function traceNext() {
  if (traceIndex >= traceWords.length - 1) return;
  traceIndex += 1;
  showTrace();
}
function updateTraceNav() {
  $prevBtn.disabled = traceIndex <= 0;
  $nextBtn.disabled = traceIndex >= traceWords.length - 1;
}

$traceClear.addEventListener("click", clearTrace);

// 현재 게임 종류에 맞는 새 게임 시작
function startCurrentGame() {
  resetGameState();
  updateModeView();
  if (gameType === "match") startMatchRound();
  else if (gameType === "trace") startTrace();
  else newQuestion();
}

// ---------- 단계 선택 (커스텀 드롭다운, 아래로 펼침) ----------
$stepDdBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleStepMenu();
});

$stepDdMenu.addEventListener("click", (e) => {
  const li = e.target.closest(".dropdown-item");
  if (!li) return;
  step = Number(li.dataset.value);
  syncStepSelect();
  closeStepMenu();
  startCurrentGame();
});

// 바깥 클릭 / ESC 로 닫기
document.addEventListener("click", (e) => {
  if (!$stepDropdown.contains(e.target)) closeStepMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeStepMenu();
});

// ---------- 모드 탭 선택 (그림+글자 / 그림만 / 글자만 / 선긋기) ----------
$tabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".tab");
  if (!btn) return;
  const tab = btn.dataset.tab;
  if (tab === "match") {
    gameType = "match";
  } else if (tab === "trace") {
    gameType = "trace";
  } else {
    gameType = "word";
    level = Number(tab.slice(1)); // "w1" -> 1
  }
  syncTabs();
  startCurrentGame();
});

$nextBtn.addEventListener("click", () => {
  if (gameType === "trace") traceNext();
  else nextQuestion();
});
$prevBtn.addEventListener("click", () => {
  if (gameType === "trace") tracePrev();
  else prevQuestion();
});

// 화면 크기/방향이 바뀌면 글자 크기 다시 맞춤
let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    fitAll();
    redrawMatchLines();
    if (gameType === "trace") setupAllTraceCanvases();
  }, 120);
});

// 폰트 로딩이 끝난 뒤에도 한 번 더 맞춤 (폰트에 따라 글자 폭이 달라지므로)
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(fitAll);
}

// ---------- 시작 ----------
initStepSelect();
syncTabs();
updateModeView();
if (gameType === "match") startMatchRound();
else if (gameType === "trace") startTrace();
else newQuestion();
