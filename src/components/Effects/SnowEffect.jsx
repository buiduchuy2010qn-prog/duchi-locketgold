import React, { useEffect, useRef, useMemo } from "react";
import "./snow.css";

/**
 * Canvas snow — single fixed canvas, particle pool, rAF.
 * Pink mode — DOM-based hardware accelerated CSS animations with ❄❅❆.
 * No JS loop for pink mode. Does not capture pointer events.
 * Never draws into camera MediaStream or capture canvas.
 */
const SnowEffect = ({
  maxFlakes = 28,
  pinkMode = false,
  aiMode = false,
  className = "",
  /** static flakes only (reduced-motion) */
  staticOnly = false,
  reduceMotion = false,
}) => {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const particlesRef = useRef([]);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });

  // DOM Snow for AI Mode
  const domFlakes = useMemo(() => {
    if (!aiMode) return [];
    
    const arr = [];
    const count = Math.max(0, Math.min(150, Number(maxFlakes) || 0));
    
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      const isRound = r < 0.55;
      const isLarge = !isRound;
      
      let char = '';
      if (!isRound) {
        if (r < 0.85) char = '❄';
        else char = Math.random() < 0.5 ? '❅' : '❆';
      }
      
      const left = Math.random() * 100;
      const animDuration = 7 + Math.random() * 9; // 7-16s
      const swayDuration = 2 + Math.random() * 3;
      const animDelay = -(Math.random() * 20); // negative delay to fill screen
      
      const size = isRound ? 2 + Math.random() * 4 : 10 + Math.random() * 12;
      
      const colors = ['#ffffff', '#fff0f5', '#ffe4ed'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const opacity = 0.4 + Math.random() * 0.6;
      
      arr.push({
        id: i,
        char,
        isRound,
        xStyle: {
          left: `${left}vw`,
          animationDuration: `${swayDuration}s`,
          animationDelay: `${animDelay}s`,
          zIndex: isLarge ? 20 : 10,
        },
        yStyle: {
          fontSize: `${size}px`,
          color,
          opacity,
          animationDuration: `${animDuration}s`,
          animationDelay: `${animDelay}s`,
          width: isRound ? `${size}px` : 'auto',
          height: isRound ? `${size}px` : 'auto',
          backgroundColor: isRound ? color : 'transparent',
          borderRadius: isRound ? '50%' : '0'
        }
      });
    }
    return arr;
  }, [aiMode, maxFlakes]);

  useEffect(() => {
    if (aiMode) return; // Skip canvas loop for aiMode

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let alive = true;
    const particles = particlesRef.current;

    const cap = Math.max(0, Math.min(150, Number(maxFlakes) || 0));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const colorFor = () => {
      return "rgba(255,255,255,";
    };

    const resetParticle = (p, spawnTop) => {
      const { w, h } = sizeRef.current;
      p.x = Math.random() * w;
      p.y = spawnTop ? -4 - Math.random() * 40 : Math.random() * h;
      
      const layerRand = Math.random();
      if (layerRand < 0.5) {
        p.r = 1.0 + Math.random() * 1.5;
        p.speed = 0.2 + Math.random() * 0.4;
        p.op = 0.2 + Math.random() * 0.3;
      } else if (layerRand < 0.85) {
        p.r = 2.0 + Math.random() * 2.0;
        p.speed = 0.5 + Math.random() * 0.7;
        p.op = 0.4 + Math.random() * 0.4;
      } else {
        p.r = 3.5 + Math.random() * 3.5;
        p.speed = 1.0 + Math.random() * 0.8;
        p.op = 0.6 + Math.random() * 0.4;
      }

      p.drift = (Math.random() - 0.5) * 0.6;
      p.phase = Math.random() * Math.PI * 2;
      p.color = colorFor();
      p.kind = Math.random() < 0.6 ? 0 : Math.random() < 0.8 ? 1 : 2; 
    };

    // Build / trim pool (reuse — no alloc in loop)
    while (particles.length < cap) {
      const p = {};
      resetParticle(p, false);
      particles.push(p);
    }
    if (particles.length > cap) particles.length = cap;

    resize();

    const drawFlake = (p) => {
      ctx.globalAlpha = p.op;
      ctx.fillStyle = p.color + "1)";
      if (p.kind === 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (p.kind === 1) {
        // soft 4-point spark
        const s = p.r * 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s);
        ctx.lineTo(p.x + s * 0.35, p.y);
        ctx.lineTo(p.x, p.y + s);
        ctx.lineTo(p.x - s * 0.35, p.y);
        ctx.closePath();
        ctx.fill();
        return;
      }
      // simple cross snow
      const s = p.r * 1.2;
      ctx.strokeStyle = p.color + "1)";
      ctx.lineWidth = Math.max(0.8, p.r * 0.35);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.x - s, p.y);
      ctx.lineTo(p.x + s, p.y);
      ctx.moveTo(p.x, p.y - s);
      ctx.lineTo(p.x, p.y + s);
      ctx.stroke();
    };

    const paintStatic = () => {
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        drawFlake(particles[i]);
      }
      ctx.globalAlpha = 1;
    };

    let last = 0;
    const tick = (now) => {
      if (!alive) return;
      if (document.hidden) {
        rafRef.current = 0;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
      if (staticOnly) return;

      const dt = Math.min(32, now - last || 16);
      last = now;
      const { w, h } = sizeRef.current;
      ctx.clearRect(0, 0, w, h);

      const speedMult = reduceMotion ? 0.3 : 1;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.phase += (dt * 0.0012) * speedMult;
        p.y += p.speed * (dt * 0.06) * speedMult;
        p.x += (p.drift + Math.sin(p.phase) * 0.15) * speedMult;
        if (p.y > h + 8 || p.x < -12 || p.x > w + 12) {
          resetParticle(p, true);
        }
        drawFlake(p);
      }
      ctx.globalAlpha = 1;
    };

    const onVis = () => {
      if (document.hidden) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
        return;
      }
      if (!staticOnly && !rafRef.current) {
        last = performance.now();
        rafRef.current = requestAnimationFrame(tick);
      } else if (staticOnly) {
        paintStatic();
      }
    };

    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVis);

    if (staticOnly) {
      paintStatic();
    } else {
      last = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } catch {
        /* ignore */
      }
    };
  }, [maxFlakes, aiMode, staticOnly, reduceMotion]);

  if (aiMode) {
    return (
      <div className={`snow-layer dom-snow-container ${pinkMode ? 'snow-layer--pink' : ''} ${className}`.trim()} aria-hidden="true">
        {domFlakes.map(f => (
          <div key={f.id} className="dom-snowflake-x" style={f.xStyle}>
            <div className="dom-snowflake-y" style={f.yStyle}>
              {f.char}
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
    />
  );
};

export default SnowEffect;
