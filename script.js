"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const turnLeftButton = document.getElementById("turnLeft");
const fireButton = document.getElementById("fireButton");
const turnRightButton = document.getElementById("turnRight");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const cannon = { x: WIDTH / 2, y: HEIGHT - 22, angle: -Math.PI / 2 };
const LAUNCHER_LENGTH = 218;
const keys = new Set();
const touchDirections = new Set();
const balls = [];
const bursts = [];
const feedbacks = [];
const clouds = [
  { x: 130, y: 104, size: 1.05, speed: 5 },
  { x: 760, y: 145, size: 0.85, speed: 7 },
  { x: 430, y: 70, size: 0.62, speed: 4 },
];
const twinkleStars = Array.from({ length: 22 }, (_, index) => ({
  x: randomBetween(30, WIDTH - 30),
  y: randomBetween(32, 300),
  size: randomBetween(3, 7),
  phase: index * 0.7,
}));
const colors = ["#ff7299", "#ffad5b", "#ffd95b", "#75d69c", "#63bee8", "#9d82e7"];
const wall = { x: WIDTH / 2 - 85, y: 232, width: 170, height: 25, speed: 52 };

let balloon = createBalloon();
let score = 0;
let lastTime = 0;
let shotCooldown = 0;
let audioContext;

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

function createBalloon() {
  return {
    x: randomBetween(100, WIDTH - 100),
    y: randomBetween(62, 152),
    radius: 39,
    color: randomColor(),
    speed: randomBetween(20, 34) * (Math.random() < 0.5 ? -1 : 1),
  };
}

function shoot() {
  if (shotCooldown > 0) return;

  balls.push({
    x: cannon.x + Math.cos(cannon.angle) * LAUNCHER_LENGTH,
    y: cannon.y + Math.sin(cannon.angle) * LAUNCHER_LENGTH,
    vx: Math.cos(cannon.angle) * 390,
    vy: Math.sin(cannon.angle) * 390,
    radius: 15,
    rotation: cannon.angle + Math.PI / 2,
    trail: [],
  });
  shotCooldown = 0.28;
}

function playPopSound() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  audioContext ??= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(520, now);
  oscillator.frequency.exponentialRampToValueAtTime(850, now + 0.12);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.19);
}

function createBurst(x, y, color) {
  for (let i = 0; i < 18; i += 1) {
    const angle = (Math.PI * 2 * i) / 18 + randomBetween(-0.12, 0.12);
    const speed = randomBetween(75, 180);
    bursts.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: randomBetween(5, 10),
      color: i % 4 === 0 ? color : "#ffd84d",
      rotation: randomBetween(0, Math.PI * 2),
      spin: randomBetween(-5, 5),
      life: 0.55,
    });
  }
  feedbacks.push({
    x,
    y: y - 22,
    text: ["Great!", "Nice!", "Wow!"][Math.floor(Math.random() * 3)],
    life: 0.95,
  });
}

function isCircleTouchingRectangle(circle, rectangle) {
  const nearestX = Math.max(rectangle.x, Math.min(circle.x, rectangle.x + rectangle.width));
  const nearestY = Math.max(rectangle.y, Math.min(circle.y, rectangle.y + rectangle.height));
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy < circle.radius * circle.radius;
}

function update(delta) {
  shotCooldown = Math.max(0, shotCooldown - delta);

  if (keys.has("ArrowLeft") || touchDirections.has("ArrowLeft")) cannon.angle -= 1.85 * delta;
  if (keys.has("ArrowRight") || touchDirections.has("ArrowRight")) cannon.angle += 1.85 * delta;
  cannon.angle = Math.max(-Math.PI + 0.22, Math.min(-0.22, cannon.angle));

  if (keys.has("Space")) shoot();

  for (const cloud of clouds) {
    cloud.x += cloud.speed * delta;
    if (cloud.x > WIDTH + 80) cloud.x = -80;
  }

  balloon.x += balloon.speed * delta;
  if (balloon.x - balloon.radius < 30 || balloon.x + balloon.radius > WIDTH - 30) {
    balloon.speed *= -1;
  }

  wall.x += wall.speed * delta;
  if (wall.x < 75 || wall.x + wall.width > WIDTH - 75) {
    wall.speed *= -1;
  }

  for (let index = balls.length - 1; index >= 0; index -= 1) {
    const ball = balls[index];
    ball.trail.unshift({ x: ball.x, y: ball.y, life: 0.28 });
    if (ball.trail.length > 9) ball.trail.pop();
    for (const sparkle of ball.trail) sparkle.life -= delta;
    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;
    ball.rotation += 5 * delta;

    if (
      ball.x < -ball.radius ||
      ball.x > WIDTH + ball.radius ||
      ball.y < -ball.radius ||
      isCircleTouchingRectangle(ball, wall)
    ) {
      balls.splice(index, 1);
      continue;
    }

    const dx = ball.x - balloon.x;
    const dy = ball.y - balloon.y;
    if (dx * dx + dy * dy < (ball.radius + balloon.radius) ** 2) {
      balls.splice(index, 1);
      createBurst(balloon.x, balloon.y, balloon.color);
      playPopSound();
      score += 1;
      balloon = createBalloon();
    }
  }

  for (let index = bursts.length - 1; index >= 0; index -= 1) {
    const particle = bursts[index];
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 110 * delta;
    particle.rotation += particle.spin * delta;
    particle.life -= delta;
    if (particle.life <= 0) bursts.splice(index, 1);
  }

  for (let index = feedbacks.length - 1; index >= 0; index -= 1) {
    const feedback = feedbacks[index];
    feedback.y -= 35 * delta;
    feedback.life -= delta;
    if (feedback.life <= 0) feedbacks.splice(index, 1);
  }
}

function drawRoundedRectangle(x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

function drawCloud(cloud) {
  ctx.save();
  ctx.translate(cloud.x, cloud.y);
  ctx.scale(cloud.size, cloud.size);
  ctx.fillStyle = "#ffffffcc";
  for (const [x, y, radius] of [[-40, 5, 28], [-8, -8, 38], [30, 5, 30], [0, 15, 44]]) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#ccefff");
  gradient.addColorStop(0.72, "#eaf9cf");
  gradient.addColorStop(1, "#bce590");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 15;
  for (const [offset, color] of [[0, "#ff83a8"], [16, "#ffd65c"], [32, "#82df9b"], [48, "#72cfff"], [64, "#b793f4"]]) {
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(WIDTH / 2, 470, 300 - offset, Math.PI + 0.17, Math.PI * 2 - 0.17);
    ctx.stroke();
  }
  ctx.restore();

  clouds.forEach(drawCloud);

  const twinkleTime = performance.now() / 650;
  for (const sparkle of twinkleStars) {
    ctx.save();
    ctx.globalAlpha = 0.28 + (Math.sin(twinkleTime + sparkle.phase) + 1) * 0.28;
    drawStar(sparkle.x, sparkle.y, sparkle.size, sparkle.size * 0.48, "#fff6a4");
    ctx.restore();
  }

  ctx.fillStyle = "#a9db7d";
  ctx.beginPath();
  ctx.moveTo(0, 565);
  ctx.quadraticCurveTo(190, 500, 365, 570);
  ctx.quadraticCurveTo(615, 500, WIDTH, 565);
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.lineTo(0, HEIGHT);
  ctx.fill();

  ctx.fillStyle = "#91cf68";
  ctx.fillRect(0, HEIGHT - 48, WIDTH, 48);
}

function drawScore() {
  drawRoundedRectangle(22, 20, 168, 58, 22, "#ffffffdd", "#ffd36d");
  ctx.fillStyle = "#765b8f";
  ctx.font = "bold 28px Trebuchet MS, sans-serif";
  ctx.fillText(`Score: ${score}`, 42, 58);
}

function drawBalloon() {
  ctx.save();
  ctx.translate(balloon.x, balloon.y);

  ctx.strokeStyle = "#8b7ca0";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, balloon.radius + 9);
  ctx.quadraticCurveTo(17, balloon.radius + 32, -5, balloon.radius + 63);
  ctx.stroke();

  ctx.fillStyle = balloon.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, balloon.radius, balloon.radius * 1.12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffffaa";
  ctx.beginPath();
  ctx.ellipse(-14, -18, 8, 14, -0.45, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = balloon.color;
  ctx.beginPath();
  ctx.moveTo(-8, balloon.radius + 3);
  ctx.lineTo(8, balloon.radius + 3);
  ctx.lineTo(0, balloon.radius + 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawWall() {
  drawRoundedRectangle(wall.x, wall.y, wall.width, wall.height, 12, "#ffd37a", "#efad62");
  for (let x = wall.x + 22; x < wall.x + wall.width; x += 42) {
    ctx.fillStyle = "#ffffff88";
    ctx.beginPath();
    ctx.arc(x, wall.y + wall.height / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStar(x, y, outerRadius, innerRadius, fill, stroke) {
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const starX = x + Math.cos(angle) * radius;
    const starY = y + Math.sin(angle) * radius;
    if (point === 0) ctx.moveTo(starX, starY);
    else ctx.lineTo(starX, starY);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

function drawStarLauncher() {
  // The fairy wand stays aligned with the projectile direction.
  ctx.save();
  ctx.translate(cannon.x, cannon.y);
  ctx.rotate(cannon.angle);

  const wandGradient = ctx.createLinearGradient(0, -24, 0, 24);
  wandGradient.addColorStop(0, "#d5c7ff");
  wandGradient.addColorStop(0.28, "#9a80ef");
  wandGradient.addColorStop(0.68, "#6751c9");
  wandGradient.addColorStop(1, "#4935a6");
  drawRoundedRectangle(-18, -23, 154, 46, 21, wandGradient, "#44309a");

  ctx.fillStyle = "#ffffff88";
  ctx.beginPath();
  ctx.roundRect(8, -15, 96, 10, 6);
  ctx.fill();

  for (const x of [16, 52, 88, 124]) {
    ctx.strokeStyle = "#b6a4ff";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x - 8, -20);
    ctx.lineTo(x + 8, 20);
    ctx.stroke();
  }

  ctx.fillStyle = "#7edcff";
  ctx.strokeStyle = "#367bd0";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(136, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = "#ffe778";
  ctx.shadowBlur = 30;
  drawStar(164, 0, 54, 27, "#ffd83d", "#e99a18");
  ctx.restore();
  drawStar(164, 0, 43, 21, "#ffed71", "#f4b51f");
  drawStar(151, -15, 12, 6, "#ffffffaa");

  for (const [x, y, size] of [[36, 34, 8], [88, -34, 7], [125, 35, 6]]) {
    ctx.save();
    ctx.shadowColor = "#fff3a2";
    ctx.shadowBlur = 12;
    drawStar(x, y, size, size * 0.48, "#fff09a");
    ctx.restore();
  }
  ctx.restore();

  const bodyGradient = ctx.createLinearGradient(0, cannon.y - 48, 0, cannon.y + 35);
  bodyGradient.addColorStop(0, "#ff6ca6");
  bodyGradient.addColorStop(1, "#e52b78");
  drawRoundedRectangle(cannon.x - 85, cannon.y - 42, 170, 78, 31, bodyGradient, "#b91d64");

  ctx.fillStyle = "#ff9ac0";
  ctx.beginPath();
  ctx.roundRect(cannon.x - 65, cannon.y - 31, 103, 13, 7);
  ctx.fill();

  for (const wheelX of [cannon.x - 83, cannon.x + 83]) {
    ctx.fillStyle = "#ffc83d";
    ctx.strokeStyle = "#e99718";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(wheelX, cannon.y + 5, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffdf70";
    ctx.beginPath();
    ctx.arc(wheelX - 9, cannon.y - 7, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#2d8fe7";
    ctx.strokeStyle = "#1263b8";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(wheelX, cannon.y + 5, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.fillStyle = "#1689e6";
  ctx.strokeStyle = "#0f5eaf";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cannon.x, cannon.y + 1, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawStar(cannon.x, cannon.y + 1, 28, 14, "#ffdd4f", "#e99c16");
}

function drawBalls() {
  for (const ball of balls) {
    for (let index = ball.trail.length - 1; index >= 0; index -= 1) {
      const sparkle = ball.trail[index];
      ctx.save();
      ctx.globalAlpha = Math.max(0, sparkle.life / 0.28) * 0.7;
      drawStar(sparkle.x, sparkle.y, 8 - index * 0.35, 4 - index * 0.18, "#ffe878");
      ctx.restore();
    }

    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.rotation);
    ctx.shadowColor = "#ffe16a";
    ctx.shadowBlur = 18;
    drawStar(0, 0, ball.radius, ball.radius * 0.5, "#ffd83d", "#e89a19");
    ctx.restore();
  }
}

function drawBursts() {
  for (const particle of bursts) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / 0.55);
    ctx.translate(particle.x, particle.y);
    ctx.rotate(particle.rotation);
    drawStar(0, 0, particle.radius, particle.radius * 0.5, particle.color);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawFeedbacks() {
  for (const feedback of feedbacks) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, feedback.life * 2);
    ctx.fillStyle = "#ff6b9c";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 7;
    ctx.font = "bold 42px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.strokeText(feedback.text, feedback.x, feedback.y);
    ctx.fillText(feedback.text, feedback.x, feedback.y);
    ctx.restore();
  }
}

function draw() {
  drawBackground();
  drawScore();
  drawBalloon();
  drawWall();
  drawBalls();
  drawBursts();
  drawFeedbacks();
  drawStarLauncher();
}

function gameLoop(timestamp) {
  const delta = Math.min((timestamp - lastTime) / 1000 || 0, 0.05);
  lastTime = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
    keys.add(event.code);
    if (event.code === "Space") shoot();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => {
  keys.clear();
  touchDirections.clear();
  turnLeftButton.classList.remove("is-pressed");
  turnRightButton.classList.remove("is-pressed");
});

function bindHoldButton(button, key) {
  const startTurning = (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    button.classList.add("is-pressed");
    touchDirections.add(key);
  };

  const stopTurning = (event) => {
    event.preventDefault();
    button.classList.remove("is-pressed");
    touchDirections.delete(key);
    if (button.hasPointerCapture(event.pointerId)) {
      button.releasePointerCapture(event.pointerId);
    }
  };

  button.addEventListener("pointerdown", startTurning);
  button.addEventListener("pointerup", stopTurning);
  button.addEventListener("pointercancel", stopTurning);
  button.addEventListener("lostpointercapture", () => {
    button.classList.remove("is-pressed");
    touchDirections.delete(key);
  });
}

bindHoldButton(turnLeftButton, "ArrowLeft");
bindHoldButton(turnRightButton, "ArrowRight");

fireButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  shoot();
});

requestAnimationFrame(gameLoop);
