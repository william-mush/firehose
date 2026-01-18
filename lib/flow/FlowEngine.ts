/**
 * FlowEngine - Core animation engine for word visualization
 * Manages the animation loop, word spawning, and DOM updates
 */

import { FlowWord, FlowMode, flowModes } from "./flowModes";

export interface FlowEngineConfig {
  container: HTMLElement;
  speed?: number;
  spawnRate?: number;
  maxWords?: number;
  mode?: string;
  onWordClick?: (word: FlowWord) => void;
}

export class FlowEngine {
  private container: HTMLElement;
  private words: FlowWord[] = [];
  private pendingText: string[] = [];
  private animationId: number | null = null;
  private lastTime: number = 0;
  private lastSpawnTime: number = 0;
  private isRunning: boolean = false;

  // Configuration
  private speed: number = 1;
  private spawnRate: number = 200; // ms between spawns
  private maxWords: number = 100;
  private currentMode: FlowMode;
  private onWordClick?: (word: FlowWord) => void;

  constructor(config: FlowEngineConfig) {
    this.container = config.container;
    this.speed = config.speed ?? 1;
    this.spawnRate = config.spawnRate ?? 200;
    this.maxWords = config.maxWords ?? 100;
    this.currentMode = flowModes[config.mode ?? "wave"];
    this.onWordClick = config.onWordClick;

    // Set container styles - don't override position if already fixed/absolute
    const currentPosition = getComputedStyle(this.container).position;
    if (currentPosition !== "fixed" && currentPosition !== "absolute") {
      this.container.style.position = "relative";
    }
    this.container.style.overflow = "hidden";
  }

  /**
   * Add text content to be displayed
   */
  addContent(text: string, source?: string) {
    const words = this.tokenize(text);
    words.forEach((word) => {
      if (source) {
        this.pendingText.push(`${word}|||${source}`);
      } else {
        this.pendingText.push(word);
      }
    });
  }

  /**
   * Tokenize text into displayable words
   */
  private tokenize(text: string): string[] {
    return text
      .split(/\s+/)
      .filter((w) => w.length > 0)
      .map((w) => w.trim());
  }

  /**
   * Spawn a new word into the visualization
   */
  private spawnWord(): void {
    if (this.words.length >= this.maxWords || this.pendingText.length === 0) {
      return;
    }

    const textWithSource = this.pendingText.shift()!;
    const [text, source] = textWithSource.includes("|||")
      ? textWithSource.split("|||")
      : [textWithSource, undefined];

    const element = document.createElement("span");
    element.textContent = text;
    element.className = "flow-word";
    element.style.cssText = `
      position: absolute;
      white-space: nowrap;
      pointer-events: auto;
      cursor: pointer;
      transition: color 0.2s, transform 0.1s;
      font-family: 'Georgia', serif;
      font-size: 2.5rem;
      font-weight: 600;
      text-shadow: 0 3px 6px rgba(0,0,0,0.5);
    `;

    if (this.onWordClick) {
      element.addEventListener("click", () => {
        const word = this.words.find((w) => w.element === element);
        if (word) this.onWordClick!(word);
      });
    }

    element.addEventListener("mouseenter", () => {
      element.style.transform = "scale(1.2)";
      element.style.zIndex = "1000";
    });

    element.addEventListener("mouseleave", () => {
      element.style.transform = "scale(1)";
      element.style.zIndex = "";
    });

    this.container.appendChild(element);

    const word: FlowWord = {
      element,
      word: text,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      opacity: 1,
      age: 0,
      source,
    };

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.currentMode.initializeWord(word, width, height);
    this.updateWordElement(word);
    this.words.push(word);
  }

  /**
   * Update a word's DOM element based on its state
   */
  private updateWordElement(word: FlowWord): void {
    const el = word.element;
    el.style.left = `${word.x}px`;
    el.style.top = `${word.y}px`;
    el.style.opacity = String(Math.max(0, Math.min(1, word.opacity)));

    // Size varies based on word.size (default 1.0), base size is 2.5rem
    const baseSize = 2.5;
    const sizeMultiplier = word.size ?? 1;
    el.style.fontSize = `${baseSize * sizeMultiplier}rem`;

    // Color based on source
    const sourceColors: Record<string, string> = {
      truth_social: "#ff6b6b",
      presidency_project: "#4ecdc4",
      rev_transcript: "#ffe66d",
      default: "#ffffff",
    };
    el.style.color = sourceColors[word.source || "default"] || sourceColors.default;
  }

  /**
   * Remove a word from the visualization
   */
  private removeWord(word: FlowWord): void {
    word.element.remove();
    const index = this.words.indexOf(word);
    if (index > -1) {
      this.words.splice(index, 1);
    }
  }

  /**
   * Main animation loop
   */
  private animate = (timestamp: number): void => {
    if (!this.isRunning) return;

    const deltaTime = this.lastTime ? timestamp - this.lastTime : 16;
    this.lastTime = timestamp;

    // Spawn new words
    if (timestamp - this.lastSpawnTime > this.spawnRate) {
      this.spawnWord();
      this.lastSpawnTime = timestamp;
    }

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    // Update all words
    const wordsToRemove: FlowWord[] = [];

    for (const word of this.words) {
      const alive = this.currentMode.updateWord(word, deltaTime, this.speed, width, height);
      if (alive) {
        this.updateWordElement(word);
      } else {
        wordsToRemove.push(word);
      }
    }

    // Remove dead words
    wordsToRemove.forEach((word) => this.removeWord(word));

    this.animationId = requestAnimationFrame(this.animate);
  };

  /**
   * Start the animation
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = 0;
    this.lastSpawnTime = 0;
    this.animationId = requestAnimationFrame(this.animate);
  }

  /**
   * Stop the animation
   */
  stop(): void {
    this.isRunning = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Clear all words
   */
  clear(): void {
    this.words.forEach((word) => word.element.remove());
    this.words = [];
    this.pendingText = [];
    this.currentMode.reset();
  }

  /**
   * Change the flow mode
   */
  setMode(modeName: string): void {
    if (flowModes[modeName]) {
      this.currentMode = flowModes[modeName];
      this.currentMode.reset();
      this.clear();
    }
  }

  /**
   * Set animation speed
   */
  setSpeed(speed: number): void {
    this.speed = Math.max(0.1, Math.min(5, speed));
  }

  /**
   * Set spawn rate
   */
  setSpawnRate(rate: number): void {
    this.spawnRate = Math.max(50, Math.min(2000, rate));
  }

  /**
   * Get current stats
   */
  getStats(): { activeWords: number; pendingWords: number; mode: string } {
    return {
      activeWords: this.words.length,
      pendingWords: this.pendingText.length,
      mode: this.currentMode.name,
    };
  }

  /**
   * Destroy the engine and clean up
   */
  destroy(): void {
    this.stop();
    this.clear();
  }
}
