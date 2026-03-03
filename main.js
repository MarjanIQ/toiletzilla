const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValueEl = document.getElementById("scoreValue");
const speedValueEl = document.getElementById("speedValue");
const overlayEl = document.getElementById("gameOverOverlay");
const finalScoreEl = document.getElementById("finalScore");
const restartBtn = document.getElementById("restartBtn");
const tweetBtn = document.getElementById("tweetBtn");
const countdownEl = document.getElementById("flushCountdown");

const tweetTemplate = `I just flushed {{score}} scam coins in Toiletzilla.
SCAN COMPLETE. 🚽🔥
#Toiletzilla #FlushTheScam`;

const characterSprite = new Image();
characterSprite.src = `assets/toiletzilla-character.png?t=${Date.now()}`;
let characterSpriteReady = false;

characterSprite.onload = () => {
  characterSpriteReady = true;
};

characterSprite.onerror = () => {
  characterSpriteReady = false;
};

const GAME_BASE_SPEED = 220;
const SPAWN_BASE_MS = 1450;
const PIPE_WIDTH = 88;

const state = {
  score: 0,
  speed: 1,
  running: true,
  width: 0,
  height: 0,
  pipes: [],
  spawnTimerMs: 0,
  lastFrameTime: 0,
  touchingCanvas: false,
  player: {
    x: 0,
    y: 0,
    vy: 0,
    gravity: 1300,
    flapImpulse: -430,
    hitWidth: 82,
    hitHeight: 62,
    spriteWidth: 150,
    spriteHeight: 150,
  },
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateHud() {
  scoreValueEl.textContent = String(state.score);
  speedValueEl.textContent = `${state.speed.toFixed(1)}x`;
}

function updateSpeed() {
  state.speed = Math.min(1 + state.score * 0.06, 4.8);
}

function playerBounds() {
  return {
    left: state.player.x - state.player.hitWidth / 2,
    right: state.player.x + state.player.hitWidth / 2,
    top: state.player.y - state.player.hitHeight / 2,
    bottom: state.player.y + state.player.hitHeight / 2,
  };
}

function resetGame() {
  state.score = 0;
  state.speed = 1;
  state.running = true;
  state.pipes = [];
  state.spawnTimerMs = 0;
  state.lastFrameTime = 0;

  state.player.x = Math.max(96, state.width * 0.26);
  state.player.y = state.height * 0.5;
  state.player.vy = 0;

  overlayEl.classList.add("hidden");
  updateHud();
}

function gameOver() {
  if (!state.running) {
    return;
  }
  state.running = false;
  finalScoreEl.textContent = String(state.score);
  overlayEl.classList.remove("hidden");
}

function flap() {
  if (!state.running) {
    return;
  }
  state.player.vy = state.player.flapImpulse;
}

function makeCandleMeta() {
  return {
    bullish: Math.random() < 0.5,
    wickOffset: rand(0.35, 0.65),
    bodyWidthRatio: rand(0.5, 0.72),
    openRatio: rand(0.22, 0.78),
    moveRatio: rand(0.12, 0.3),
  };
}

function createPipe() {
  const gapHeight = clamp(state.height * 0.32, 170, 230);
  const margin = 72;
  const gapCenter = rand(margin + gapHeight / 2, state.height - margin - gapHeight / 2);

  return {
    x: state.width + 18,
    width: PIPE_WIDTH,
    gapCenter,
    gapHeight,
    scored: false,
    topCandle: makeCandleMeta(),
    bottomCandle: makeCandleMeta(),
  };
}

function spawnPipe() {
  state.pipes.push(createPipe());
}

function aabbIntersects(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function pipeHitsPlayer(pipe, player) {
  const gapTop = pipe.gapCenter - pipe.gapHeight / 2;
  const gapBottom = pipe.gapCenter + pipe.gapHeight / 2;

  const topPipe = {
    left: pipe.x,
    right: pipe.x + pipe.width,
    top: 0,
    bottom: gapTop,
  };

  const bottomPipe = {
    left: pipe.x,
    right: pipe.x + pipe.width,
    top: gapBottom,
    bottom: state.height,
  };

  return aabbIntersects(player, topPipe) || aabbIntersects(player, bottomPipe);
}

function roundedRectPath(x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawBackdrop() {
  const gradient = ctx.createLinearGradient(0, 0, 0, state.height);
  gradient.addColorStop(0, "#121212");
  gradient.addColorStop(1, "#0d0d0d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 1;
  for (let y = 0; y < state.height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.width, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawCandleSegment(x, y, width, height, candle) {
  if (height < 8) {
    return;
  }

  const color = candle.bullish ? "#37ff7a" : "#ff4b1f";
  const glow = candle.bullish ? "rgba(55,255,122,0.34)" : "rgba(255,75,31,0.34)";

  const wickX = x + width * candle.wickOffset;
  const segmentTop = y + 3;
  const segmentBottom = y + height - 3;

  const openY = y + height * candle.openRatio;
  let closeY = candle.bullish ? openY - height * candle.moveRatio : openY + height * candle.moveRatio;
  closeY = clamp(closeY, segmentTop + 6, segmentBottom - 6);

  const bodyTop = Math.min(openY, closeY);
  const bodyBottom = Math.max(openY, closeY);
  const bodyHeight = Math.max(8, bodyBottom - bodyTop);
  const bodyWidth = Math.max(16, width * candle.bodyWidthRatio);
  const bodyX = wickX - bodyWidth / 2;

  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 14;

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(wickX, segmentTop);
  ctx.lineTo(wickX, segmentBottom);
  ctx.stroke();

  ctx.fillStyle = color;
  roundedRectPath(bodyX, bodyTop, bodyWidth, bodyHeight, 6);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#0b0b0b";
  ctx.lineWidth = 2;
  roundedRectPath(bodyX, bodyTop, bodyWidth, bodyHeight, 6);
  ctx.stroke();
  ctx.restore();
}

function drawPipe(pipe) {
  const gapTop = pipe.gapCenter - pipe.gapHeight / 2;
  const gapBottom = pipe.gapCenter + pipe.gapHeight / 2;

  drawCandleSegment(pipe.x, 0, pipe.width, gapTop, pipe.topCandle);
  drawCandleSegment(pipe.x, gapBottom, pipe.width, state.height - gapBottom, pipe.bottomCandle);

  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(pipe.x - 4, gapTop - 2, pipe.width + 8, 4);
  ctx.fillRect(pipe.x - 4, gapBottom - 2, pipe.width + 8, 4);
  ctx.restore();
}

function drawPlayerFallback() {
  const x = state.player.x;
  const y = state.player.y;
  const w = state.player.hitWidth;
  const h = state.player.hitHeight;

  ctx.save();
  ctx.shadowColor = "rgba(55,255,122,0.45)";
  ctx.shadowBlur = 20;
  roundedRectPath(x - w / 2, y - h / 2, w, h, 13);
  ctx.fillStyle = "#101010";
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#37ff7a";
  ctx.stroke();

  roundedRectPath(x - w / 2 + 8, y - h / 2 + 7, w - 16, 6, 3);
  ctx.fillStyle = "#ff4b1f";
  ctx.fill();

  ctx.fillStyle = "#37ff7a";
  ctx.font = "700 9px Space Grotesk, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TOILETZILLA", x, y + 1);
  ctx.restore();
}

function drawPlayer() {
  if (!characterSpriteReady) {
    drawPlayerFallback();
    return;
  }

  const angle = clamp(state.player.vy / 700, -0.35, 0.55);
  const drawW = state.player.spriteWidth;
  const drawH = state.player.spriteHeight;

  ctx.save();
  ctx.translate(state.player.x, state.player.y);
  ctx.rotate(angle);
  ctx.shadowColor = "rgba(55,255,122,0.42)";
  ctx.shadowBlur = 14;
  ctx.drawImage(characterSprite, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

function drawHint() {
  if (!state.running || state.score > 2) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "700 13px Space Grotesk, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("TAP / SPACE TO FLAP", state.width / 2, 38);
  ctx.restore();
}

function updateGame(deltaSec) {
  state.player.vy += state.player.gravity * deltaSec;
  state.player.y += state.player.vy * deltaSec;

  const player = playerBounds();
  if (player.top <= 0 || player.bottom >= state.height) {
    gameOver();
    return;
  }

  state.spawnTimerMs += deltaSec * 1000;
  const spawnEvery = Math.max(780, SPAWN_BASE_MS - state.score * 10);
  while (state.spawnTimerMs >= spawnEvery) {
    spawnPipe();
    state.spawnTimerMs -= spawnEvery;
  }

  for (let i = state.pipes.length - 1; i >= 0; i -= 1) {
    const pipe = state.pipes[i];
    pipe.x -= GAME_BASE_SPEED * state.speed * deltaSec;

    if (!pipe.scored && pipe.x + pipe.width < state.player.x) {
      pipe.scored = true;
      state.score += 1;
      updateSpeed();
      updateHud();
    }

    if (pipeHitsPlayer(pipe, player)) {
      gameOver();
      return;
    }

    if (pipe.x + pipe.width < -4) {
      state.pipes.splice(i, 1);
    }
  }
}

function tick(timestamp) {
  if (!state.lastFrameTime) {
    state.lastFrameTime = timestamp;
  }

  const deltaSec = Math.min((timestamp - state.lastFrameTime) / 1000, 0.03);
  state.lastFrameTime = timestamp;

  drawBackdrop();

  if (state.running) {
    updateGame(deltaSec);
  }

  for (const pipe of state.pipes) {
    drawPipe(pipe);
  }

  drawPlayer();
  drawHint();
  requestAnimationFrame(tick);
}

function onPointerDown(event) {
  event.preventDefault();
  canvas.focus();
  if (event.pointerType === "touch") {
    state.touchingCanvas = true;
    document.body.classList.add("game-touch-lock");
  }

  if (!state.running) {
    resetGame();
    return;
  }

  flap();
}

function onPointerUp(event) {
  if (event.pointerType === "touch") {
    state.touchingCanvas = false;
    document.body.classList.remove("game-touch-lock");
  }
}

function onTouchStart(event) {
  event.preventDefault();
  state.touchingCanvas = true;
  document.body.classList.add("game-touch-lock");
  canvas.focus();

  if (!state.running) {
    resetGame();
    return;
  }

  flap();
}

function onTouchEnd() {
  state.touchingCanvas = false;
  document.body.classList.remove("game-touch-lock");
}

function onDocumentTouchMove(event) {
  if (state.touchingCanvas) {
    event.preventDefault();
  }
}

function onKeyDown(event) {
  const key = event.key.toLowerCase();

  if (key === " " || key === "arrowup" || key === "w") {
    event.preventDefault();
    if (!state.running) {
      resetGame();
      return;
    }
    flap();
    return;
  }

  if ((key === "r" || key === "enter") && !state.running) {
    resetGame();
  }
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(240, Math.floor(rect.height));

  const prevHeight = state.height;
  const yRatio = prevHeight > 0 ? state.player.y / prevHeight : 0.5;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  state.width = width;
  state.height = height;
  state.player.x = Math.max(96, width * 0.26);
  state.player.y = clamp(yRatio * height, 60, height - 60);
}

function getNextFlushFriday(now) {
  const target = new Date(now);
  target.setHours(18, 0, 0, 0);

  const fridayIndex = 5;
  const todayIndex = now.getDay();
  let daysToAdd = (fridayIndex - todayIndex + 7) % 7;

  if (daysToAdd === 0 && now >= target) {
    daysToAdd = 7;
  }

  target.setDate(target.getDate() + daysToAdd);
  return target;
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return `${days}D ${hh}H ${mm}M ${ss}S`;
}

function startFlushCountdown() {
  let target = getNextFlushFriday(new Date());

  function update() {
    const now = new Date();
    if (now >= target) {
      target = getNextFlushFriday(now);
    }
    countdownEl.textContent = `NEXT PURGE IN: ${formatCountdown(target - now)}`;
  }

  update();
  setInterval(update, 1000);
}

restartBtn.addEventListener("click", resetGame);
tweetBtn.addEventListener("click", () => {
  const tweetText = tweetTemplate.replace("{{score}}", String(state.score));
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
  window.open(tweetUrl, "_blank", "noopener,noreferrer");
});

if (window.PointerEvent) {
  canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
} else {
  canvas.addEventListener("mousedown", onPointerDown, { passive: false });
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd);
  canvas.addEventListener("touchcancel", onTouchEnd);
}

document.addEventListener("touchmove", onDocumentTouchMove, { passive: false });
document.addEventListener("touchend", onTouchEnd);
document.addEventListener("touchcancel", onTouchEnd);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("resize", resizeCanvas);

canvas.tabIndex = 0;
resizeCanvas();
resetGame();
startFlushCountdown();
requestAnimationFrame(tick);
