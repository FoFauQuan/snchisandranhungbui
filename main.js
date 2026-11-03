const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(pointer: fine)");
const random = (min, max) => min + Math.random() * (max - min);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

onload = () => {
  const c = setTimeout(() => {
    document.body.classList.remove("not-loaded");
    clearTimeout(c);
  }, 400);
};

// Size a canvas to the viewport, keeping it sharp on high-DPI screens
function fitCanvas(canvas, ctx) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height };
}

// Twinkling stars in the background
function createStars(count) {
  const sky = document.querySelector(".sky");
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < count; i++) {
    const star = document.createElement("span");
    star.className = "star";
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 75}%`;
    star.style.setProperty("--size", `${random(1, 3).toFixed(1)}px`);
    star.style.setProperty("--delay", `${random(-5, 0).toFixed(2)}s`);
    star.style.setProperty("--dur", `${random(2.5, 5.5).toFixed(2)}s`);
    fragment.appendChild(star);
  }

  sky.appendChild(fragment);
}

const PETAL_COLORS = ["#ffb7d5", "#ff8fbf", "#ffd1e3", "#fff0f6", "#f9a8d4", "#ffc4a8", "#e9b8ff"];

// Sakura-style petal centred on the origin, notch at the top
function drawPetal(ctx, size) {
  const s = size;
  ctx.beginPath();
  ctx.moveTo(0, s * 0.5);
  ctx.bezierCurveTo(-s * 0.55, s * 0.2, -s * 0.5, -s * 0.45, -s * 0.16, -s * 0.5);
  ctx.lineTo(0, -s * 0.34);
  ctx.lineTo(s * 0.16, -s * 0.5);
  ctx.bezierCurveTo(s * 0.5, -s * 0.45, s * 0.55, s * 0.2, 0, s * 0.5);
  ctx.closePath();
  ctx.fill();
}

// Draw a falling petal with a 3D flip and a soft highlight
function paintPetal(ctx, p, alpha = 0.92) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.scale(Math.max(0.15, Math.abs(Math.cos(p.tilt))), 1);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.color;
  drawPetal(ctx, p.size);
  ctx.globalAlpha = alpha * 0.45;
  ctx.fillStyle = "#ffffff";
  ctx.translate(0, p.size * 0.12);
  drawPetal(ctx, p.size * 0.45);
  ctx.restore();
}

// Petals drifting over the page: a gentle ambient fall plus bursts
const petals = (() => {
  const canvas = document.querySelector(".petals");
  const ctx = canvas.getContext("2d");
  let pieces = [];
  let size = { width: 0, height: 0 };
  let ambientLimit = 0;
  let running = false;

  function createPiece(x, y, vx, vy, colors = PETAL_COLORS) {
    return {
      x,
      y,
      vx,
      vy,
      size: random(10, 18),
      fall: random(0.9, 1.9),
      sway: random(0.4, 1.2),
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      spin: random(-0.03, 0.03),
      tilt: Math.random() * Math.PI * 2,
      tiltSpeed: random(0.02, 0.05),
    };
  }

  function tick() {
    const { width, height } = size;
    ctx.clearRect(0, 0, width, height);

    if (pieces.length < ambientLimit && Math.random() < 0.2) {
      pieces.push(createPiece(Math.random() * width, -20, random(-0.4, 0.6), random(0.5, 1.2)));
    }

    pieces = pieces.filter((p) => p.y < height + 30 && p.x > -60 && p.x < width + 60);

    for (const p of pieces) {
      p.vx *= 0.98;
      p.vy = Math.min(p.vy + 0.05, p.fall);
      p.tilt += p.tiltSpeed;
      p.rotation += p.spin;
      p.x += p.vx + Math.sin(p.tilt) * p.sway;
      p.y += p.vy;
      paintPetal(ctx, p);
    }

    if (pieces.length || ambientLimit) {
      requestAnimationFrame(tick);
    } else {
      running = false;
    }
  }

  function start() {
    if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
  }

  size = fitCanvas(canvas, ctx);
  window.addEventListener("resize", () => (size = fitCanvas(canvas, ctx)));

  return {
    // Upward fan by default; spread = 2π scatters in every direction
    burst(x, y, count = 140, { spread = Math.PI * 0.95, speed = 8, colors } = {}) {
      for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * spread;
        const velocity = random(speed * 0.4, speed * 1.4);
        pieces.push(createPiece(x, y, Math.cos(angle) * velocity, Math.sin(angle) * velocity, colors));
      }
      start();
    },
    setAmbient(limit) {
      ambientLimit = limit;
      if (limit) start();
    },
  };
})();

// Flowers that bloom in the sky behind the content, then shed their petals
const blooms = (() => {
  const canvas = document.querySelector(".blooms");
  const ctx = canvas.getContext("2d");
  // [deep petal, light tip, inner petals]
  const palettes = [
    ["#ff5f9e", "#ffd1e3", "#fff0f6"],
    ["#c084fc", "#f3e8ff", "#fdf4ff"],
    ["#ff8a6b", "#ffe1d6", "#fff4ee"],
    ["#f472b6", "#fce7f3", "#ffffff"],
    ["#fb7185", "#ffe4e6", "#fff1f2"],
    ["#e879f9", "#fae8ff", "#ffffff"],
  ];
  const GROW_FRAMES = 45;
  let flowers = [];
  let fallen = [];
  let size = { width: 0, height: 0 };
  let running = false;

  const pickPalette = () => palettes[Math.floor(Math.random() * palettes.length)];
  const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);

  // Elongated petal pointing up from the origin
  function longPetal(length, width) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-width, -length * 0.3, -width * 0.9, -length * 0.85, 0, -length);
    ctx.bezierCurveTo(width * 0.9, -length * 0.85, width, -length * 0.3, 0, 0);
    ctx.fill();
  }

  function drawFlower(f, scale) {
    const [deep, light, inner] = f.palette;
    const r = f.radius;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rotation);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.min(1, f.age / 12);

    ctx.shadowColor = deep;
    ctx.shadowBlur = 18;
    for (let i = 0; i < f.count; i++) {
      ctx.save();
      ctx.rotate((Math.PI * 2 * i) / f.count);
      const gradient = ctx.createLinearGradient(0, 0, 0, -r);
      gradient.addColorStop(0, deep);
      gradient.addColorStop(1, light);
      ctx.fillStyle = gradient;
      longPetal(r, r * 0.42);
      ctx.restore();
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = inner;
    for (let i = 0; i < f.count; i++) {
      ctx.save();
      ctx.rotate((Math.PI * 2 * (i + 0.5)) / f.count);
      longPetal(r * 0.58, r * 0.26);
      ctx.restore();
    }

    ctx.fillStyle = "#ffd36e";
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4a340";
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.09, Math.sin(a) * r * 0.09, r * 0.03, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Turn a bloomed flower into drifting petals
  function shed(f) {
    for (let i = 0; i < f.count * 2; i++) {
      const angle = f.rotation + (Math.PI * 2 * i) / (f.count * 2) - Math.PI / 2;
      const speed = random(0.6, 2.4);
      fallen.push({
        x: f.x + Math.cos(angle) * f.radius * 0.5,
        y: f.y + Math.sin(angle) * f.radius * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.4,
        size: f.radius * random(0.32, 0.46),
        color: i % 2 ? f.palette[1] : f.palette[0],
        rotation: angle + Math.PI / 2,
        spin: random(-0.04, 0.04),
        tilt: Math.random() * Math.PI * 2,
        tiltSpeed: random(0.03, 0.06),
        life: 1,
        decay: random(0.005, 0.01),
      });
    }
  }

  // Smaller flowers on narrow screens so they do not crowd the cake
  function bloom(x, y, radius = random(30, 62) * Math.min(1, Math.max(0.55, size.width / 1000))) {
    flowers.push({
      x,
      y,
      radius,
      count: Math.round(random(5, 8)),
      rotation: Math.random() * Math.PI * 2,
      spin: random(-0.006, 0.006),
      age: 0,
      life: Math.round(random(120, 170)),
      palette: pickPalette(),
    });
    start();
  }

  function launch() {
    if (document.hidden) return;
    const { width, height } = size;
    // Keep automatic blooms to the sides so the title stays readable
    const side = Math.random() < 0.5 ? random(0.04, 0.28) : random(0.72, 0.96);
    bloom(width * side, random(height * 0.12, height * 0.6));
  }

  // Tiny short-lived petals, used for the pointer trail
  function glitter(x, y) {
    fallen.push({
      x,
      y,
      vx: random(-0.5, 0.5),
      vy: random(0.2, 0.8),
      size: random(5, 8),
      color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      spin: random(-0.06, 0.06),
      tilt: Math.random() * Math.PI * 2,
      tiltSpeed: 0.08,
      life: 1,
      decay: random(0.025, 0.04),
    });
    start();
  }

  function tick() {
    const { width, height } = size;
    ctx.clearRect(0, 0, width, height);

    flowers = flowers.filter((f) => {
      f.age++;
      f.rotation += f.spin;
      drawFlower(f, easeOutBack(Math.min(f.age / GROW_FRAMES, 1)));
      if (f.age >= f.life) {
        shed(f);
        return false;
      }
      return true;
    });

    fallen = fallen.filter((p) => {
      p.vx *= 0.985;
      p.vy = Math.min(p.vy * 0.985 + 0.03, 1.6);
      p.tilt += p.tiltSpeed;
      p.rotation += p.spin;
      p.x += p.vx + Math.sin(p.tilt) * 0.4;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) return false;
      paintPetal(ctx, p, p.life);
      return true;
    });

    if (flowers.length || fallen.length) {
      requestAnimationFrame(tick);
    } else {
      running = false;
    }
  }

  function start() {
    if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
  }

  size = fitCanvas(canvas, ctx);
  window.addEventListener("resize", () => (size = fitCanvas(canvas, ctx)));

  return {
    launch,
    bloom,
    glitter,
    show(count) {
      for (let i = 0; i < count; i++) setTimeout(launch, i * random(250, 450));
    },
  };
})();

// Music-box "Happy Birthday" (public domain melody) and a soft pop, synthesized with Web Audio
const sound = (() => {
  const NOTES = { G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99 };
  const MELODY = [
    ["G4", 0.75], ["G4", 0.25], ["A4", 1], ["G4", 1], ["C5", 1], ["B4", 2],
    ["G4", 0.75], ["G4", 0.25], ["A4", 1], ["G4", 1], ["D5", 1], ["C5", 2],
    ["G4", 0.75], ["G4", 0.25], ["G5", 1], ["E5", 1], ["C5", 1], ["B4", 1], ["A4", 2],
    ["F5", 0.75], ["F5", 0.25], ["E5", 1], ["C5", 1], ["D5", 1], ["C5", 3],
  ];
  const BEAT = 0.36;
  let audio = null;
  let master = null;
  let enabled = true;
  let voices = [];
  let endTimer = 0;

  function ensureAudio() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audio) {
      audio = new AudioCtx();
      master = audio.createGain();
      master.gain.value = 0.22;
      master.connect(audio.destination);
    }
    if (audio.state === "suspended") audio.resume();
    return audio;
  }

  function tone(freq, start, duration) {
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.5, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration * 1.8 + 0.2);
    gain.connect(master);

    // Triangle body plus a quiet octave for the music-box shimmer
    [["triangle", freq, 1], ["sine", freq * 2, 0.35]].forEach(([type, f, level]) => {
      const osc = audio.createOscillator();
      const oscGain = audio.createGain();
      osc.type = type;
      osc.frequency.value = f;
      oscGain.gain.value = level;
      osc.connect(oscGain).connect(gain);
      osc.start(start);
      osc.stop(start + duration * 1.8 + 0.25);
      voices.push(osc);
    });
  }

  function stop() {
    voices.forEach((osc) => {
      try {
        osc.stop();
      } catch (error) {
        // Already stopped
      }
    });
    voices = [];
    clearTimeout(endTimer);
    document.body.classList.remove("is-playing");
  }

  return {
    playMelody() {
      if (!enabled || !ensureAudio()) return;
      stop();
      let time = audio.currentTime + 0.1;
      for (const [note, beats] of MELODY) {
        tone(NOTES[note], time, beats * BEAT);
        time += beats * BEAT;
      }
      document.body.classList.add("is-playing");
      endTimer = setTimeout(stop, (time - audio.currentTime + 0.5) * 1000);
    },
    pop() {
      if (!enabled || !ensureAudio()) return;
      const length = Math.floor(audio.sampleRate * 0.12);
      const buffer = audio.createBuffer(1, length, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
      const noise = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 900;
      noise.buffer = buffer;
      noise.connect(filter).connect(master);
      noise.start();
    },
    stop,
    setEnabled(value) {
      enabled = value;
      if (!value) stop();
    },
  };
})();

// Rotating wishes under the title
function setupTagline() {
  const text = document.querySelector(".tagline__text");
  const lines = [
    text.textContent,
    "Chúc chị luôn xinh đẹp và rạng rỡ như những đóa hoa",
    "Mạnh khỏe, bình an và thật nhiều niềm vui",
    "Hạnh phúc ngập tràn bên những người thân yêu",
  ];
  let index = 0;

  if (reducedMotion.matches) return;

  setInterval(async () => {
    if (document.hidden) return;
    text.classList.add("is-leaving");
    await wait(400);
    index = (index + 1) % lines.length;
    text.textContent = lines[index];
    text.classList.remove("is-leaving");
    text.classList.add("is-entering");
    // Force a reflow so the entering state applies before transitioning back
    void text.offsetWidth;
    text.classList.remove("is-entering");
  }, 4200);
}

// Tap a floating flower to scatter its petals; it blooms again a few seconds later
function setupBlossoms() {
  document.querySelectorAll(".blossom").forEach((blossom) => {
    const flower = blossom.querySelector("svg");

    flower.addEventListener("click", (event) => {
      event.stopPropagation();
      if (blossom.classList.contains("is-popped")) return;

      const rect = flower.getBoundingClientRect();
      const style = getComputedStyle(blossom);
      const colors = [style.getPropertyValue("--c").trim(), style.getPropertyValue("--c2").trim(), "#ffd1e3"];
      blossom.classList.add("is-popped");
      sound.pop();
      if (!reducedMotion.matches) {
        petals.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, 40, {
          spread: Math.PI * 2,
          speed: 5,
          colors,
        });
      }

      setTimeout(() => {
        blossom.classList.remove("is-popped");
        blossom.style.animation = "none";
        void blossom.offsetWidth;
        blossom.style.animation = "";
      }, 4000);
    });
  });
}

// Tap the sky to make a flower bloom; on desktop the pointer leaves a trail of petals
function setupSkyEffects() {
  if (reducedMotion.matches) return;

  document.addEventListener("click", (event) => {
    if (event.target.closest("button, .cake, .blossom, .wish")) return;
    blooms.bloom(event.clientX, event.clientY);
  });

  if (finePointer.matches) {
    let last = 0;
    document.addEventListener("pointermove", (event) => {
      const now = performance.now();
      if (now - last < 60) return;
      last = now;
      blooms.glitter(event.clientX, event.clientY);
    });
  }
}

// Type text into an element; resolves false if cancelled
let typingRun = 0;
async function typeText(element, text) {
  const run = ++typingRun;
  element.textContent = "";
  element.classList.add("is-typing");

  for (let i = 1; i <= text.length; i++) {
    if (run !== typingRun) return false;
    element.textContent = text.slice(0, i);
    await wait(/[,.!]/.test(text[i - 1]) ? 220 : 26);
  }

  element.classList.remove("is-typing");
  return true;
}

// Countdown, blow out, celebrate; or relight
function setupCandles() {
  const cake = document.querySelector(".cake");
  const button = document.querySelector("#blow-button");
  const label = button.querySelector(".btn__label");
  const wish = document.querySelector(".wish");
  const hint = document.querySelector(".hint");
  const countdown = document.querySelector(".countdown");
  const countdownNum = countdown.querySelector(".countdown__num");
  const wishText = wish.querySelector(".wish__full").textContent.trim();
  const typed = wish.querySelector(".wish__typed");
  let busy = false;

  wish.querySelector(".wish__ghost").textContent = wishText;

  async function runCountdown() {
    countdown.hidden = false;
    for (const n of [3, 2, 1]) {
      countdownNum.textContent = n;
      countdownNum.classList.remove("is-ticking");
      void countdownNum.offsetWidth;
      countdownNum.classList.add("is-ticking");
      await wait(800);
    }
    countdown.hidden = true;
  }

  async function celebrate() {
    cake.classList.add("is-out");
    document.body.classList.add("is-celebrating");
    button.classList.add("btn--ghost");
    label.textContent = "Thắp lại nến";
    hint.hidden = true;
    wish.hidden = false;
    wish.classList.remove("is-typed");

    sound.playMelody();

    if (!reducedMotion.matches) {
      const rect = cake.getBoundingClientRect();
      petals.burst(rect.left + rect.width / 2, rect.top + rect.height * 0.25);
      blooms.show(7);
    }

    // On short screens the wish card pushes the button below the fold
    button.scrollIntoView({ block: "nearest", behavior: reducedMotion.matches ? "auto" : "smooth" });

    if (reducedMotion.matches) {
      typed.textContent = wishText;
    } else if (!(await typeText(typed, wishText))) {
      return;
    }
    wish.classList.add("is-typed");
  }

  function relight() {
    typingRun++;
    sound.stop();
    cake.classList.remove("is-out");
    document.body.classList.remove("is-celebrating");
    button.classList.remove("btn--ghost");
    label.textContent = "Thổi nến";
    typed.textContent = "";
    typed.classList.remove("is-typing");
    wish.classList.remove("is-typed");
    wish.hidden = true;
    hint.hidden = false;
  }

  async function toggleCandles() {
    if (busy) return;

    if (cake.classList.contains("is-out")) {
      relight();
      return;
    }

    busy = true;
    button.setAttribute("aria-disabled", "true");
    await runCountdown();
    busy = false;
    button.removeAttribute("aria-disabled");
    celebrate();
  }

  button.addEventListener("click", toggleCandles);
  cake.addEventListener("click", toggleCandles);
}

function setupSoundToggle() {
  const toggle = document.querySelector(".sound-toggle");

  toggle.addEventListener("click", () => {
    const enabled = toggle.getAttribute("aria-pressed") !== "true";
    toggle.setAttribute("aria-pressed", String(enabled));
    sound.setEnabled(enabled);
    if (enabled && document.body.classList.contains("is-celebrating")) sound.playMelody();
  });
}

// Sky blooms pace: occasional before the wish, frequent while celebrating
function scheduleBlooms() {
  if (reducedMotion.matches) return;

  const next = () => {
    const celebrating = document.body.classList.contains("is-celebrating");
    blooms.launch();
    setTimeout(next, celebrating ? random(900, 2000) : random(4500, 8000));
  };

  setTimeout(() => blooms.show(3), 2600);
  setTimeout(next, 6000);
}

createStars(window.innerWidth < 640 ? 50 : 110);
setupTagline();
setupBlossoms();
setupSkyEffects();
setupCandles();
setupSoundToggle();
scheduleBlooms();

if (!reducedMotion.matches) {
  setTimeout(() => petals.setAmbient(window.innerWidth < 640 ? 18 : 36), 2200);
}
