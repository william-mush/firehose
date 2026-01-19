/**
 * Flow mode algorithms for word visualization.
 * Each mode controls how words move and appear on screen.
 */

export interface FlowWord {
  element: HTMLSpanElement;
  word: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  age: number;
  source?: string;
  // Custom properties for specific modes
  startY?: number;
  startX?: number;
  angle?: number;
  radius?: number;
  speed?: number;
  size?: number;
  wave?: number;
  column?: number;
}

export interface FlowMode {
  name: string;
  reset(): void;
  initializeWord(word: FlowWord, width: number, height: number): void;
  updateWord(word: FlowWord, deltaTime: number, speed: number, width: number, height: number): boolean;
}

// Wave Flow - Words move in sine wave patterns across full screen
export class WaveFlow implements FlowMode {
  name = "Wave";
  private waveOffset = 0;

  reset() {
    this.waveOffset = 0;
  }

  initializeWord(word: FlowWord, width: number, height: number) {
    word.x = -200;
    // Use full height with small margins for nav/controls
    word.startY = 60 + Math.random() * (height - 180);
    word.y = word.startY;
    word.vx = 1.5 + Math.random() * 2.5;
    word.vy = 0;
    word.opacity = 1;
    word.wave = Math.random() * Math.PI * 2;
    word.size = 0.8 + Math.random() * 0.6;
  }

  updateWord(word: FlowWord, deltaTime: number, speed: number, width: number, height: number): boolean {
    word.age += deltaTime;
    word.x += word.vx * speed * 0.5;

    // Larger wave amplitude for more vertical movement
    const wave = Math.sin((word.x * 0.008) + (word.wave || 0) + this.waveOffset) * 120;
    word.y = (word.startY || height / 2) + wave;

    // Keep words within bounds
    word.y = Math.max(50, Math.min(height - 120, word.y));

    this.waveOffset += 0.0001 * deltaTime;

    if (word.x > width + 100) {
      word.opacity -= 0.05;
    }

    return word.opacity > 0;
  }
}

// Matrix Flow - Words fall like Matrix rain across full width
export class MatrixFlow implements FlowMode {
  name = "Matrix";
  private columns: number[] = [];

  reset() {
    this.columns = [];
  }

  initializeWord(word: FlowWord, width: number, height: number) {
    // More columns, use full width
    const numColumns = Math.floor(width / 100);
    if (this.columns.length === 0 || this.columns.length !== numColumns) {
      this.columns = Array(numColumns).fill(-100);
    }

    const column = Math.floor(Math.random() * numColumns);
    word.column = column;
    word.x = column * 100 + 50;
    word.y = this.columns[column] || -80;
    word.vx = 0;
    word.vy = 2 + Math.random() * 3;
    word.opacity = 1;
    word.size = 0.7 + Math.random() * 0.5;

    this.columns[column] = word.y + 60;
    if (this.columns[column] > height * 0.3) {
      this.columns[column] = -80 - Math.random() * 200;
    }
  }

  updateWord(word: FlowWord, deltaTime: number, speed: number, width: number, height: number): boolean {
    word.age += deltaTime;
    word.y += word.vy * speed * 0.5;

    if (word.y > height - 100) {
      word.opacity -= 0.05;
    }

    return word.opacity > 0;
  }
}

// Waterfall Flow - Words cascade down like a waterfall across full width
export class WaterfallFlow implements FlowMode {
  name = "Waterfall";
  private currentX = 0;

  reset() {
    this.currentX = 0;
  }

  initializeWord(word: FlowWord, width: number, height: number) {
    // Use full width with minimal margins
    word.x = 50 + (this.currentX % (width - 100));
    word.y = -80;
    word.vx = (Math.random() - 0.5) * 3;
    word.vy = 2 + Math.random() * 3;
    word.opacity = 1;
    word.size = 0.8 + Math.random() * 0.5;

    this.currentX += 150;
  }

  updateWord(word: FlowWord, deltaTime: number, speed: number, width: number, height: number): boolean {
    word.age += deltaTime;
    word.x += word.vx * speed * 0.3;
    word.y += word.vy * speed * 0.5;

    // Add slight acceleration
    word.vy += 0.02 * speed;

    // Bounce off bottom with room for controls
    if (word.y > height - 150) {
      word.vy *= -0.3;
      if (Math.abs(word.vy) < 1) {
        word.opacity -= 0.02;
      }
    }

    // Keep within horizontal bounds
    if (word.x < 20) word.x = 20;
    if (word.x > width - 20) word.x = width - 20;

    return word.opacity > 0;
  }
}

// Spiral Flow - Words spiral outward from center using full screen
export class SpiralFlow implements FlowMode {
  name = "Spiral";
  private angleOffset = 0;

  reset() {
    this.angleOffset = 0;
  }

  initializeWord(word: FlowWord, width: number, height: number) {
    word.angle = this.angleOffset;
    word.radius = 30;
    // Center in the visible area (accounting for nav and controls)
    word.startX = width / 2;
    word.startY = (height - 60) / 2 + 30; // offset for nav
    word.x = word.startX;
    word.y = word.startY;
    word.vx = 0;
    word.vy = 0;
    word.opacity = 1;
    word.speed = 0.5 + Math.random() * 1;
    word.size = 0.7 + Math.random() * 0.6;

    this.angleOffset += 0.4;
  }

  updateWord(word: FlowWord, deltaTime: number, speed: number, width: number, height: number): boolean {
    word.age += deltaTime;
    word.angle = (word.angle || 0) + 0.02 * speed * (word.speed || 1);
    word.radius = (word.radius || 30) + 0.6 * speed;

    const centerX = word.startX || width / 2;
    const centerY = word.startY || height / 2;
    word.x = centerX + Math.cos(word.angle) * word.radius;
    word.y = centerY + Math.sin(word.angle) * word.radius;

    // Use larger radius to fill more of the screen
    const maxRadius = Math.min(width, height - 150) / 2;
    if (word.radius > maxRadius) {
      word.opacity -= 0.02;
    }

    return word.opacity > 0;
  }
}

// Typewriter Flow - Words appear like typing, clear and readable
export class TypewriterFlow implements FlowMode {
  name = "Typewriter";
  private currentX = 60;
  private currentY = 100;
  private lineHeight = 80;
  private wordCount = 0;

  reset() {
    this.currentX = 60;
    this.currentY = 100;
    this.wordCount = 0;
  }

  initializeWord(word: FlowWord, width: number, height: number) {
    // Get the actual word text length
    const textLength = word.word ? word.word.length : 5;

    // Calculate word width: font is ~34px (2.5rem * 0.85), avg char ~20px + generous spacing
    const charWidth = 24;
    const wordWidth = textLength * charWidth + 50;

    // Check if we need to wrap BEFORE placing the word
    if (this.currentX + wordWidth > width - 60) {
      this.currentX = 60;
      this.currentY += this.lineHeight;
    }

    // Wrap back to top when we run out of vertical space
    if (this.currentY > height - 200) {
      this.currentX = 60;
      this.currentY = 100;
    }

    // Place the word
    word.x = this.currentX;
    word.y = this.currentY;
    word.vx = 0;
    word.vy = 0;
    word.opacity = 0;
    word.size = 0.85;
    word.startX = this.currentX; // Store original position

    // Move cursor for next word
    this.currentX += wordWidth;
    this.wordCount++;
  }

  updateWord(word: FlowWord, deltaTime: number, speed: number, width: number, height: number): boolean {
    word.age += deltaTime;

    // Quick fade in
    if (word.age < 200) {
      word.opacity = Math.min(1, word.age / 200);
    } else {
      word.opacity = 1;
    }

    // Fade out after 4 seconds to keep text readable
    const visibleDuration = 4000 / speed;
    if (word.age > visibleDuration) {
      word.opacity = Math.max(0, 1 - (word.age - visibleDuration) / 800);
    }

    return word.opacity > 0;
  }
}

// Explosion Flow - Words explode from center using full screen
export class ExplosionFlow implements FlowMode {
  name = "Explosion";
  private burstIndex = 0;

  reset() {
    this.burstIndex = 0;
  }

  initializeWord(word: FlowWord, width: number, height: number) {
    const angle = (this.burstIndex / 20) * Math.PI * 2 + Math.random() * 0.5;
    const speed = 4 + Math.random() * 6;

    // Center in visible area
    word.x = width / 2;
    word.y = (height - 100) / 2 + 50;
    word.vx = Math.cos(angle) * speed;
    word.vy = Math.sin(angle) * speed;
    word.opacity = 1;
    word.size = 0.8 + Math.random() * 0.6;

    this.burstIndex++;
  }

  updateWord(word: FlowWord, deltaTime: number, speed: number, width: number, height: number): boolean {
    word.age += deltaTime;
    word.x += word.vx * speed;
    word.y += word.vy * speed;

    // Slow down
    word.vx *= 0.99;
    word.vy *= 0.99;

    // Keep within bounds (bounce softly)
    if (word.x < 20 || word.x > width - 20) word.vx *= -0.5;
    if (word.y < 50 || word.y > height - 150) word.vy *= -0.5;

    // Fade out
    if (word.age > 3000) {
      word.opacity -= 0.01;
    }

    return word.opacity > 0;
  }
}

// Gravity Flow - Words fall with gravity across full screen
export class GravityFlow implements FlowMode {
  name = "Gravity";
  private gravity = 0.15;

  reset() {}

  initializeWord(word: FlowWord, width: number, height: number) {
    // Use full width
    word.x = 30 + Math.random() * (width - 60);
    word.y = -80;
    word.vx = (Math.random() - 0.5) * 4;
    word.vy = Math.random() * 2;
    word.opacity = 1;
    word.size = 0.8 + Math.random() * 0.5;
  }

  updateWord(word: FlowWord, deltaTime: number, speed: number, width: number, height: number): boolean {
    word.age += deltaTime;
    word.vy += this.gravity * speed * 0.1;
    word.x += word.vx * speed * 0.5;
    word.y += word.vy * speed * 0.5;

    // Bounce off bottom (leaving room for controls)
    if (word.y > height - 150) {
      word.y = height - 150;
      word.vy *= -0.5;
      word.vx *= 0.8;

      if (Math.abs(word.vy) < 0.5) {
        word.opacity -= 0.02;
      }
    }

    // Bounce off walls
    if (word.x < 20) {
      word.x = 20;
      word.vx *= -0.8;
    }
    if (word.x > width - 20) {
      word.x = width - 20;
      word.vx *= -0.8;
    }

    return word.opacity > 0;
  }
}

// Floating Flow - Words float gently like bubbles across full screen
export class FloatingFlow implements FlowMode {
  name = "Floating";

  reset() {}

  initializeWord(word: FlowWord, width: number, height: number) {
    // Use full width
    word.x = 30 + Math.random() * (width - 60);
    word.y = height - 100;
    word.vx = (Math.random() - 0.5) * 0.8;
    word.vy = -(1.5 + Math.random() * 2);
    word.opacity = 0;
    word.wave = Math.random() * Math.PI * 2;
    word.size = 0.8 + Math.random() * 0.6;
  }

  updateWord(word: FlowWord, deltaTime: number, speed: number, width: number, height: number): boolean {
    word.age += deltaTime;

    // Gentle horizontal drift
    word.x += Math.sin(word.age * 0.001 + (word.wave || 0)) * 0.8;
    word.y += word.vy * speed * 0.3;

    // Keep within horizontal bounds
    if (word.x < 20) word.x = 20;
    if (word.x > width - 20) word.x = width - 20;

    // Fade in
    if (word.age < 1000) {
      word.opacity = Math.min(0.9, word.age / 1000);
    }

    // Fade out at top
    if (word.y < 70) {
      word.opacity -= 0.02;
    }

    return word.opacity > 0 && word.y > -50;
  }
}

// Redacted Flow - Words keep typing over themselves on horizontal lines
export class RedactedFlow implements FlowMode {
  name = "Redacted";
  private currentX = 50;
  private currentY = 80;
  private lineHeight = 50;
  private pass = 0;
  private linesOnScreen = 0;

  reset() {
    this.currentX = 50;
    this.currentY = 80;
    this.pass = 0;
    this.linesOnScreen = 0;
  }

  initializeWord(word: FlowWord, width: number, height: number) {
    const textLength = word.word ? word.word.length : 5;
    const charWidth = 20;
    const wordWidth = textLength * charWidth + 25;

    // Wrap to next line when hitting edge
    if (this.currentX + wordWidth > width - 50) {
      this.currentX = 50;
      this.currentY += this.lineHeight;
      this.linesOnScreen++;
    }

    // When we've filled the screen, start over from the top
    // This creates the overwriting effect
    if (this.currentY > height - 120) {
      this.pass++;
      this.currentX = 50;
      this.currentY = 80;
      this.linesOnScreen = 0;
    }

    // Place word on current horizontal line
    word.x = this.currentX;
    word.y = this.currentY;
    word.vx = 0;
    word.vy = 0;
    word.opacity = 0;
    word.size = 0.8;
    word.wave = this.pass; // Track which pass this word belongs to

    // Move cursor forward
    this.currentX += wordWidth;
  }

  updateWord(word: FlowWord, deltaTime: number, speed: number, width: number, height: number): boolean {
    word.age += deltaTime;

    // Quick fade in
    if (word.age < 200) {
      word.opacity = Math.min(1, word.age / 200);
    } else {
      word.opacity = 1;
    }

    // Words stay visible - they never fade out
    // Only remove after very long time for memory management
    return word.age < 120000; // Keep for 2 minutes
  }
}

// Firehose Flow - Words morph from normal → "trump you" → "fuck you"
export class FirehoseFlow implements FlowMode {
  name = "Firehose";
  private startTime = 0;
  private phase = 0; // 0 = normal, 1 = trump you, 2 = fuck you

  reset() {
    this.startTime = Date.now();
    this.phase = 0;
  }

  initializeWord(word: FlowWord, width: number, height: number) {
    // Calculate current phase based on elapsed time
    const elapsed = Date.now() - this.startTime;
    const phaseDuration = 15000; // 15 seconds per phase

    // Phase 0: 0-15s (normal words)
    // Phase 1: 15-30s (trump you)
    // Phase 2: 30s+ (fuck you)
    this.phase = Math.min(2, Math.floor(elapsed / phaseDuration));

    // Gradual transition - mix in new words as phase progresses
    const phaseProgress = (elapsed % phaseDuration) / phaseDuration;
    const shouldTransform = Math.random() < phaseProgress || elapsed > phaseDuration * (this.phase + 1) - 3000;

    // Transform the word based on phase
    if (this.phase >= 1 || (this.phase === 0 && shouldTransform && elapsed > 10000)) {
      // In trump you phase or transitioning to it
      if (this.phase >= 2 || (this.phase === 1 && shouldTransform && elapsed > 25000)) {
        // Fuck you phase
        word.word = Math.random() < 0.5 ? "FUCK" : "YOU";
        word.element.textContent = word.word;
      } else {
        // Trump you phase
        word.word = Math.random() < 0.5 ? "TRUMP" : "YOU";
        word.element.textContent = word.word;
      }
    }

    // Firehose spray pattern - words shoot out from left side
    word.x = -100;
    word.y = height * 0.3 + Math.random() * height * 0.4;
    word.startY = word.y;

    // High velocity spray
    const angle = (Math.random() - 0.5) * 0.8; // Spread angle
    const speed = 8 + Math.random() * 6;
    word.vx = Math.cos(angle) * speed;
    word.vy = Math.sin(angle) * speed * 2;

    word.opacity = 1;
    word.size = 0.9 + Math.random() * 0.5;
    word.angle = angle; // Store for rotation effect
  }

  updateWord(word: FlowWord, deltaTime: number, speed: number, width: number, height: number): boolean {
    word.age += deltaTime;

    // Move with velocity
    word.x += word.vx * speed * 0.8;
    word.y += word.vy * speed * 0.3;

    // Slow down over time
    word.vx *= 0.995;
    word.vy *= 0.99;

    // Add some gravity
    word.vy += 0.02 * speed;

    // Bounce off edges
    if (word.y < 60) {
      word.y = 60;
      word.vy *= -0.5;
    }
    if (word.y > height - 150) {
      word.y = height - 150;
      word.vy *= -0.5;
    }

    // Fade out when slowed or off screen
    if (word.x > width + 50 || word.age > 8000) {
      word.opacity -= 0.03;
    }

    return word.opacity > 0;
  }
}

export const flowModes: Record<string, FlowMode> = {
  wave: new WaveFlow(),
  matrix: new MatrixFlow(),
  waterfall: new WaterfallFlow(),
  spiral: new SpiralFlow(),
  typewriter: new TypewriterFlow(),
  explosion: new ExplosionFlow(),
  gravity: new GravityFlow(),
  floating: new FloatingFlow(),
  redacted: new RedactedFlow(),
  firehose: new FirehoseFlow(),
};
