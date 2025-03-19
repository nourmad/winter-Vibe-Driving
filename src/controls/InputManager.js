/**
 * InputManager handles user input for driving controls
 */
export class InputManager {
  constructor() {
    // Input state
    this.keys = {};
    this.mousePosition = { x: 0, y: 0 };
    this.steeringWheel = 0; // -1 to 1, represents steering angle
    this.throttle = 0;      // 0 to 1
    this.brake = 0;         // 0 to 1
    
    // Configuration
    this.steeringSpeed = 2.0;  // How quickly steering responds to input
    this.steeringReturn = 1.0; // How quickly steering returns to center
    this.steeringSensitivity = 1.0;
    
    // Initialize event listeners
    this.initKeyboard();
    this.initMouse();
  }
  
  /**
   * Initialize keyboard controls
   */
  initKeyboard() {
    // Set up key listeners
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      // Log key presses for debugging
      console.log('Key pressed:', e.key.toLowerCase());
    });
    
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
    
    // Initialize common keys to prevent undefined checks
    this.keys['w'] = false;
    this.keys['a'] = false;
    this.keys['s'] = false;
    this.keys['d'] = false;
    this.keys['arrowup'] = false;
    this.keys['arrowdown'] = false;
    this.keys['arrowleft'] = false;
    this.keys['arrowright'] = false;
    this.keys['shift'] = false;
    this.keys[' '] = false;
  }
  
  /**
   * Initialize mouse controls
   */
  initMouse() {
    // Track mouse movement for steering
    window.addEventListener('mousemove', (e) => {
      this.mousePosition.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mousePosition.y = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }
  
  /**
   * Updates input values based on current key/mouse state
   * @param {number} deltaTime - Time since last update
   */
  update(deltaTime) {
    // Clamp deltaTime to avoid huge jumps
    deltaTime = Math.min(deltaTime, 0.1);
    
    // Handle steering based on keys
    let targetSteering = 0;
    
    if (this.keys['a'] || this.keys['arrowleft']) {
      targetSteering = -1;
    } else if (this.keys['d'] || this.keys['arrowright']) {
      targetSteering = 1;
    } else {
      // Alternative: use mouse position for steering
      targetSteering = this.mousePosition.x * this.steeringSensitivity;
      
      // Clamp steering value
      targetSteering = Math.max(-1, Math.min(1, targetSteering));
    }
    
    // Smooth steering transitions
    if (targetSteering !== this.steeringWheel) {
      if (targetSteering > this.steeringWheel) {
        this.steeringWheel = Math.min(targetSteering, this.steeringWheel + this.steeringSpeed * deltaTime);
      } else {
        this.steeringWheel = Math.max(targetSteering, this.steeringWheel - this.steeringSpeed * deltaTime);
      }
    } else if (targetSteering === 0 && this.steeringWheel !== 0) {
      // Return to center when no input
      if (Math.abs(this.steeringWheel) < 0.1) {
        this.steeringWheel = 0;
      } else if (this.steeringWheel > 0) {
        this.steeringWheel -= this.steeringReturn * deltaTime;
      } else {
        this.steeringWheel += this.steeringReturn * deltaTime;
      }
    }
    
    // Handle throttle
    if (this.keys['w'] || this.keys['arrowup']) {
      this.throttle = Math.min(1, this.throttle + 2 * deltaTime);
    } else {
      this.throttle = Math.max(0, this.throttle - 3 * deltaTime);
    }
    
    // Handle brake
    if (this.keys['s'] || this.keys['arrowdown']) {
      this.brake = Math.min(1, this.brake + 3 * deltaTime);
    } else {
      this.brake = Math.max(0, this.brake - 5 * deltaTime);
    }
  }
  
  /**
   * Returns current input values
   * @returns {Object} Current input state
   */
  getInputs() {
    return {
      steering: this.steeringWheel,
      throttle: this.throttle,
      brake: this.brake,
      handbrake: Boolean(this.keys[' ']),  // Spacebar for handbrake
      reverse: this.brake > 0.9,           // Full brake to engage reverse
      boost: Boolean(this.keys['shift'])   // Shift for boost
    };
  }
} 