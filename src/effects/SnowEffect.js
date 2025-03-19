import * as THREE from 'three';

/**
 * SnowEffect creates a realistic snowfall particle system
 */
export class SnowEffect {
  constructor(scene) {
    this.scene = scene;
    
    // Snowfall properties
    this.particleCount = 3000;  // Reduced for performance
    this.particleSize = 0.05;   // Size of snowflakes
    this.area = 100;            // Area over which snow falls
    this.height = 30;           // Height at which snow spawns
    
    // Particle system
    this.particles = null;
    this.particleSystem = null;
    
    // Current snow intensity (0-1)
    this.intensity = 0.5;
  }
  
  /**
   * Initialize the snow effect
   */
  init() {
    console.log("Initializing snow effect...");
    
    // Create snow particles
    this.createParticles();
    
    // Add to scene
    this.scene.add(this.particleSystem);
    
    console.log("Snow effect initialized");
  }
  
  /**
   * Create snow particle system
   */
  createParticles() {
    // Create particle geometry
    const positions = new Float32Array(this.particleCount * 3);
    const velocities = new Float32Array(this.particleCount * 3);
    
    for (let i = 0; i < this.particleCount; i++) {
      // Random positions within area
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * this.area;
      positions[i3 + 1] = Math.random() * this.height;
      positions[i3 + 2] = (Math.random() - 0.5) * this.area;
      
      // Random velocities
      velocities[i3] = (Math.random() - 0.5) * 0.1;
      velocities[i3 + 1] = -0.1 - Math.random() * 0.3;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Store velocities in userData instead of as an attribute
    this.velocities = velocities;
    
    // Create simple snowflake material
    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: this.particleSize,
      transparent: true,
      opacity: 0.6,
      map: this.createSnowflakeTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    
    // Create particle system
    this.particleSystem = new THREE.Points(geometry, material);
    this.particles = geometry;
  }
  
  /**
   * Create a texture for the snowflakes
   * @returns {THREE.Texture} Snowflake texture
   */
  createSnowflakeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      0,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width / 2
    );
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.5, 'rgba(240, 240, 255, 0.5)');
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
    if (!this.particleSystem) return;
    
    // Skip update if intensity is zero
    if (this.intensity <= 0) {
      this.particleSystem.visible = false;
      return;
    } else {
      this.particleSystem.visible = true;
    }
    
    // Simple snowfall animation
    const positions = this.particles.attributes.position.array;
    
    // Only update a proportion of particles based on intensity
    const updateCount = Math.floor(this.particleCount * this.intensity);
    
    // Update particle positions
    for (let i = 0; i < updateCount; i++) {
      const i3 = i * 3;
      
      // Apply velocity and gravity
      positions[i3] += this.velocities[i3] * deltaTime * 10;
      positions[i3 + 1] += this.velocities[i3 + 1] * deltaTime * 10;
      positions[i3 + 2] += this.velocities[i3 + 2] * deltaTime * 10;
      
      // If particle goes below ground, reset it at the top
      if (positions[i3 + 1] < -5) {
        positions[i3] = (Math.random() - 0.5) * this.area;
        positions[i3 + 1] = this.height;
        positions[i3 + 2] = (Math.random() - 0.5) * this.area;
      }
      
      // If particle goes outside area, wrap it to the other side
      const halfArea = this.area / 2;
      if (positions[i3] < -halfArea) positions[i3] = halfArea;
      if (positions[i3] > halfArea) positions[i3] = -halfArea;
      if (positions[i3 + 2] < -halfArea) positions[i3 + 2] = halfArea;
      if (positions[i3 + 2] > halfArea) positions[i3 + 2] = -halfArea;
    }
    
    // Mark positions for update
    this.particles.attributes.position.needsUpdate = true;
  }
  
  /**
   * Set snow intensity
   * @param {number} intensity - Snow intensity (0-1)
   */
  setIntensity(intensity) {
    this.intensity = Math.max(0, Math.min(1, intensity));
    
    // Update particle opacity
    if (this.particleSystem) {
      this.particleSystem.material.opacity = 0.6 * this.intensity;
    }
    
    return this.intensity;
  }
} 