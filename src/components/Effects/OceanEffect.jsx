import React, { useEffect, useRef } from "react";
import { getPerfProfile } from "@/utils/device/perfProfile";

const TAU = Math.PI * 2;

const FISH_VARIANTS = Object.freeze([
  Object.freeze({
    top: "#99f6e4",
    middle: "#14b8a6",
    bottom: "#0f766e",
    fin: "#2dd4bf",
    tail: "#0d9488",
    pattern: "stripes",
    patternColor: "rgba(224, 255, 250, 0.72)",
    diagonalGradient: false,
  }),
  Object.freeze({
    top: "#fed7aa",
    middle: "#fb7c3c",
    bottom: "#dc4f35",
    fin: "#fb923c",
    tail: "#f97356",
    pattern: "dots",
    patternColor: "rgba(255, 244, 214, 0.78)",
    diagonalGradient: false,
  }),
  Object.freeze({
    top: "#fde68a",
    middle: "#a78bfa",
    bottom: "#4338ca",
    fin: "#8b5cf6",
    tail: "#6366f1",
    pattern: "gradient",
    patternColor: "rgba(255, 255, 255, 0.42)",
    diagonalGradient: true,
  }),
]);

const randomBetween = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const OceanEffect = ({ reduceMotion = false }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;

    const perf = getPerfProfile();
    const deviceCompact = perf.isMobile || perf.isLowEnd;
    const motionScale = reduceMotion ? 0.44 : 1;
    const bubblePoolCount = reduceMotion ? 16 : 36;
    const fishPoolCount = reduceMotion ? 3 : 7;

    let width = 1;
    let height = 1;
    let dpr = 1;
    let rafId = 0;
    let lastTimestamp = 0;
    let disposed = false;

    const resizeCanvas = () => {
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
    };

    resizeCanvas();

    let compactMode = deviceCompact || width <= 640;
    let activeBubbleCount = compactMode
      ? reduceMotion
        ? 10
        : 20
      : bubblePoolCount;
    let activeFishCount = compactMode
      ? reduceMotion
        ? 2
        : 3
      : reduceMotion
        ? 3
        : width >= 1100
          ? 7
          : 6;
    let minFishLength = compactMode ? 20 : 27;
    let maxFishLength = compactMode ? 38 : 52;

    const bubbles = [];
    const bubbleClusters = [];

    const makeBubble = (poolIndex) => ({
      poolIndex,
      diameter: 8,
      radius: 4,
      x: 0,
      y: 0,
      speed: 40,
      phase: 0,
      wobbleRate: 1,
      wobbleAmount: 1,
      opacity: 0.5,
    });

    let remainingBubbles = bubblePoolCount;
    while (remainingBubbles > 0) {
      const firstCluster = bubbleClusters.length === 0;
      const clustered =
        remainingBubbles >= 2 && (firstCluster || Math.random() < 0.46);
      const memberCount = firstCluster
        ? Math.min(3, remainingBubbles)
        : clustered
          ? Math.min(remainingBubbles, Math.random() < 0.55 ? 2 : 3)
          : 1;
      const cluster = { members: [] };

      for (let memberIndex = 0; memberIndex < memberCount; memberIndex += 1) {
        const bubble = makeBubble(bubbles.length);
        bubbles.push(bubble);
        cluster.members.push(bubble);
      }

      bubbleClusters.push(cluster);
      remainingBubbles -= memberCount;
    }

    const resetBubbleCluster = (cluster, initial) => {
      const clustered = cluster.members.length > 1;
      const edgePadding = clustered ? 22 : 10;
      const anchorX = randomBetween(
        edgePadding,
        Math.max(edgePadding + 1, width - edgePadding),
      );
      const anchorY = initial
        ? randomBetween(64, Math.max(65, height - 18))
        : height + randomBetween(18, 76);
      const clusterSpeedFactor = randomBetween(0.94, 1.06);

      for (
        let memberIndex = 0;
        memberIndex < cluster.members.length;
        memberIndex += 1
      ) {
        const bubble = cluster.members[memberIndex];
        const diameter = randomBetween(6, 24);
        const horizontalOffset = clustered ? randomBetween(-13, 13) : 0;
        const verticalOffset = clustered ? randomBetween(-11, 11) : 0;

        bubble.diameter = diameter;
        bubble.radius = diameter * 0.5;
        bubble.x = clamp(
          anchorX + horizontalOffset,
          bubble.radius + 1,
          width - bubble.radius - 1,
        );
        bubble.y = anchorY + verticalOffset;
        bubble.speed =
          (82 - diameter * 2.15) * clusterSpeedFactor * motionScale;
        bubble.phase = randomBetween(0, TAU);
        bubble.wobbleRate = randomBetween(0.8, 1.8) * motionScale;
        bubble.wobbleAmount = randomBetween(0.8, 3.2);
        bubble.opacity = randomBetween(0.42, 0.86);
      }
    };

    for (
      let clusterIndex = 0;
      clusterIndex < bubbleClusters.length;
      clusterIndex += 1
    ) {
      resetBubbleCluster(bubbleClusters[clusterIndex], true);
    }

    const updateBubbles = (deltaTime) => {
      for (
        let clusterIndex = 0;
        clusterIndex < bubbleClusters.length;
        clusterIndex += 1
      ) {
        const cluster = bubbleClusters[clusterIndex];
        let hasVisibleMember = false;

        for (
          let memberIndex = 0;
          memberIndex < cluster.members.length;
          memberIndex += 1
        ) {
          const bubble = cluster.members[memberIndex];
          if (bubble.poolIndex >= activeBubbleCount) continue;

          bubble.y -= bubble.speed * deltaTime;
          bubble.phase += bubble.wobbleRate * deltaTime;
          if (bubble.y + bubble.radius > -20) hasVisibleMember = true;
        }

        const hasActiveMember =
          cluster.members[0]?.poolIndex < activeBubbleCount;
        if (hasActiveMember && !hasVisibleMember) {
          resetBubbleCluster(cluster, false);
        }
      }
    };

    const drawBubble = (bubble) => {
      const radius = bubble.radius;
      const drawX =
        bubble.x + Math.sin(bubble.phase) * bubble.wobbleAmount;

      ctx.save();
      ctx.translate(drawX, bubble.y);
      ctx.globalAlpha = bubble.opacity;

      // Gradients use the coordinate space from their creation time. Create
      // this after translate so the transparent interior follows the bubble.
      const interior = ctx.createRadialGradient(
        -radius * 0.28,
        -radius * 0.32,
        radius * 0.05,
        0,
        0,
        radius,
      );
      interior.addColorStop(0, "rgba(255, 255, 255, 0.28)");
      interior.addColorStop(0.34, "rgba(226, 248, 255, 0.08)");
      interior.addColorStop(0.72, "rgba(186, 230, 253, 0.06)");
      interior.addColorStop(1, "rgba(125, 211, 252, 0.3)");

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, TAU);
      ctx.fillStyle = interior;
      ctx.fill();
      ctx.lineWidth = clamp(radius * 0.1, 0.65, 1.15);
      ctx.strokeStyle = "rgba(222, 249, 255, 0.95)";
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(
        -radius * 0.33,
        -radius * 0.35,
        Math.max(0.7, radius * 0.2),
        Math.max(0.45, radius * 0.1),
        -Math.PI / 4,
        0,
        TAU,
      );
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(
        0,
        radius * 0.02,
        radius * 0.72,
        Math.PI * 0.18,
        Math.PI * 0.82,
      );
      ctx.lineWidth = clamp(radius * 0.09, 0.55, 1);
      ctx.strokeStyle = "rgba(170, 231, 250, 0.5)";
      ctx.stroke();

      ctx.restore();
    };

    const traceFishBody = (length, halfHeight) => {
      ctx.beginPath();
      ctx.moveTo(-length * 0.32, 0);
      ctx.bezierCurveTo(
        -length * 0.2,
        -halfHeight * 0.94,
        length * 0.28,
        -halfHeight * 1.06,
        length * 0.48,
        0,
      );
      ctx.bezierCurveTo(
        length * 0.28,
        halfHeight * 1.06,
        -length * 0.2,
        halfHeight * 0.94,
        -length * 0.32,
        0,
      );
      ctx.closePath();
    };

    const makeFish = (slot, depth) => ({
      slot,
      depth,
      cycle: 0,
      direction: 1,
      x: 0,
      y: 0,
      length: minFishLength,
      opacity: 0.6,
      speed: 20,
      time: randomBetween(0, TAU),
      bobRate: 1,
      bobAmount: 2,
      tailRate: 6,
      verticalSpeed: 0,
      driftPhase: randomBetween(0, TAU),
      driftRate: 1,
      entryDelay: 0,
      variant: FISH_VARIANTS[slot % FISH_VARIANTS.length],
      spotX: new Float32Array(6),
      spotY: new Float32Array(6),
      spotRadius: new Float32Array(6),
    });

    const fishes = [];
    for (let fishIndex = 0; fishIndex < fishPoolCount; fishIndex += 1) {
      fishes.push(makeFish(fishIndex, 0.5));
    }

    const updateFishDepths = () => {
      for (let fishIndex = 0; fishIndex < fishes.length; fishIndex += 1) {
        fishes[fishIndex].depth =
          activeFishCount === 1
            ? 0.62
            : 0.2 +
              (Math.min(fishIndex, activeFishCount - 1) /
                Math.max(1, activeFishCount - 1)) *
                0.75;
      }
    };

    const resetFish = (fish, initial) => {
      const depthStep =
        activeFishCount === 1
          ? 0.5
          : ((fish.slot + fish.cycle) % activeFishCount) /
            Math.max(1, activeFishCount - 1);
      fish.depth = clamp(
        (activeFishCount === 1 ? 0.62 : 0.2 + depthStep * 0.75) +
          randomBetween(-0.07, 0.07),
        0.18,
        0.96,
      );

      const depthLength =
        minFishLength + fish.depth * (maxFishLength - minFishLength);
      fish.direction = Math.random() < 0.5 ? -1 : 1;
      fish.length = clamp(
        depthLength * randomBetween(0.92, 1.07),
        minFishLength,
        maxFishLength,
      );
      fish.opacity = 0.4 + fish.depth * 0.55;
      fish.speed =
        (14 + fish.depth * 18 + randomBetween(-2, 3.5)) * motionScale;
      fish.bobRate = randomBetween(0.72, 1.18) * motionScale;
      fish.bobAmount = 1.4 + fish.depth * 2.8;
      fish.tailRate = randomBetween(5.6, 7.4) * motionScale;
      fish.time = randomBetween(0, TAU);
      fish.verticalSpeed = randomBetween(-4.8, 4.8) * motionScale;
      fish.driftPhase = randomBetween(0, TAU);
      fish.driftRate = randomBetween(0.42, 0.88) * motionScale;
      fish.entryDelay = initial ? 0 : randomBetween(0.12, 0.9);

      const laneCount = Math.max(1, activeFishCount);
      const randomLaneOffset = initial
        ? 0
        : Math.floor(randomBetween(1, laneCount + 1));
      const laneIndex =
        (fish.slot + fish.cycle * 2 + randomLaneOffset) % laneCount;
      const laneProgress =
        laneCount === 1 ? 0.5 : laneIndex / Math.max(1, laneCount - 1);
      const laneTop = compactMode ? 0.2 : 0.15;
      const laneBottom = compactMode ? 0.76 : 0.79;
      const laneY =
        height * (laneTop + (laneBottom - laneTop) * laneProgress);
      fish.y = clamp(
        laneY + randomBetween(-height * 0.06, height * 0.06),
        height * 0.12,
        height * 0.84,
      );

      const laneWidth = width / laneCount;
      const laneX = laneWidth * (laneIndex + 0.5);
      fish.x = initial
        ? clamp(
            laneX + randomBetween(-laneWidth * 0.34, laneWidth * 0.34),
            0,
            width,
          )
        : fish.direction > 0
          ? -fish.length
          : width + fish.length;

      fish.variant =
        FISH_VARIANTS[
          (fish.slot +
            fish.cycle +
            Math.floor(randomBetween(0, FISH_VARIANTS.length))) %
            FISH_VARIANTS.length
        ];
      fish.cycle += 1;

      for (let spotIndex = 0; spotIndex < fish.spotX.length; spotIndex += 1) {
        fish.spotX[spotIndex] = randomBetween(-0.18, 0.28);
        fish.spotY[spotIndex] = randomBetween(-0.1, 0.1);
        fish.spotRadius[spotIndex] = randomBetween(0.018, 0.032);
      }
    };

    updateFishDepths();
    for (let fishIndex = 0; fishIndex < fishes.length; fishIndex += 1) {
      resetFish(fishes[fishIndex], true);
    }

    const updateFish = (fish, deltaTime) => {
      if (fish.entryDelay > 0) {
        fish.entryDelay = Math.max(0, fish.entryDelay - deltaTime);
        return;
      }

      fish.time += deltaTime;
      fish.driftPhase += fish.driftRate * deltaTime;
      fish.x += fish.speed * fish.direction * deltaTime;
      fish.y +=
        (fish.verticalSpeed + Math.sin(fish.driftPhase) * 1.25) * deltaTime;

      const swimTop = height * 0.11;
      const swimBottom = height * 0.86;
      if (fish.y <= swimTop || fish.y >= swimBottom) {
        fish.y = clamp(fish.y, swimTop, swimBottom);
        fish.verticalSpeed *= -1;
      }

      if (
        (fish.direction > 0 && fish.x - fish.length * 0.52 > width) ||
        (fish.direction < 0 && fish.x + fish.length * 0.52 < 0)
      ) {
        resetFish(fish, false);
      }
    };

    const drawFish = (fish) => {
      if (fish.entryDelay > 0) return;

      const length = fish.length;
      const halfHeight = length * 0.18;
      const tailWave = Math.sin(fish.time * fish.tailRate) * length * 0.045;
      const finWave =
        Math.sin(fish.time * fish.tailRate + 1.2) * length * 0.012;
      const bob =
        Math.sin(fish.time * fish.bobRate + fish.slot) * fish.bobAmount;
      const variant = fish.variant;

      ctx.save();
      ctx.translate(fish.x, fish.y + bob);
      if (fish.direction < 0) ctx.scale(-1, 1);
      const swimTilt = clamp(
        fish.verticalSpeed / Math.max(1, fish.speed),
        -0.08,
        0.08,
      );
      ctx.rotate(
        Math.sin(fish.time * fish.bobRate * 0.7) * 0.018 +
          swimTilt * fish.direction,
      );
      ctx.globalAlpha = fish.opacity;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Build the body gradient inside the fish transform so direction flips
      // the whole fish, including its lighting.
      const bodyGradient = variant.diagonalGradient
        ? ctx.createLinearGradient(
            -length * 0.28,
            -length * 0.18,
            length * 0.42,
            length * 0.18,
          )
        : ctx.createLinearGradient(
            0,
            -length * 0.18,
            0,
            length * 0.18,
          );
      bodyGradient.addColorStop(0, variant.top);
      bodyGradient.addColorStop(0.48, variant.middle);
      bodyGradient.addColorStop(1, variant.bottom);

      ctx.beginPath();
      ctx.moveTo(-length * 0.31, -halfHeight * 0.2);
      ctx.bezierCurveTo(
        -length * 0.39,
        -halfHeight * 0.7 + tailWave,
        -length * 0.47,
        -halfHeight * 1.05 + tailWave,
        -length * 0.52,
        -halfHeight * 0.9 + tailWave,
      );
      ctx.bezierCurveTo(
        -length * 0.49,
        -halfHeight * 0.34 + tailWave * 0.65,
        -length * 0.44,
        -halfHeight * 0.08 + tailWave * 0.35,
        -length * 0.41,
        tailWave * 0.3,
      );
      ctx.bezierCurveTo(
        -length * 0.44,
        halfHeight * 0.08 + tailWave * 0.35,
        -length * 0.49,
        halfHeight * 0.34 + tailWave * 0.65,
        -length * 0.52,
        halfHeight * 0.9 + tailWave,
      );
      ctx.bezierCurveTo(
        -length * 0.47,
        halfHeight * 1.05 + tailWave,
        -length * 0.39,
        halfHeight * 0.7 + tailWave,
        -length * 0.31,
        halfHeight * 0.2,
      );
      ctx.closePath();
      ctx.fillStyle = variant.tail;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-length * 0.16, -halfHeight * 0.72);
      ctx.bezierCurveTo(
        -length * 0.08,
        -halfHeight * 1.45 + finWave,
        length * 0.07,
        -halfHeight * 1.35 + finWave,
        length * 0.13,
        -halfHeight * 0.72,
      );
      ctx.bezierCurveTo(
        length * 0.03,
        -halfHeight * 0.88,
        -length * 0.08,
        -halfHeight * 0.86,
        -length * 0.16,
        -halfHeight * 0.72,
      );
      ctx.fillStyle = variant.fin;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-length * 0.11, halfHeight * 0.72);
      ctx.bezierCurveTo(
        -length * 0.04,
        halfHeight * 1.3 - finWave,
        length * 0.08,
        halfHeight * 1.2 - finWave,
        length * 0.13,
        halfHeight * 0.68,
      );
      ctx.bezierCurveTo(
        length * 0.04,
        halfHeight * 0.82,
        -length * 0.04,
        halfHeight * 0.84,
        -length * 0.11,
        halfHeight * 0.72,
      );
      ctx.fillStyle = variant.fin;
      ctx.fill();

      traceFishBody(length, halfHeight);
      ctx.fillStyle = bodyGradient;
      ctx.fill();

      if (variant.pattern === "stripes") {
        ctx.save();
        traceFishBody(length, halfHeight);
        ctx.clip();
        ctx.lineWidth = Math.max(1, length * 0.045);
        ctx.strokeStyle = variant.patternColor;

        for (let stripeIndex = 0; stripeIndex < 3; stripeIndex += 1) {
          const stripeX = -length * 0.14 + stripeIndex * length * 0.14;
          ctx.beginPath();
          ctx.moveTo(stripeX - length * 0.035, -halfHeight * 1.05);
          ctx.bezierCurveTo(
            stripeX + length * 0.04,
            -halfHeight * 0.28,
            stripeX - length * 0.055,
            halfHeight * 0.35,
            stripeX + length * 0.02,
            halfHeight * 1.06,
          );
          ctx.stroke();
        }
        ctx.restore();
      } else if (variant.pattern === "dots") {
        ctx.save();
        traceFishBody(length, halfHeight);
        ctx.clip();
        ctx.fillStyle = variant.patternColor;

        for (let spotIndex = 0; spotIndex < fish.spotX.length; spotIndex += 1) {
          ctx.beginPath();
          ctx.arc(
            fish.spotX[spotIndex] * length,
            fish.spotY[spotIndex] * length,
            fish.spotRadius[spotIndex] * length,
            0,
            TAU,
          );
          ctx.fill();
        }
        ctx.restore();
      }

      ctx.beginPath();
      ctx.moveTo(-length * 0.2, -halfHeight * 0.66);
      ctx.bezierCurveTo(
        -length * 0.02,
        -halfHeight * 0.97,
        length * 0.3,
        -halfHeight * 0.82,
        length * 0.43,
        -halfHeight * 0.22,
      );
      ctx.lineWidth = Math.max(0.7, length * 0.022);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-length * 0.18, halfHeight * 0.6);
      ctx.bezierCurveTo(
        length * 0.02,
        halfHeight * 0.92,
        length * 0.29,
        halfHeight * 0.75,
        length * 0.42,
        halfHeight * 0.2,
      );
      ctx.strokeStyle = "rgba(3, 59, 92, 0.2)";
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(length * 0.04, halfHeight * 0.08);
      ctx.bezierCurveTo(
        -length * 0.02,
        halfHeight * 0.35 + finWave,
        length * 0.01,
        halfHeight * 0.7 + finWave,
        length * 0.15,
        halfHeight * 0.43,
      );
      ctx.bezierCurveTo(
        length * 0.11,
        halfHeight * 0.22,
        length * 0.08,
        halfHeight * 0.12,
        length * 0.04,
        halfHeight * 0.08,
      );
      ctx.fillStyle = variant.fin;
      ctx.globalAlpha = fish.opacity * 0.86;
      ctx.fill();
      ctx.globalAlpha = fish.opacity;

      ctx.beginPath();
      ctx.moveTo(length * 0.25, -halfHeight * 0.42);
      ctx.bezierCurveTo(
        length * 0.2,
        -halfHeight * 0.14,
        length * 0.2,
        halfHeight * 0.14,
        length * 0.25,
        halfHeight * 0.4,
      );
      ctx.lineWidth = Math.max(0.65, length * 0.018);
      ctx.strokeStyle = "rgba(3, 59, 92, 0.42)";
      ctx.stroke();

      const eyeX = length * 0.35;
      const eyeY = -halfHeight * 0.28;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, length * 0.046, 0, TAU);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(
        eyeX + length * 0.009,
        eyeY + length * 0.002,
        length * 0.023,
        0,
        TAU,
      );
      ctx.fillStyle = "#082f49";
      ctx.fill();

      ctx.beginPath();
      ctx.arc(
        eyeX + length * 0.016,
        eyeY - length * 0.012,
        Math.max(0.55, length * 0.009),
        0,
        TAU,
      );
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      ctx.restore();
    };

    const handleResize = () => {
      resizeCanvas();

      const nextCompactMode = deviceCompact || width <= 640;
      const nextBubbleCount = nextCompactMode
        ? reduceMotion
          ? 10
          : 20
        : bubblePoolCount;
      const nextFishCount = nextCompactMode
        ? reduceMotion
          ? 2
          : 3
        : reduceMotion
          ? 3
          : width >= 1100
            ? 7
            : 6;
      const nextMinFishLength = nextCompactMode ? 20 : 27;
      const nextMaxFishLength = nextCompactMode ? 38 : 52;
      const profileChanged =
        nextCompactMode !== compactMode ||
        nextBubbleCount !== activeBubbleCount ||
        nextFishCount !== activeFishCount;

      compactMode = nextCompactMode;
      activeBubbleCount = nextBubbleCount;
      activeFishCount = nextFishCount;
      minFishLength = nextMinFishLength;
      maxFishLength = nextMaxFishLength;

      if (profileChanged) {
        updateFishDepths();
        for (
          let clusterIndex = 0;
          clusterIndex < bubbleClusters.length;
          clusterIndex += 1
        ) {
          resetBubbleCluster(bubbleClusters[clusterIndex], true);
        }
        for (let fishIndex = 0; fishIndex < fishes.length; fishIndex += 1) {
          resetFish(fishes[fishIndex], true);
        }
        return;
      }

      for (let bubbleIndex = 0; bubbleIndex < bubbles.length; bubbleIndex += 1) {
        const bubble = bubbles[bubbleIndex];
        bubble.x = clamp(
          bubble.x,
          bubble.radius + 1,
          width - bubble.radius - 1,
        );
        bubble.y = Math.min(bubble.y, height + 76);
      }
      for (let fishIndex = 0; fishIndex < fishes.length; fishIndex += 1) {
        fishes[fishIndex].y = clamp(
          fishes[fishIndex].y,
          height * 0.11,
          height * 0.86,
        );
      }
    };

    const frame = (timestamp) => {
      rafId = 0;
      if (disposed || document.hidden) return;

      const elapsed = lastTimestamp
        ? (timestamp - lastTimestamp) / 1000
        : 0;
      const deltaTime = clamp(elapsed, 0, 0.05);
      lastTimestamp = timestamp;

      ctx.clearRect(0, 0, width, height);
      updateBubbles(deltaTime);
      for (
        let bubbleIndex = 0;
        bubbleIndex < activeBubbleCount;
        bubbleIndex += 1
      ) {
        drawBubble(bubbles[bubbleIndex]);
      }

      for (
        let fishIndex = 0;
        fishIndex < activeFishCount;
        fishIndex += 1
      ) {
        updateFish(fishes[fishIndex], deltaTime);
        drawFish(fishes[fishIndex]);
      }

      if (!disposed && !document.hidden) {
        rafId = window.requestAnimationFrame(frame);
      }
    };

    const start = () => {
      if (disposed || document.hidden || rafId) return;
      lastTimestamp = 0;
      rafId = window.requestAnimationFrame(frame);
    };

    const stop = () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      rafId = 0;
      lastTimestamp = 0;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) stop();
      else start();
    };

    window.addEventListener("resize", handleResize);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    start();

    return () => {
      disposed = true;
      stop();
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [reduceMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="ocean-effect-layer"
      aria-hidden="true"
      data-decorative-fx="true"
    />
  );
};

export default OceanEffect;
