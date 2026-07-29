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

    // Performance configurations
    const perf = getPerfProfile();
    // Default targets
    let targetBubbles = 30;
    let targetFishes = 5;

    if (perf.isMobile || perf.isLowEnd) {
      targetBubbles = 15;
      targetFishes = 2;
    }
    if (reduceMotion) {
      targetBubbles = Math.floor(targetBubbles / 2);
      targetFishes = 1;
    }

    // Limit DPR to 1.5 to save performance on retina displays
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener("resize", resize);
    resize();

    // ------------------- BUBBLES -------------------
    class Bubble {
      constructor() {
        this.reset(true);
      }
      reset(randomY = false) {
        this.x = Math.random() * width;
        this.y = randomY ? Math.random() * height : height + 10;
        this.size = Math.random() * 4 + 2; // 2px to 6px
        this.speedY = (Math.random() * 0.8 + 0.4) * (reduceMotion ? 0.3 : 1);
        this.wobbleSpeed = Math.random() * 0.02 + 0.01;
        this.wobbleAmp = Math.random() * 1.5 + 0.5;
        this.angle = Math.random() * Math.PI * 2;
        this.opacity = Math.random() * 0.3 + 0.4; // 0.4 to 0.7 for better visibility
      }
      update() {
        this.y -= this.speedY;
        this.angle += this.wobbleSpeed;
        if (this.y < -10) {
          this.reset();
        }
      }
      draw(ctx) {
        const currentX = this.x + Math.sin(this.angle) * this.wobbleAmp;
        ctx.beginPath();
        ctx.arc(currentX, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.fill();
      }
    }

    // ------------------- FISHES -------------------
    // Use clear/visible colors for ocean background
    const fishColors = ["#075985", "#0f766e", "#eab308", "#f43f5e", "#14b8a6"];
    class Fish {
      constructor() {
        this.reset(true);
      }
      reset(randomX = false) {
        this.direction = Math.random() > 0.5 ? 1 : -1; // 1 = right, -1 = left
        this.x = randomX
          ? Math.random() * width
          : this.direction === 1
          ? -50
          : width + 50;
        this.y = Math.random() * (height * 0.7) + height * 0.15; // Swim within middle 70%
        // Fish size: 12 to 24
        this.size = Math.random() * 12 + 12;
        // Speed: 0.5 to 1.5
        this.speedX = (Math.random() * 1 + 0.5) * (reduceMotion ? 0.3 : 1);
        this.wobbleSpeed = Math.random() * 0.02 + 0.01;
        this.wobbleAmp = Math.random() * 0.5 + 0.2;
        this.angle = Math.random() * Math.PI * 2;
        this.color = fishColors[Math.floor(Math.random() * fishColors.length)];
        this.opacity = Math.random() * 0.2 + 0.8; // Higher opacity to be visible
      }
      update() {
        this.x += this.speedX * this.direction;
        this.angle += this.wobbleSpeed;
        if (
          (this.direction === 1 && this.x > width + 50) ||
          (this.direction === -1 && this.x < -50)
        ) {
          this.reset();
        }
      }
      draw(ctx) {
        const currentY = this.y + Math.sin(this.angle) * this.wobbleAmp;
        ctx.save();
        ctx.translate(this.x, currentY);
        // Flip horizontally if swimming left
        if (this.direction === -1) {
          ctx.scale(-1, 1);
        }
        
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        
        // Draw Fish Body (Ellipse-like)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(this.size, -this.size * 0.6, this.size * 2, 0);
        ctx.quadraticCurveTo(this.size, this.size * 0.6, 0, 0);
        ctx.fill();

        // Draw Tail
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-this.size * 0.6, -this.size * 0.5);
        ctx.lineTo(-this.size * 0.6, this.size * 0.5);
        ctx.closePath();
        ctx.fill();

        // Draw Eye
        ctx.globalAlpha = this.opacity * 0.9;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(this.size * 1.5, -this.size * 0.1, this.size * 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(this.size * 1.5 + 1, -this.size * 0.1, this.size * 0.05, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }

    const bubbles = Array.from({ length: targetBubbles }, () => new Bubble());
    const fishes = Array.from({ length: targetFishes }, () => new Fish());

    // ------------------- ANIMATION LOOP -------------------
    const render = () => {
      if (!isVisible) return; // Stop drawing when hidden

      ctx.clearRect(0, 0, width, height);

      bubbles.forEach((b) => {
        b.update();
        b.draw(ctx);
      });

      fishes.forEach((f) => {
        f.update();
        f.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(render);
    };

    if (isVisible) {
      render();
    }

    // ------------------- VISIBILITY / OBSERVER -------------------
    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === "visible";
      if (isVisible) {
        render();
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
