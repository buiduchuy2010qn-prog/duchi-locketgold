import { useEffect, useMemo, useRef } from "react";
import "./snow.css";

const TAU = Math.PI * 2;
const randomBetween = (min, max) => min + Math.random() * (max - min);

/**
 * Decorative snow only. Pink Snow uses one pooled canvas; the legacy AI
 * variant keeps its existing DOM renderer. Neither path touches media/camera
 * canvases or participates in capture output.
 */
const SnowEffect = ({
  maxFlakes = 28,
  pinkMode = false,
  aiMode = false,
  className = "",
  staticOnly = false,
  reduceMotion = false,
}) => {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const particlesRef = useRef([]);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  const domFlakes = useMemo(() => {
    if (!aiMode) return [];

    const flakes = [];
    const count = Math.max(0, Math.min(150, Number(maxFlakes) || 0));

    for (let i = 0; i < count; i += 1) {
      const kindRoll = Math.random();
      const isRound = kindRoll < 0.55;
      const char = isRound
        ? ""
        : kindRoll < 0.85
          ? "\u2744"
          : Math.random() < 0.5
            ? "\u2745"
            : "\u2746";
      const size = isRound
        ? randomBetween(2, 6)
        : randomBetween(10, 22);
      const colors = ["#ffffff", "#fff0f5", "#ffe4ed"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const delay = -randomBetween(0, 20);

      flakes.push({
        id: i,
        char,
        xStyle: {
          left: `${randomBetween(0, 100)}vw`,
          animationDuration: `${randomBetween(2, 5)}s`,
          animationDelay: `${delay}s`,
          zIndex: isRound ? 10 : 20,
        },
        yStyle: {
          width: isRound ? `${size}px` : "auto",
          height: isRound ? `${size}px` : "auto",
          borderRadius: isRound ? "50%" : "0",
          backgroundColor: isRound ? color : "transparent",
          color,
          fontSize: `${size}px`,
          opacity: randomBetween(0.4, 1),
          animationDuration: `${randomBetween(7, 16)}s`,
          animationDelay: `${delay}s`,
        },
      });
    }

    return flakes;
  }, [aiMode, maxFlakes]);

  useEffect(() => {
    if (aiMode) return undefined;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return undefined;

    let alive = true;
    let lastTime = 0;
    const particles = particlesRef.current;
    const cap = Math.max(0, Math.min(120, Number(maxFlakes) || 0));

    const resize = () => {
      const previous = sizeRef.current;
      const w = Math.max(1, window.innerWidth || 1);
      const h = Math.max(1, window.innerHeight || 1);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (previous.w > 0 && previous.h > 0) {
        const scaleX = w / previous.w;
        const scaleY = h / previous.h;
        for (let i = 0; i < particles.length; i += 1) {
          particles[i].x *= scaleX;
          particles[i].y *= scaleY;
        }
      }

      sizeRef.current = { w, h, dpr };
    };

    const resetParticle = (particle, spawnAbove) => {
      const { w, h } = sizeRef.current;

      if (!pinkMode) {
        particle.kind =
          Math.random() < 0.6 ? 0 : Math.random() < 0.72 ? 1 : 2;
        particle.depth = randomBetween(0.35, 1);
        particle.size = randomBetween(1.2, 4.8) * particle.depth;
        particle.speed = randomBetween(24, 66) * particle.depth;
        particle.alpha = randomBetween(0.25, 0.75);
      } else {
        const layerRoll = Math.random();
        particle.depth =
          layerRoll < 0.45
            ? randomBetween(0.28, 0.5)
            : layerRoll < 0.84
              ? randomBetween(0.52, 0.8)
              : randomBetween(0.82, 1);

        const kindRoll = Math.random();
        particle.kind =
          kindRoll < 0.3
            ? 0
            : kindRoll < 0.48
              ? 1
              : kindRoll < 0.75
                ? 2
                : kindRoll < 0.9
                  ? 3
                  : 4;

        const depth = particle.depth;
        if (particle.kind === 0) {
          particle.size = randomBetween(1.4, 3.8) * (0.65 + depth * 0.45);
        } else if (particle.kind === 1) {
          particle.size = randomBetween(2.8, 5.4) * (0.7 + depth * 0.4);
        } else if (particle.kind === 2) {
          particle.size = randomBetween(4, 7.2) * (0.72 + depth * 0.42);
        } else if (particle.kind === 3) {
          particle.size = randomBetween(8, 13) * (0.76 + depth * 0.34);
        } else {
          particle.size = randomBetween(7, 15);
        }

        particle.speed =
          particle.kind === 4
            ? randomBetween(118, 178)
            : randomBetween(32, 92) * (0.72 + depth * 0.58);
        particle.alpha =
          randomBetween(0.34, 0.72) + (particle.kind === 3 ? 0.08 : 0);
      }

      particle.x = randomBetween(-16, w + 16);
      particle.y = spawnAbove
        ? -particle.size - randomBetween(4, Math.max(28, h * 0.18))
        : randomBetween(-h * 0.08, h + particle.size);
      particle.phase = randomBetween(0, TAU);
      particle.phaseSpeed = randomBetween(0.65, 1.55);
      particle.sway = randomBetween(5, 20) * particle.depth;
      particle.wind = randomBetween(-4, 12);
      particle.rotation = randomBetween(0, TAU);
      particle.rotationSpeed = randomBetween(-0.8, 0.8);
    };

    const drawRoundFlake = (particle) => {
      const radius = particle.size;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, radius, 0, TAU);
      ctx.fill();

      ctx.fillStyle = "rgba(255,240,248,0.82)";
      ctx.beginPath();
      ctx.arc(
        particle.x - radius * 0.24,
        particle.y - radius * 0.24,
        Math.max(0.55, radius * 0.42),
        0,
        TAU,
      );
      ctx.fill();
    };

    const drawSmallCrystal = (particle) => {
      const size = particle.size;
      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = "rgba(255,248,252,0.9)";
      ctx.strokeStyle = "rgba(255,255,255,0.92)";
      ctx.lineWidth = Math.max(0.7, size * 0.16);
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.38, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.38, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    const drawCrystalFlake = (particle, large) => {
      const size = particle.size;
      const branch = size * (large ? 0.3 : 0.24);

      ctx.save();
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.strokeStyle = large
        ? "rgba(255,255,255,0.96)"
        : "rgba(255,247,251,0.9)";
      ctx.lineWidth = Math.max(0.7, size * (large ? 0.13 : 0.11));
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();

      for (let arm = 0; arm < 6; arm += 1) {
        const angle = arm * (Math.PI / 3);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const branchX = cos * size * 0.58;
        const branchY = sin * size * 0.58;

        ctx.moveTo(0, 0);
        ctx.lineTo(cos * size, sin * size);
        ctx.moveTo(branchX, branchY);
        ctx.lineTo(
          branchX + Math.cos(angle + 2.36) * branch,
          branchY + Math.sin(angle + 2.36) * branch,
        );
        ctx.moveTo(branchX, branchY);
        ctx.lineTo(
          branchX + Math.cos(angle - 2.36) * branch,
          branchY + Math.sin(angle - 2.36) * branch,
        );

        if (large) {
          const innerX = cos * size * 0.34;
          const innerY = sin * size * 0.34;
          ctx.moveTo(innerX, innerY);
          ctx.lineTo(
            innerX + Math.cos(angle + 2.36) * branch * 0.72,
            innerY + Math.sin(angle + 2.36) * branch * 0.72,
          );
          ctx.moveTo(innerX, innerY);
          ctx.lineTo(
            innerX + Math.cos(angle - 2.36) * branch * 0.72,
            innerY + Math.sin(angle - 2.36) * branch * 0.72,
          );
        }
      }

      ctx.stroke();
      ctx.fillStyle = large
        ? "rgba(255,224,239,0.92)"
        : "rgba(255,255,255,0.88)";
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(0.8, size * 0.13), 0, TAU);
      ctx.fill();
      ctx.restore();
    };

    const drawSleet = (particle) => {
      const lean = particle.wind * 0.08;
      ctx.strokeStyle = "rgba(255,255,255,0.78)";
      ctx.lineWidth = Math.max(0.7, particle.depth * 1.25);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y);
      ctx.lineTo(
        particle.x + lean,
        particle.y + particle.size,
      );
      ctx.stroke();
    };

    const drawParticle = (particle) => {
      ctx.globalAlpha = Math.min(0.86, particle.alpha);
      if (particle.kind === 0) {
        drawRoundFlake(particle);
      } else if (particle.kind === 1) {
        drawSmallCrystal(particle);
      } else if (particle.kind === 2) {
        drawCrystalFlake(particle, false);
      } else if (particle.kind === 3) {
        drawCrystalFlake(particle, true);
      } else {
        drawSleet(particle);
      }
    };

    const paint = (deltaSeconds, move) => {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);
      const motionScale = reduceMotion ? 0.38 : 1;

      for (let i = 0; i < particles.length; i += 1) {
        const particle = particles[i];

        if (move) {
          particle.phase +=
            particle.phaseSpeed * deltaSeconds * motionScale;
          particle.rotation +=
            particle.rotationSpeed * deltaSeconds * motionScale;
          particle.y += particle.speed * deltaSeconds * motionScale;
          particle.x +=
            (particle.wind + Math.sin(particle.phase) * particle.sway) *
            deltaSeconds *
            motionScale;

          if (
            particle.y > h + particle.size + 18 ||
            particle.x < -48 ||
            particle.x > w + 48
          ) {
            resetParticle(particle, true);
          }
        }

        drawParticle(particle);
      }

      ctx.globalAlpha = 1;
    };

    const tick = (now) => {
      if (!alive || document.hidden) {
        rafRef.current = 0;
        return;
      }

      const deltaSeconds = Math.min(0.04, (now - lastTime || 16.67) / 1000);
      lastTime = now;
      paint(deltaSeconds, true);
      rafRef.current = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!alive || staticOnly || document.hidden || rafRef.current) return;
      lastTime = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        return;
      }

      if (staticOnly) {
        paint(0, false);
      } else {
        start();
      }
    };

    const onResize = () => {
      resize();
      if (staticOnly) paint(0, false);
    };

    resize();
    while (particles.length < cap) {
      const particle = {};
      resetParticle(particle, false);
      particles.push(particle);
    }
    if (particles.length > cap) particles.length = cap;

    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    if (staticOnly) {
      paint(0, false);
    } else {
      start();
    }

    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [aiMode, maxFlakes, pinkMode, reduceMotion, staticOnly]);

  if (aiMode) {
    return (
      <div
        className={`snow-layer dom-snow-container ${pinkMode ? "snow-layer--pink" : ""} ${className}`.trim()}
        aria-hidden="true"
        data-decorative-fx="true"
      >
        {domFlakes.map((flake) => (
          <div key={flake.id} className="dom-snowflake-x" style={flake.xStyle}>
            <div className="dom-snowflake-y" style={flake.yStyle}>
              {flake.char}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`snow-layer snow-layer--canvas ${className}`.trim()}
      aria-hidden="true"
      data-decorative-fx="true"
      data-snow-canvas="true"
      data-snow-variant={pinkMode ? "pinksnow" : "standard"}
    />
  );
};

export default SnowEffect;
