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
    this.drifting = false;  // Track if car is drifting
    this.driftIntensity = 0; // 0 to 1, controls drift intensity
    this.spinFactor = 0;     // 0 to 1, controls spin intensity for donuts
    
    // Configuration
    this.steeringSpeed = 2.0;  // How quickly steering responds to input
    this.steeringReturn = 1.0; // How quickly steering returns to center
    this.steeringSensitivity = 1.0;
    this.driftSteerMultiplier = 2.5; // Increased steering sensitivity during drift
    this.maxDriftIntensity = 1.0;    // Maximum drift intensity
    this.driftBuildupRate = 2.0;     // How quickly drift builds up
    this.driftDecayRate = 1.5;       // How quickly drift decays when not drifting
    this.maxSpinFactor = 3.0;        // Maximum spin intensity for donuts
    this.spinBuildupRate = 1.5;      // How quickly spin builds during drift
    this.spinDecayRate = 2.0;        // How quickly spin decays when not drifting
    
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
    
    // Check if drifting (spacebar)
    this.drifting = Boolean(this.keys[' ']);
    
    // Handle drift intensity
    if (this.drifting) {
      // Build up drift intensity while spacebar is held
      this.driftIntensity = Math.min(
        this.maxDriftIntensity, 
        this.driftIntensity + this.driftBuildupRate * deltaTime
      );
      
      // Build up spin factor for donuts when drifting and throttle applied
      if (this.keys['w'] || this.keys['arrowup']) {
        this.spinFactor = Math.min(
          this.maxSpinFactor,
          this.spinFactor + this.spinBuildupRate * deltaTime
        );
      }
    } else {
      // Decay drift intensity when spacebar is released
      this.driftIntensity = Math.max(
        0, 
        this.driftIntensity - this.driftDecayRate * deltaTime
      );
      
      // Decay spin factor when not drifting
      this.spinFactor = Math.max(
        0,
        this.spinFactor - this.spinDecayRate * deltaTime
      );
    }
    
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
    
    // Apply drift steering multiplier when drifting
    if (this.drifting && this.driftIntensity > 0.2) {
      // Apply basic drift multiplier
      targetSteering *= this.driftSteerMultiplier;
      
      // For donuts: if throttle is applied while drifting, add continuous spin in the steering direction
      if ((this.keys['w'] || this.keys['arrowup']) && this.spinFactor > 0.5) {
        // If no steering input during drift + throttle, create automatic spin
        if (Math.abs(targetSteering) < 0.3) {
          // Auto-spin based on last non-zero steering direction or default to right
          const spinDirection = this.steeringWheel !== 0 ? 
            Math.sign(this.steeringWheel) : 1;
          
          // Add continuous spin force in that direction
          targetSteering = spinDirection * this.spinFactor;
        } else {
          // Enhance existing steering direction for controlled spins
          targetSteering = Math.sign(targetSteering) * this.spinFactor;
        }
      }
      
      // Allow extreme oversteering during spin (beyond normal -1 to 1 range)
      targetSteering = Math.max(-3.0, Math.min(3.0, targetSteering));
    }
    
    // Smooth steering transitions
    if (targetSteering !== this.steeringWheel) {
      // Faster steering response during drift
      const currentSteeringSpeed = this.drifting ? 
        this.steeringSpeed * (1 + this.driftIntensity) : 
        this.steeringSpeed;
        
      if (targetSteering > this.steeringWheel) {
        this.steeringWheel = Math.min(targetSteering, this.steeringWheel + currentSteeringSpeed * deltaTime);
      } else {
        this.steeringWheel = Math.max(targetSteering, this.steeringWheel - currentSteeringSpeed * deltaTime);
      }
    } else if (targetSteering === 0 && this.steeringWheel !== 0 && !this.drifting) {
      // Return to center when no input (but not during drift)
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
      drifting: this.drifting,             // Drifting state
      driftIntensity: this.driftIntensity, // Current drift intensity
      spinFactor: this.spinFactor,         // Spin intensity for donuts
      reverse: this.brake > 0.9,           // Full brake to engage reverse
      boost: Boolean(this.keys['shift'])   // Shift for boost
    };
  }
} 