import * as THREE from 'three';

/**
 * SnowEffect creates a realistic snowfall particle system
 */
export class SnowEffect {
  constructor(scene) {
    this.scene = scene;
    
    // Snowfall properties
    this.particleCount = 5000;  // Number of snowflakes
    this.particleSize = 0.05;   // Size of snowflakes
    this.fallSpeed = 0.3;       // How fast snow falls
    this.windStrength = 0.1;    // Wind strength
    this.windDirection = new THREE.Vector3(1, 0, 0); // Wind direction
    this.area = 100;            // Area over which snow falls
    this.height = 30;           // Height at which snow spawns
    
    // Particle system
    this.particles = null;
    this.particleSystem = null;
    
    // Wind animation
    this.windTime = 0;
    this.windChangeSpeed = 0.002;
    
    // Current snow intensity (0-1)
    this.intensity = 0.5;
  }
  
  /**
   * Initialize the snow effect
   */
  init() {
    // Create snow particles
    this.createParticles();
    
    // Add to scene
    this.scene.add(this.particleSystem);
  }
  
  /**
   * Create snow particle system
   */
  createParticles() {
    // Create particle geometry
    const particleGeometry = new THREE.BufferGeometry();
    
    // Generate random positions for particles
    const positions = new Float32Array(this.particleCount * 3);
    const velocities = new Float32Array(this.particleCount * 3);
    const sizes = new Float32Array(this.particleCount);
    
    for (let i = 0; i < this.particleCount; i++) {
      // Random positions within area
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * this.area;
      positions[i3 + 1] = Math.random() * this.height;
      positions[i3 + 2] = (Math.random() - 0.5) * this.area;
      
      // Random velocities
      velocities[i3] = (Math.random() - 0.5) * 0.1;
      velocities[i3 + 1] = -0.1 - Math.random() * this.fallSpeed * 0.5;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
      
      // Random sizes
      sizes[i] = this.particleSize * (0.5 + Math.random() * 0.5);
    }
    
    // Add attributes to geometry
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // Create snow material with custom shader
    const snowMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: this.particleSize,
      transparent: true,
      opacity: 0.8,
      map: this.createSnowflakeTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });
    
    // Create particle system
    this.particleSystem = new THREE.Points(particleGeometry, snowMaterial);
    this.particles = particleGeometry;
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
    
    // Get particle attributes
    const positions = this.particles.attributes.position.array;
    const velocities = this.particles.attributes.velocity.array;
    
    // Update wind direction over time for natural variation
    this.windTime += deltaTime * this.windChangeSpeed;
    const windX = Math.sin(this.windTime) * this.windStrength;
    const windZ = Math.cos(this.windTime * 0.7) * this.windStrength * 0.5;
    this.windDirection.set(windX, 0, windZ);
    
    // Only update a proportion of particles based on intensity
    const updateCount = Math.floor(this.particleCount * this.intensity);
    
    // Update particle positions
    for (let i = 0; i < updateCount; i++) {
      const i3 = i * 3;
      
      // Apply velocity and wind
      positions[i3] += velocities[i3] + this.windDirection.x * deltaTime;
      positions[i3 + 1] += velocities[i3 + 1] * deltaTime;
      positions[i3 + 2] += velocities[i3 + 2] + this.windDirection.z * deltaTime;
      
      // If particle goes below ground, reset it at the top
      if (positions[i3 + 1] < -2) {
        positions[i3] = (Math.random() - 0.5) * this.area;
        positions[i3 + 1] = this.height;
        positions[i3 + 2] = (Math.random() - 0.5) * this.area;
        
        // Reset velocity with slight variation
        velocities[i3] = (Math.random() - 0.5) * 0.1;
        velocities[i3 + 1] = -0.1 - Math.random() * this.fallSpeed * 0.5;
        velocities[i3 + 2] = (Math.random() - 0.5) * 0.1;
      }
      
      // If particle goes outside area, wrap it to the other side
      const halfArea = this.area / 2;
      if (positions[i3] < -halfArea) positions[i3] = halfArea;
      if (positions[i3] > halfArea) positions[i3] = -halfArea;
      if (positions[i3 + 2] < -halfArea) positions[i3 + 2] = halfArea;
      if (positions[i3 + 2] > halfArea) positions[i3 + 2] = -halfArea;
    }
    
    // Mark attributes for update
    this.particles.attributes.position.needsUpdate = true;
  }
  
  /**
   * Set snow intensity
   * @param {number} intensity - Snow intensity (0-1)
   */
  setIntensity(intensity) {
    this.intensity = Math.max(0, Math.min(1, intensity));
    
    // Update particle count
    if (this.particleSystem) {
      this.particleSystem.material.opacity = 0.7 * this.intensity;
    }
    
    return this.intensity;
  }
  
  /**
   * Set wind properties
   * @param {number} strength - Wind strength
   * @param {THREE.Vector3} direction - Wind direction
   */
  setWind(strength, direction) {
    this.windStrength = strength;
    
    if (direction) {
      this.windDirection.copy(direction).normalize();
    }
  }
  
  /**
   * Set the area where snow falls
   * @param {number} area - Size of snow area
   * @param {number} height - Height at which snow spawns
   */
  setArea(area, height) {
    if (area) this.area = area;
    if (height) this.height = height;
    
    // Re-create particles with new area
    if (this.particleSystem) {
      this.scene.remove(this.particleSystem);
      this.createParticles();
      this.scene.add(this.particleSystem);
    }
  }
} 