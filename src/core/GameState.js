/**
 * GameState class manages the simulation state and timing
 */
export class GameState {
  constructor() {
    this.lastUpdateTime = performance.now();
    this.deltaTime = 0;
    this.isPaused = false;
    this.simulationSpeed = 1.0; // Allows for slow-mo or speed-up effects
  }
  
  /**
   * Updates game state and returns delta time in seconds
   * @returns {number} Delta time in seconds
   */
  update() {
    const currentTime = performance.now();
    // Calculate delta time in seconds
    this.deltaTime = (currentTime - this.lastUpdateTime) / 1000; 
    this.lastUpdateTime = currentTime;
    
    // Apply simulation speed and ensure reasonable limits
    const adjustedDelta = this.isPaused ? 0 : this.deltaTime * this.simulationSpeed;
    
    // Clamp delta time to avoid physics issues on slow frames
    return Math.min(adjustedDelta, 0.1);
  }
  
  /**
   * Toggle pause state
   */
  togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }
  
  /**
   * Set simulation speed
   * @param {number} speed - Simulation speed factor
   */
  setSimulationSpeed(speed) {
    this.simulationSpeed = Math.max(0.1, Math.min(speed, 2.0));
    return this.simulationSpeed;
  }
} 