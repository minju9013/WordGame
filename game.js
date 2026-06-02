// ---------- 상태 ----------
let level = 1;          // 1: 그림+글자, 2: 그림만, 3: 글자만
let current = null;     // 현재 문제 { target, options, level }
let locked = false;     // 정답 맞춘 뒤 잠금
let history = [];       // 지나온 문제 기록
let historyIndex = -1;  // 현재 보고 있는 문제의 위치
let bag = [];           // 셔플 백: 모든 단어를 한 번씩 소진 후 다시 채움

const $question = document.getElementById("question");
const $cards = document.getElementById("cards");
const $message = document.getElementById("message");
const $nextBtn = document.getElementById("nextBtn");
const $prevBtn = document.getElementById("prevBtn");
const $levels = document.getElementById("levels");

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

// 셔플 백에서 다음 정답 단어 뽑기
// → 7개 단어를 모두 한 번씩 보여준 뒤에야 다시 반복 (같은 단어 연속 노출 방지)
function nextTarget() {
  if (bag.length === 0) {
    bag = shuffle(WORDS);
    // 새 묶음 맨 앞이 직전 단어와 같으면 한 칸 뒤로 보내 연속 중복 방지
    if (current && bag.length > 1 && bag[0].word === current.target.word) {
      [bag[0], bag[1]] = [bag[1], bag[0]];
    }
  }
  return bag.shift();
}

// ---------- 문제 만들기 ----------
function buildQuestion() {
  // 정답 단어(셔플 백) + 보기용 오답 단어 1개
  const target = nextTarget();
  let distractor = pick(WORDS);
  while (distractor.word === target.word) distractor = pick(WORDS);

  const options = shuffle([target, distractor]);
  return { target, options, level };
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
  level = q.level;
  syncLevelButtons();

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

// 이전 버튼 활성/비활성 표시
function updateNav() {
  $prevBtn.disabled = historyIndex <= 0;
}

// 난이도 버튼 하이라이트 동기화
function syncLevelButtons() {
  document.querySelectorAll(".level-btn").forEach((b) => {
    b.classList.toggle("active", Number(b.dataset.level) === level);
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
    celebrate();

    // 잠깐 뒤 자동으로 다음 문제
    setTimeout(() => { if (locked) newQuestion(); }, 2600);
  } else {
    btn.classList.add("wrong");
    $message.textContent = pick(ENCOURAGE);
    $message.className = "message gentle";
    setTimeout(() => btn.classList.remove("wrong"), 500);
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

// ---------- 난이도 선택 ----------
$levels.addEventListener("click", (e) => {
  const btn = e.target.closest(".level-btn");
  if (!btn) return;
  level = Number(btn.dataset.level);
  syncLevelButtons();
  newQuestion();
});

$nextBtn.addEventListener("click", nextQuestion);
$prevBtn.addEventListener("click", prevQuestion);

// 화면 크기/방향이 바뀌면 글자 크기 다시 맞춤
let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitAll, 120);
});

// 폰트 로딩이 끝난 뒤에도 한 번 더 맞춤 (폰트에 따라 글자 폭이 달라지므로)
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(fitAll);
}

// ---------- 시작 ----------
svgEmoji(document.querySelector("header")); // 제목 / 난이도 버튼의 이모지도 SVG로
newQuestion();
