"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const turnLeftButton = document.getElementById("turnLeft");
const fireButton = document.getElementById("fireButton");
const turnRightButton = document.getElementById("turnRight");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const cannon = { x: WIDTH / 2, y: HEIGHT - 58, angle: -Math.PI / 2 };
const keys = new Set();
const touchDirections = new Set();
const balls = [];
const bursts = [];
const clouds = [
  { x: 130, y: 104, size: 1.05 },
  { x: 760, y: 145, size: 0.85 },
  { x: 430, y: 70, size: 0.62 },
];
const colors = ["#ff7299", "#ffad5b", "#ffd95b", "#75d69c", "#63bee8", "#9d82e7"];
const wall = { x: WIDTH / 2 - 85, y: 332, width: 170, height: 25, speed: 52 };

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
    y: randomBetween(100, 235),
    radius: 39,
    color: randomColor(),
    speed: randomBetween(20, 34) * (Math.random() < 0.5 ? -1 : 1),
  };
}

function shoot() {
  if (shotCooldown > 0) return;

  const barrelLength = 62;
  balls.push({
    x: cannon.x + Math.cos(cannon.angle) * barrelLength,
    y: cannon.y + Math.sin(cannon.angle) * barrelLength,
    vx: Math.cos(cannon.angle) * 390,
    vy: Math.sin(cannon.angle) * 390,
    radius: 11,
    color: randomColor(),
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
      radius: randomBetween(4, 8),
      color: i % 3 === 0 ? "#ffffff" : color,
      life: 0.55,
    });
  }
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
    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;

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
    particle.life -= delta;
    if (particle.life <= 0) bursts.splice(index, 1);
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

  clouds.forEach(drawCloud);

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

function drawCannon() {
  ctx.save();
  ctx.translate(cannon.x, cannon.y);
  ctx.rotate(cannon.angle);
  drawRoundedRectangle(0, -19, 82, 38, 16, "#77c9e9", "#529abb");
  ctx.restore();

  ctx.fillStyle = "#8c78c7";
  ctx.strokeStyle = "#6957a4";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cannon.x, cannon.y, 43, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#ffd2df";
  ctx.beginPath();
  ctx.arc(cannon.x - 18, cannon.y - 13, 6, 0, Math.PI * 2);
  ctx.arc(cannon.x + 18, cannon.y - 13, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cannon.x - 18, cannon.y - 13, 2, 0, Math.PI * 2);
  ctx.arc(cannon.x + 18, cannon.y - 13, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cannon.x, cannon.y - 6, 14, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.fillStyle = "#ffd269";
  ctx.beginPath();
  ctx.arc(cannon.x - 48, cannon.y + 2, 20, 0, Math.PI * 2);
  ctx.arc(cannon.x + 48, cannon.y + 2, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e6a949";
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawBalls() {
  for (const ball of balls) {
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffffaa";
    ctx.beginPath();
    ctx.arc(ball.x - 3, ball.y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBursts() {
  for (const particle of bursts) {
    ctx.globalAlpha = Math.max(0, particle.life / 0.55);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function draw() {
  drawBackground();
  drawScore();
  drawBalloon();
  drawWall();
  drawBalls();
  drawBursts();
  drawCannon();
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
