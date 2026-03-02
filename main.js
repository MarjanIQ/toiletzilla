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
let characterSpriteReady = false;

characterSprite.onload = () => {
  characterSpriteReady = true;
};
characterSprite.onerror = () => {
  characterSpriteReady = false;
};
characterSprite.src = `assets/toiletzilla-character.png?t=${Date.now()}`;

const state = {
  score: 0,
  speed: 1,
  misses: 0,
  running: true,
  width: 0,
  height: 0,
  items: [],
  spawnTimerMs: 0,
  lastFrameTime: 0,
  player: {
    x: 0,
    y: 0,
    hitWidth: 108,
    hitHeight: 54,
    spriteWidth: 176,
    spriteHeight: 176,
    keyboardSpeed: 620,
    moveLeft: false,
    moveRight: false,
    pointerTarget: null,
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

function setPlayerStart() {
  state.player.x = state.width / 2;
  state.player.y = state.height - state.player.hitHeight / 2 - 8;
}

function resetGame() {
  state.score = 0;
  state.speed = 1;
  state.misses = 0;
  state.items = [];
  state.spawnTimerMs = 0;
  state.lastFrameTime = 0;
  state.running = true;
  state.player.moveLeft = false;
  state.player.moveRight = false;
  state.player.pointerTarget = null;
  setPlayerStart();
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

function createItem() {
  const radius = rand(14, 23);
  const type = Math.random() < 0.72 ? "scam" : "safe";
  const velocity = type === "scam" ? rand(92, 145) : rand(102, 162);

  return {
    x: rand(radius + 8, Math.max(radius + 10, state.width - radius - 8)),
    y: -radius - 6,
    radius,
    type,
    vy: velocity,
    phase: rand(0, Math.PI * 2),
    wobble: rand(10, 24),
  };
}

function spawnItem() {
  state.items.push(createItem());
}

function updateSpeed() {
  const next = 1 + state.score * 0.08;
  state.speed = Math.min(next, 4.6);
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

  ctx.globalAlpha = 0.12;
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

function drawItem(item) {
  const isScam = item.type === "scam";
  const color = isScam ? "#ff4b1f" : "#37ff7a";
  const glow = isScam ? "rgba(255,75,31,0.45)" : "rgba(55,255,122,0.42)";

  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#0b0b0b";
  ctx.stroke();

  ctx.fillStyle = "#0b0b0b";
  ctx.font = "700 10px Space Grotesk, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(isScam ? "SCAM" : "SAFE", item.x, item.y);
  ctx.restore();
}

function drawPlayerFallback() {
  const { x, y, hitWidth, hitHeight } = state.player;
  const left = x - hitWidth / 2;
  const top = y - hitHeight / 2;

  ctx.save();
  ctx.shadowColor = "rgba(55,255,122,0.45)";
  ctx.shadowBlur = 22;
  roundedRectPath(left, top, hitWidth, hitHeight, 13);
  ctx.fillStyle = "#101010";
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#37ff7a";
  ctx.stroke();

  roundedRectPath(left + 8, top + 7, hitWidth - 16, 6, 3);
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
  const { x, y, hitWidth, hitHeight, spriteWidth, spriteHeight } = state.player;
  const groundY = y + hitHeight / 2;

  if (!characterSpriteReady) {
    drawPlayerFallback();
    return;
  }

  const drawLeft = x - spriteWidth / 2;
  const drawTop = groundY - spriteHeight;

  ctx.save();
  ctx.shadowColor = "rgba(55,255,122,0.4)";
  ctx.shadowBlur = 16;
  ctx.drawImage(characterSprite, drawLeft, drawTop, spriteWidth, spriteHeight);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.shadowColor = "rgba(55,255,122,0.6)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#37ff7a";
  roundedRectPath(x - hitWidth / 2, groundY - 3, hitWidth, 4, 2);
  ctx.fill();
  ctx.restore();
}

function drawMisses() {
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "600 12px Space Grotesk, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`MISSES: ${state.misses}/3`, 14, 12);
  ctx.restore();
}

function updatePlayer(deltaSec) {
  const minX = state.player.hitWidth / 2 + 8;
  const maxX = state.width - state.player.hitWidth / 2 - 8;

  if (state.player.pointerTarget !== null) {
    const diff = state.player.pointerTarget - state.player.x;
    state.player.x += diff * Math.min(1, deltaSec * 12);
  }

  if (state.player.moveLeft) {
    state.player.x -= state.player.keyboardSpeed * deltaSec;
  }
  if (state.player.moveRight) {
    state.player.x += state.player.keyboardSpeed * deltaSec;
  }

  state.player.x = clamp(state.player.x, minX, maxX);
  state.player.y = state.height - state.player.hitHeight / 2 - 8;
}

function itemHitsPlayer(item) {
  const left = state.player.x - state.player.hitWidth / 2;
  const right = state.player.x + state.player.hitWidth / 2;
  const top = state.player.y - state.player.hitHeight / 2;
  const bottom = state.player.y + state.player.hitHeight / 2;

  const closestX = clamp(item.x, left, right);
  const closestY = clamp(item.y, top, bottom);
  const dx = item.x - closestX;
  const dy = item.y - closestY;

  return dx * dx + dy * dy <= item.radius * item.radius;
}

function tick(timestamp) {
  if (!state.lastFrameTime) {
    state.lastFrameTime = timestamp;
  }

  const deltaSec = Math.min((timestamp - state.lastFrameTime) / 1000, 0.034);
  state.lastFrameTime = timestamp;

  drawBackdrop();

  if (state.running) {
    updatePlayer(deltaSec);

    state.spawnTimerMs += deltaSec * 1000;
    const spawnEveryMs = Math.max(250, 850 - state.score * 18);
    while (state.spawnTimerMs >= spawnEveryMs) {
      spawnItem();
      state.spawnTimerMs -= spawnEveryMs;
    }

    for (let i = state.items.length - 1; i >= 0; i -= 1) {
      const item = state.items[i];
      item.phase += deltaSec * 2;
      item.x += Math.sin(item.phase) * item.wobble * deltaSec;
      item.y += item.vy * state.speed * deltaSec;

      if (item.x <= item.radius) {
        item.x = item.radius;
      } else if (item.x >= state.width - item.radius) {
        item.x = state.width - item.radius;
      }

      if (itemHitsPlayer(item)) {
        if (item.type === "safe") {
          state.items.splice(i, 1);
          gameOver();
          continue;
        }

        state.score += 1;
        updateSpeed();
        updateHud();
        state.items.splice(i, 1);
        continue;
      }

      if (item.y - item.radius > state.height) {
        if (item.type === "scam") {
          state.misses += 1;
          if (state.misses >= 3) {
            state.items.splice(i, 1);
            gameOver();
            continue;
          }
        }
        state.items.splice(i, 1);
        continue;
      }

      drawItem(item);
    }
  } else {
    for (const item of state.items) {
      drawItem(item);
    }
  }

  drawPlayer();
  drawMisses();
  requestAnimationFrame(tick);
}

function onPointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  state.player.pointerTarget = clamp(event.clientX - rect.left, 0, state.width);
}

function onTouchMove(event) {
  if (!event.touches || event.touches.length === 0) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  state.player.pointerTarget = clamp(event.touches[0].clientX - rect.left, 0, state.width);
}

function onKeyDown(event) {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") {
    state.player.moveLeft = true;
    event.preventDefault();
  }
  if (key === "arrowright" || key === "d") {
    state.player.moveRight = true;
    event.preventDefault();
  }
  if ((key === "r" || key === "enter") && !state.running) {
    resetGame();
  }
}

function onKeyUp(event) {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") {
    state.player.moveLeft = false;
  }
  if (key === "arrowright" || key === "d") {
    state.player.moveRight = false;
  }
}

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(240, Math.floor(rect.height));

  const previousWidth = state.width;
  const xRatio = previousWidth > 0 ? state.player.x / previousWidth : 0.5;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  state.width = width;
  state.height = height;
  state.player.x = clamp(
    xRatio * width,
    state.player.hitWidth / 2 + 8,
    width - state.player.hitWidth / 2 - 8
  );
  state.player.y = height - state.player.hitHeight / 2 - 8;
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

canvas.addEventListener("mousemove", onPointerMove);
canvas.addEventListener("touchmove", onTouchMove, { passive: true });
canvas.addEventListener("mouseleave", () => {
  state.player.pointerTarget = null;
});

window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("resize", resizeCanvas);

resizeCanvas();
resetGame();
startFlushCountdown();
requestAnimationFrame(tick);
