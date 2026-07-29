import React, { useEffect, useRef } from "react";
import { getPerfProfile } from "@/utils/device/perfProfile";

/**
 * OceanEffect: Renders swimming fishes and rising bubbles using a single Canvas.
 * - Fishes swim horizontally and flip when changing direction.
 * - Bubbles rise from the bottom to the top.
 * - Reacts to prefers-reduced-motion and performance profiles.
 * - Stops animating when not visible to save battery.
 */
const OceanEffect = ({ reduceMotion }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId;
    let width = 0;
    let height = 0;
    let isVisible = true;
    let lastTime = performance.now();

    // Performance configurations
    const perf = getPerfProfile();
    let targetBubbles = 25;
    let targetFishes = 4;

    let maxFishSize = 48;
    let minFishSize = 24;

    if (perf.isMobile || perf.isLowEnd) {
      targetBubbles = 15;
      targetFishes = 2;
      maxFishSize = 36;
      minFishSize = 20;
    }
    if (reduceMotion) {
      targetBubbles = Math.floor(targetBubbles / 2);
      targetFishes = 1;
    }

    // Limit DPR to 1.5
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    window.addEventListener("resize", resize);
    resize();

    // ------------------- BUBBLES -------------------
    class Bubble {
      constructor(isChild = false, parent = null) {
        this.isChild = isChild;
        this.parent = parent;
        this.reset(true);
      }
      reset(randomY = false) {
        if (this.isChild && this.parent) {
          this.x = this.parent.x + (Math.random() * 20 - 10);
          this.y = this.parent.y + (Math.random() * 20 - 10);
          this.size = this.parent.size * (Math.random() * 0.4 + 0.4);
        } else {
          this.x = Math.random() * width;
          this.y = randomY ? Math.random() * height : height + Math.random() * 100 + 20;
          this.size = Math.random() * 17 + 5; // 5 to 22
        }
        
        // Bigger bubbles rise slower
        const baseSpeed = 30 / this.size; 
        this.speedY = (baseSpeed + Math.random() * 10) * (reduceMotion ? 0.3 : 1);
        this.wobbleSpeed = Math.random() * 2 + 1;
        this.wobbleAmp = Math.random() * 1.5 + 0.5;
        this.angle = Math.random() * Math.PI * 2;
        this.opacity = Math.random() * 0.45 + 0.35; // 0.35 to 0.8
      }
      update(dt) {
        this.y -= this.speedY * dt;
        this.angle += this.wobbleSpeed * dt;
        if (this.y < -30) {
          this.reset();
        }
      }
      draw(ctx) {
        const currentX = this.x + Math.sin(this.angle) * this.wobbleAmp;
        
        ctx.save();
        ctx.translate(currentX, this.y);
        ctx.globalAlpha = this.opacity;

        // Base bubble gradient
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, this.size);
        grad.addColorStop(0, "rgba(255,255,255,0.05)");
        grad.addColorStop(0.8, "rgba(200,240,255,0.2)");
        grad.addColorStop(1, "rgba(255,255,255,0.8)");

        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
        
        // Border
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.stroke();

        // Highlight top-left
        ctx.beginPath();
        ctx.ellipse(-this.size * 0.3, -this.size * 0.3, this.size * 0.2, this.size * 0.1, Math.PI / 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.fill();

        // Reflection bottom-right
        ctx.beginPath();
        ctx.arc(0, 0, this.size * 0.8, 0, Math.PI / 2);
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = this.size * 0.15;
        ctx.stroke();

        ctx.restore();
      }
    }

    // ------------------- FISHES -------------------
    const fishColors = [
      { primary: "#0d9488", secondary: "#14b8a6" }, // Teal
      { primary: "#f43f5e", secondary: "#fb7185" }, // Coral/Pink-Red
      { primary: "#eab308", secondary: "#fde047" }, // Yellow
      { primary: "#6366f1", secondary: "#818cf8" }, // Purple-Blue
      { primary: "#ec4899", secondary: "#f472b6" }  // Pink
    ];
    
    const patterns = ["stripes", "dots", "gradient"];

    class Fish {
      constructor() {
        this.reset(true);
      }
      reset(randomX = false) {
        this.direction = Math.random() > 0.5 ? 1 : -1;
        this.x = randomX
          ? Math.random() * width
          : this.direction === 1
          ? -100
          : width + 100;
        this.y = Math.random() * (height * 0.7) + height * 0.15;
        
        // Depth perception (0 = back, 1 = front)
        this.depth = Math.random();
        
        this.size = minFishSize + this.depth * (maxFishSize - minFishSize);
        this.opacity = 0.4 + this.depth * 0.6; // 0.4 to 1.0 based on depth
        
        this.speedX = (this.depth * 40 + 30) * (reduceMotion ? 0.3 : 1);
        this.wobbleSpeed = Math.random() * 2 + 1.5;
        this.wobbleAmp = this.depth * 15 + 5;
        
        this.time = Math.random() * 100;
        
        const colorObj = fishColors[Math.floor(Math.random() * fishColors.length)];
        this.primaryColor = colorObj.primary;
        this.secondaryColor = colorObj.secondary;
        this.pattern = patterns[Math.floor(Math.random() * patterns.length)];
      }
      
      update(dt) {
        this.time += dt;
        this.x += this.speedX * this.direction * dt;
        
        if (
          (this.direction === 1 && this.x > width + 100) ||
          (this.direction === -1 && this.x < -100)
        ) {
          this.reset();
        }
      }
      
      draw(ctx) {
        const currentY = this.y + Math.sin(this.time * this.wobbleSpeed) * this.wobbleAmp;
        const swimCycle = Math.sin(this.time * this.wobbleSpeed * 3);
        
        ctx.save();
        ctx.translate(this.x, currentY);
        
        if (this.direction === -1) {
          ctx.scale(-1, 1);
        }
        
        ctx.globalAlpha = this.opacity;
        
        const s = this.size;
        
        // Body pattern/gradient
        let fillStyle = this.primaryColor;
        if (this.pattern === "gradient") {
          const grad = ctx.createLinearGradient(s*1.5, 0, -s, 0);
          grad.addColorStop(0, this.primaryColor);
          grad.addColorStop(1, this.secondaryColor);
          fillStyle = grad;
        }
        
        // Dorsal Fin
        ctx.beginPath();
        ctx.moveTo(s * 0.5, -s * 0.4);
        ctx.quadraticCurveTo(s * 0.1, -s * 0.8 + swimCycle * s * 0.1, -s * 0.3, -s * 0.3);
        ctx.fillStyle = this.secondaryColor;
        ctx.fill();
        
        // Pelvic/Anal Fin
        ctx.beginPath();
        ctx.moveTo(s * 0.2, s * 0.4);
        ctx.quadraticCurveTo(-s * 0.1, s * 0.7 - swimCycle * s * 0.1, -s * 0.4, s * 0.2);
        ctx.fillStyle = this.secondaryColor;
        ctx.fill();

        // Tail (Two lobes)
        const tailFlex = swimCycle * s * 0.3;
        ctx.beginPath();
        ctx.moveTo(-s * 0.7, 0);
        ctx.quadraticCurveTo(-s * 1.2, -s * 0.6 + tailFlex, -s * 1.4, -s * 0.8 + tailFlex);
        ctx.quadraticCurveTo(-s * 1.1, 0, -s * 1.3, s * 0.8 + tailFlex);
        ctx.quadraticCurveTo(-s * 1.2, s * 0.6 + tailFlex, -s * 0.7, 0);
        ctx.fillStyle = this.primaryColor;
        ctx.fill();
        
        // Main Body (Bezier)
        ctx.beginPath();
        ctx.moveTo(s * 1.5, 0); // Nose
        ctx.bezierCurveTo(s * 1.2, -s * 0.8, -s * 0.2, -s * 0.6, -s * 0.8, 0); // Top curve
        ctx.bezierCurveTo(-s * 0.2, s * 0.6, s * 1.2, s * 0.8, s * 1.5, 0); // Bottom curve
        ctx.fillStyle = fillStyle;
        ctx.fill();
        
        // Patterns (Clip to body)
        if (this.pattern === "stripes" || this.pattern === "dots") {
          ctx.save();
          ctx.clip();
          ctx.fillStyle = this.secondaryColor;
          ctx.globalAlpha = this.opacity * 0.6;
          
          if (this.pattern === "stripes") {
            for (let i = -0.5; i < 1; i += 0.4) {
              ctx.beginPath();
              ctx.moveTo(s * i, -s);
              ctx.quadraticCurveTo(s * (i - 0.2), 0, s * i, s);
              ctx.lineWidth = s * 0.15;
              ctx.strokeStyle = this.secondaryColor;
              ctx.stroke();
            }
          } else if (this.pattern === "dots") {
            for (let i = 0; i < 4; i++) {
              ctx.beginPath();
              ctx.arc(s * (Math.random() - 0.2), s * (Math.random() * 0.8 - 0.4), s * 0.1, 0, Math.PI*2);
              ctx.fill();
            }
          }
          ctx.restore();
        }

        // Highlight back & Shadow belly
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(s * 1.5, 0);
        ctx.bezierCurveTo(s * 1.2, -s * 0.8, -s * 0.2, -s * 0.6, -s * 0.8, 0);
        ctx.lineWidth = s * 0.15;
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(s * 1.5, 0);
        ctx.bezierCurveTo(-s * 0.2, s * 0.6, s * 1.2, s * 0.8, s * 1.5, 0);
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.stroke();
        ctx.restore();

        // Gill Line
        ctx.beginPath();
        ctx.moveTo(s * 0.7, -s * 0.3);
        ctx.quadraticCurveTo(s * 0.5, 0, s * 0.7, s * 0.3);
        ctx.lineWidth = s * 0.05;
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.stroke();

        // Pectoral Fin (animates with swimCycle)
        ctx.beginPath();
        ctx.moveTo(s * 0.5, s * 0.1);
        ctx.quadraticCurveTo(s * 0.1, s * 0.3 - swimCycle * s * 0.2, s * 0.3, s * 0.5 - swimCycle * s * 0.1);
        ctx.quadraticCurveTo(s * 0.4, s * 0.3, s * 0.5, s * 0.1);
        ctx.fillStyle = this.secondaryColor;
        ctx.fill();

        // Eye
        const eyeX = s * 1.1;
        const eyeY = -s * 0.15;
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, s * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        
        // Pupil
        ctx.beginPath();
        ctx.arc(eyeX + s*0.03, eyeY, s * 0.07, 0, Math.PI * 2);
        ctx.fillStyle = "#000000";
        ctx.fill();
        
        // Eye Highlight
        ctx.beginPath();
        ctx.arc(eyeX + s*0.05, eyeY - s*0.03, s * 0.03, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        ctx.restore();
      }
    }

    const bubbles = [];
    for(let i=0; i<targetBubbles; i++) {
      const b = new Bubble();
      bubbles.push(b);
      // 30% chance to have a cluster of 1-2 child bubbles
      if (Math.random() < 0.3) {
        bubbles.push(new Bubble(true, b));
        if (Math.random() < 0.5) bubbles.push(new Bubble(true, b));
      }
    }
    
    const fishes = Array.from({ length: targetFishes }, () => new Fish());

    // ------------------- ANIMATION LOOP -------------------
    const render = (time) => {
      if (!isVisible) return;
      
      const dt = (time - lastTime) / 1000 || 0;
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      // Draw bubbles behind fishes
      bubbles.forEach((b) => {
        b.update(dt);
        b.draw(ctx);
      });

      // Draw fishes sorted by depth
      fishes.sort((a,b) => a.depth - b.depth).forEach((f) => {
        f.update(dt);
        f.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    if (isVisible) {
      animationFrameId = requestAnimationFrame(render);
    }

    // ------------------- VISIBILITY / OBSERVER -------------------
    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === "visible";
      if (isVisible) {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      } else {
        cancelAnimationFrame(animationFrameId);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, [reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-decorative-fx="true"
      className="ocean-effect-layer fixed inset-0 w-full h-full pointer-events-none z-[15]"
    />
  );
};

export default OceanEffect;
