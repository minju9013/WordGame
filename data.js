// ---------- 단계별 단어 데이터 ----------
// STEPS 배열에 단계를 추가하거나 words를 수정하면 게임에 바로 반영됩니다.
const STEPS = [
  {
    id: 1,
    label: "Step1",
    words: [
      { word: "곰",   emoji: "🐻" },
      { word: "달",   emoji: "🌙" },
      { word: "옷",   emoji: "👕" },
      { word: "집",   emoji: "🏠" },
      { word: "책",   emoji: "📚" },
      { word: "알",   emoji: "🥚" },
      { word: "사자", emoji: "🦁" },
    ],
  },
  {
    id: 2,
    label: "Step2",
    words: [
      { word: "모자", emoji: "🎩" },
      { word: "바위", emoji: "🪨" },
      { word: "쿠키", emoji: "🍪" },
      { word: "아빠", emoji: "👨" },
      { word: "토끼", emoji: "🐰" },
      { word: "구름", emoji: "☁️" },
      { word: "늑대", emoji: "🐺" },
    ],
  },
];

// 칭찬 / 격려 메시지
const PRAISE = ["잘했어요! 🎉", "정답이에요! 👏", "최고예요! 🌟", "와! 똑똑해요! 💖", "참 잘했어요! 🎈"];
const ENCOURAGE = ["괜찮아요, 다시 해볼까요? 😊", "조금만 더! 잘할 수 있어요 💪", "다른 카드를 눌러볼까요? 🌈"];
