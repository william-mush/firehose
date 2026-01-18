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
  private currentY = 80;
  private lineHeight = 70; // Increased for better spacing
  private lineStartTime: number[] = []; // Track when each line started
  private currentLine = 0;

  reset() {
    this.currentX = 60;
    this.currentY = 80;
    this.lineStartTime = [];
    this.currentLine = 0;
  }

  initializeWord(word: FlowWord, width: number, height: number) {
    word.x = this.currentX;
    word.y = this.currentY;
    word.vx = 0;
    word.vy = 0;
    word.opacity = 0;
    word.size = 0.9; // Slightly smaller for readability
    word.wave = this.currentLine; // Store which line this word is on

    // Calculate word width based on character count
    const wordWidth = (word.word?.length || 1) * 14 + 20;
    this.currentX += wordWidth;

    // Wrap to next line
    if (this.currentX > width - 100) {
      this.currentX = 60;
      this.currentY += this.lineHeight;
      this.currentLine++;
      this.lineStartTime[this.currentLine] = Date.now();
    }

    // Calculate max lines that fit on screen
    const maxLines = Math.floor((height - 200) / this.lineHeight);

    // Wrap back to top when we run out of space
    if (this.currentY > height - 180) {
      this.currentX = 60;
      this.currentY = 80;
      this.currentLine = 0;
      this.lineStartTime = [];
      this.lineStartTime[0] = Date.now();
    }

    // Record line start time
    if (!this.lineStartTime[this.currentLine]) {
      this.lineStartTime[this.currentLine] = Date.now();
    }
  }

  updateWord(word: FlowWord, deltaTime: number, speed: number, width: number, height: number): boolean {
    word.age += deltaTime;

    const maxLines = Math.floor((height - 200) / this.lineHeight);
    const wordLine = word.wave || 0;

    // Quick fade in
    if (word.age < 300) {
      word.opacity = Math.min(1, word.age / 300);
    } else {
      word.opacity = 1;
    }

    // Fade out after a shorter time to prevent overlap (3 seconds visible)
    const visibleDuration = 3000 / speed;
    if (word.age > visibleDuration) {
      word.opacity = Math.max(0, 1 - (word.age - visibleDuration) / 1000);
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

export const flowModes: Record<string, FlowMode> = {
  wave: new WaveFlow(),
  matrix: new MatrixFlow(),
  waterfall: new WaterfallFlow(),
  spiral: new SpiralFlow(),
  typewriter: new TypewriterFlow(),
  explosion: new ExplosionFlow(),
  gravity: new GravityFlow(),
  floating: new FloatingFlow(),
};
