import * as THREE from 'three';

/**
 * SnowEffect creates a realistic snowfall particle system
 */
export class SnowEffect {
  constructor(scene) {
    this.scene = scene;
    
    // Snowfall properties
    this.particleCount = 12000;  // Even more particles
    this.particleSize = 0.12;    // Larger size of snowflakes for better visibility
    this.spawnWidth = 50;        // Wider spawn area
    this.spawnHeight = 30;       // Higher spawn area
    this.spawnDepth = 50;        // Deeper spawn area
    
    // Particle system
    this.particles = null;
    this.particleSystem = null;
    
    // Current snow intensity (0-1)
    this.intensity = 0.5;
    
    // Velocity properties
    this.baseVelocityScale = 0.5;  // Faster movement
    this.fallSpeed = 0.8;         // Base falling speed
    
    // Camera reference (will be set in init)
    this.camera = null;
    
    // Vehicle speed tracking for dynamic spawn adjustments
    this.vehicleSpeed = 0;
    this.maxSpeedEffect = 70;    // Speed at which the max effect occurs (km/h)
    this.speedDistanceFactor = 2.0; // How much to extend spawn distance by at max speed
    
    // Debug flag
    this.debugMode = true;
  }
  
  /**
   * Initialize the snow effect
   * @param {THREE.Camera} camera - The main camera reference
   */
  init(camera) {
    console.log("Initializing snow effect...");
    
    // Store camera reference
    this.camera = camera;
    
    // Create snow particles
    this.createParticles();
    
    // Add particles to scene (not to camera)
    this.scene.add(this.particleSystem);
    
    // Set initial intensity high to make it obvious
    this.setIntensity(0.8);
    
    // Log to debug
    if (this.debugMode) {
      console.log("Snow effect initialized - particle count:", this.particleCount);
      console.log("Camera position:", this.camera.position);
    }
  }
  
  /**
   * Update the current vehicle speed for dynamic spawn adjustment
   * @param {number} speed - Vehicle speed in km/h
   */
  updateVehicleSpeed(speed) {
    this.vehicleSpeed = speed;
    if (this.debugMode && Math.random() < 0.01) {
      console.log("Vehicle speed updated:", speed, "km/h");
    }
  }
  
  /**
   * Calculate spawn distance multiplier based on current speed
   * @returns {number} The spawn distance multiplier
   */
  getSpeedBasedDistanceMultiplier() {
    // Normalize speed between 0 and 1 based on maxSpeedEffect
    const normalizedSpeed = Math.min(1.0, Math.max(0, this.vehicleSpeed / this.maxSpeedEffect));
    
    // Calculate multiplier: ranges from 1.0 at 0 speed to speedDistanceFactor at max speed
    return 1.0 + (normalizedSpeed * (this.speedDistanceFactor - 1.0));
  }
  
  /**
   * Create snow particle system
   */
  createParticles() {
    // Create particle geometry
    const positions = new Float32Array(this.particleCount * 3);
    const velocities = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);
    
    // Initialize positions around the camera
    this.initializeParticlesAroundCamera(positions, velocities, sizes);
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // Store velocities
    this.velocities = velocities;
    
    // Create snowflake material
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: this.particleSize,
      transparent: true,
      opacity: 0.9,             // Higher opacity
      map: this.createSnowflakeTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      vertexColors: false
    });
    
    // Create particle system
    this.particleSystem = new THREE.Points(geometry, material);
    this.particles = geometry;
    
    // Make sure particles are always visible regardless of fog
    this.particleSystem.frustumCulled = false;
    
    // Debug logging
    if (this.debugMode) {
      console.log("Particle system created, material:", material);
      console.log("First 5 positions:");
      for (let i = 0; i < 5; i++) {
        console.log(`Particle ${i}: (${positions[i*3]}, ${positions[i*3+1]}, ${positions[i*3+2]})`);
      }
    }
  }
  
  /**
   * Initialize particles around the camera
   * @param {Float32Array} positions - Array to store particle positions
   * @param {Float32Array} velocities - Array to store particle velocities
   * @param {Float32Array} sizes - Array to store particle sizes
   */
  initializeParticlesAroundCamera(positions, velocities, sizes) {
    // Get camera position as the reference point
    const camPos = this.camera ? this.camera.position.clone() : new THREE.Vector3(0, 5, 0);
    
    // Get spawn distance multiplier based on speed
    const distanceMultiplier = this.getSpeedBasedDistanceMultiplier();
    
    // Apply multiplier to spawn dimensions
    const adjustedSpawnDepth = this.spawnDepth * distanceMultiplier;
    const adjustedSpawnWidth = this.spawnWidth * (1.0 + (distanceMultiplier - 1.0) * 0.5);
    
    for (let i = 0; i < this.particleCount; i++) {
      const i3 = i * 3;
      
      // Determine distribution based on speed - at higher speeds, more particles spawn ahead
      const inFrontBias = 0.7 + (0.25 * (distanceMultiplier - 1.0)); // 70-95% in front based on speed
      const inFront = Math.random() < inFrontBias;
      
      // Random position in a box around camera with bias towards front
      positions[i3] = camPos.x + (Math.random() - 0.5) * adjustedSpawnWidth;
      positions[i3 + 1] = camPos.y + Math.random() * this.spawnHeight;
      
      if (inFront) {
        // Position in front of camera (negative Z is forward in world space)
        // At higher speeds, distribute particles farther ahead
        const depthBias = Math.random();
        const speedInfluence = Math.max(0, (distanceMultiplier - 1.0) / 2.0);
        const finalDepthBias = depthBias + (speedInfluence * depthBias); // Bias towards front at higher speeds
        positions[i3 + 2] = camPos.z - finalDepthBias * adjustedSpawnDepth;
      } else {
        // Position all around camera
        positions[i3 + 2] = camPos.z + (Math.random() - 0.5) * this.spawnDepth;
      }
      
      // Random velocities with downward bias
      velocities[i3] = (Math.random() - 0.5) * 0.3;         // X drift
      velocities[i3 + 1] = -this.fallSpeed - Math.random() * 0.7;  // Y downward fall - faster
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.3;     // Z drift
      
      // Random sizes for more varied appearance
      sizes[i] = this.particleSize * (0.5 + Math.random() * 1.0);
    }
  }
  
  /**
   * Create a texture for the snowflakes
   * @returns {THREE.Texture} Snowflake texture
   */
  createSnowflakeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;  // Larger texture
    canvas.height = 64;
    
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      0,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width / 2
    );
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)'); // More solid core
    gradient.addColorStop(0.6, 'rgba(240, 240, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(230, 230, 255, 0)');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    
    return texture;
  }
  
  /**
   * Update snow animation
   * @param {number} deltaTime - Time since last update
   */
  update(deltaTime) {
    if (!this.particleSystem || !this.camera) {
      if (this.debugMode) console.log("Missing particle system or camera");
      return;
    }
    
    // Skip update if intensity is zero
    if (this.intensity <= 0.01) {
      this.particleSystem.visible = false;
      if (this.debugMode && Math.random() < 0.01) console.log("Snow effect disabled (intensity too low)");
      return;
    } else {
      this.particleSystem.visible = true;
    }
    
    // Get particle positions
    const positions = this.particles.attributes.position.array;
    
    // Calculate number of active particles based on intensity - use exponential scaling
    const intensityFactor = Math.pow(this.intensity, 0.8); // Less aggressive curve
    const updateCount = Math.floor(this.particleCount * intensityFactor);
    
    // Camera's current position
    const camPos = this.camera.position;
    
    // Velocity scale based on intensity
    const velocityScale = this.baseVelocityScale + (this.intensity * 0.5);
    
    // Distance multiplier based on speed
    const distanceMultiplier = this.getSpeedBasedDistanceMultiplier();
    const maxParticleDistance = 60 * distanceMultiplier;
    
    // Update particle positions
    for (let i = 0; i < updateCount; i++) {
      const i3 = i * 3;
      
      // Apply velocity and gravity
      positions[i3] += this.velocities[i3] * deltaTime * 10 * velocityScale;
      positions[i3 + 1] += this.velocities[i3 + 1] * deltaTime * 10 * velocityScale;
      positions[i3 + 2] += this.velocities[i3 + 2] * deltaTime * 10 * velocityScale;
      
      // Reset particle if it goes too far from camera or below ground
      if (positions[i3 + 1] < 0 || 
          this.distanceToCamera(positions[i3], positions[i3+1], positions[i3+2]) > maxParticleDistance) {
        
        // Respawn particle around camera
        this.respawnParticle(positions, i3, camPos);
      }
    }
    
    // Mark positions for update
    this.particles.attributes.position.needsUpdate = true;
    
    // Debug
    if (this.debugMode && Math.random() < 0.002) {
      console.log("Active snow particles:", updateCount, "of", this.particleCount);
      console.log("Camera position:", camPos);
      console.log("Vehicle speed:", this.vehicleSpeed, "km/h");
      console.log("Distance multiplier:", distanceMultiplier.toFixed(2));
    }
  }
  
  /**
   * Calculate distance from a particle to camera
   */
  distanceToCamera(x, y, z) {
    const camPos = this.camera.position;
    const dx = x - camPos.x;
    const dy = y - camPos.y;
    const dz = z - camPos.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  }
  
  /**
   * Respawn a particle relative to current camera position
   * @param {Float32Array} positions - Position array
   * @param {number} index - Index in the position array
   * @param {THREE.Vector3} camPos - Current camera position
   */
  respawnParticle(positions, index, camPos) {
    // Get distance multiplier based on speed
    const distanceMultiplier = this.getSpeedBasedDistanceMultiplier();
    
    // Adjust spawn areas based on speed
    const adjustedSpawnDepth = this.spawnDepth * distanceMultiplier;
    const adjustedSpawnWidth = this.spawnWidth * (1.0 + (distanceMultiplier - 1.0) * 0.5);
    
    // Increase forward bias based on speed - at higher speeds, more particles spawn ahead
    const inFrontBias = 0.7 + (0.25 * (distanceMultiplier - 1.0)); // 70-95% in front based on speed
    const inFront = Math.random() < inFrontBias;
    
    // Spawn above and around the camera
    positions[index] = camPos.x + (Math.random() - 0.5) * adjustedSpawnWidth;
    positions[index + 1] = camPos.y + this.spawnHeight * 0.3 + Math.random() * this.spawnHeight * 0.7;
    
    if (inFront) {
      // Position in front of camera (negative Z is forward in world space)
      // At higher speeds, distribute particles farther ahead
      const depthBias = Math.random();
      const speedInfluence = Math.max(0, (distanceMultiplier - 1.0) / 2.0);
      const finalDepthBias = depthBias + (speedInfluence * depthBias); // Bias towards front at higher speeds
      positions[index + 2] = camPos.z - finalDepthBias * adjustedSpawnDepth;
    } else {
      // Position all around camera
      positions[index + 2] = camPos.z + (Math.random() - 0.5) * this.spawnDepth;
    }
    
    // At higher speeds, increase lateral drift slightly
    const lateralDriftFactor = 1.0 + Math.max(0, (distanceMultiplier - 1.0) * 0.3);
    
    // Randomize velocity slightly
    this.velocities[index] = (Math.random() - 0.5) * 0.3 * lateralDriftFactor;
    this.velocities[index + 1] = -this.fallSpeed - Math.random() * 0.7;
    this.velocities[index + 2] = (Math.random() - 0.5) * 0.3 * lateralDriftFactor;
  }
  
  /**
   * Set snow intensity
   * @param {number} intensity - Snow intensity (0-1)
   */
  setIntensity(intensity) {
    this.intensity = Math.max(0, Math.min(1, intensity));
    
    // Debug logging
    if (this.debugMode) {
      console.log("Snow intensity set to:", this.intensity);
    }
    
    // Update particle size and opacity based on intensity
    if (this.particleSystem) {
      // Scale opacity with intensity
      this.particleSystem.material.opacity = 0.4 + (0.6 * this.intensity);
      
      // Scale particle size with intensity
      this.particleSystem.material.size = this.particleSize * (0.7 + (this.intensity * 0.6));
    }
    
    return this.intensity;
  }
} 