import * as THREE from 'three';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';

/**
 * TerrainGenerator creates procedural winter terrain
 */
export class TerrainGenerator {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;
    
    // Terrain settings
    this.size = 100;           // Size of the terrain
    this.resolution = 128;     // Resolution of the heightmap
    this.maxHeight = 6;        // Maximum terrain height
    this.roughness = 0.8;      // Terrain roughness factor
    
    // Track settings
    this.trackWidth = 5;       // Width of the track
    this.trackPathVariance = 5; // How much the track path varies
    this.trackSmoothness = 0.3; // How smooth the track path is
    
    // Snow settings
    this.snowHeight = 0.2;     // Height of snow layer
    this.snowVariance = 0.3;   // Variance of snow height
    
    // Generation objects
    this.terrain = null;       // Main terrain mesh
    this.heightData = null;    // Height data for physics
    this.snowCovering = null;  // Snow covering mesh
    this.trees = [];           // Array of tree objects
    this.rocks = [];           // Array of rock objects
    
    // Noise generators for various features
    this.terrainNoise = new SimplexNoise();
    this.trackNoise = new SimplexNoise();
    this.detailNoise = new SimplexNoise();
    this.snowNoise = new SimplexNoise();
  }
  
  /**
   * Generate the terrain and add it to the scene
   */
  generate() {
    // Create heightmap data
    this.generateHeightData();
    
    // Create terrain mesh
    this.createTerrainMesh();
    
    // Add snow covering
    this.createSnowCovering();
    
    // Add physics terrain
    this.createTerrainPhysics();
    
    // Add decorations (trees, rocks)
    this.addDecorations();
    
    // Add road path
    this.createRoadPath();
  }
  
  /**
   * Generate height data for the terrain
   */
  generateHeightData() {
    // Create height data array
    this.heightData = new Array(this.resolution);
    for (let i = 0; i < this.resolution; i++) {
      this.heightData[i] = new Array(this.resolution);
    }
    
    // Define a track path using noise
    const trackPath = [];
    const trackLength = 20; // Number of control points
    let x = this.size / 2;
    let z = this.size / 2;
    
    // Generate track control points
    for (let i = 0; i < trackLength; i++) {
      // Use noise to determine next track direction
      const angle = this.trackNoise.noise(i * this.trackSmoothness, 0) * Math.PI * 2;
      
      // Move in that direction
      x += Math.cos(angle) * this.trackPathVariance;
      z += Math.sin(angle) * this.trackPathVariance;
      
      // Keep track within terrain bounds
      x = Math.max(this.trackWidth, Math.min(x, this.size - this.trackWidth));
      z = Math.max(this.trackWidth, Math.min(z, this.size - this.trackWidth));
      
      trackPath.push({ x, z });
    }
    
    // Fill height data using perlin noise
    for (let i = 0; i < this.resolution; i++) {
      for (let j = 0; j < this.resolution; j++) {
        // Convert grid positions to world coordinates
        const x = (i / this.resolution) * this.size;
        const z = (j / this.resolution) * this.size;
        
        // Get base terrain height from noise
        let height = this.getBaseHeight(x, z);
        
        // Flatten terrain where track will be
        const distanceToTrack = this.getDistanceToTrack(x, z, trackPath);
        
        if (distanceToTrack < this.trackWidth) {
          // Create smooth transition between track and terrain
          const transitionFactor = distanceToTrack / this.trackWidth;
          height = height * transitionFactor * transitionFactor;
          
          // Ensure track is never below zero height
          height = Math.max(0.2, height);
        }
        
        // Store height in grid
        this.heightData[i][j] = height;
      }
    }
  }
  
  /**
   * Get base height for a point using multiple noise octaves
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @returns {number} Height value
   */
  getBaseHeight(x, z) {
    // Scale coordinates to appropriate noise space
    const nx = x / this.size - 0.5;
    const nz = z / this.size - 0.5;
    
    // Large-scale terrain features
    let height = this.terrainNoise.noise(nx, nz) * 0.5;
    
    // Add medium-scale features
    height += this.terrainNoise.noise(nx * 2, nz * 2) * 0.25;
    
    // Add small-scale features
    height += this.terrainNoise.noise(nx * 4, nz * 4) * 0.125;
    
    // Add tiny detail noise
    height += this.detailNoise.noise(nx * 16, nz * 16) * 0.0625;
    
    // Normalize and scale
    height = (height + 1) * 0.5 * this.maxHeight;
    
    // Add edge falloff to create bounded terrain
    const distanceToEdge = Math.min(
      Math.min(x, this.size - x),
      Math.min(z, this.size - z)
    ) / (this.size * 0.1);
    
    // Apply edge falloff
    const edgeFactor = Math.min(1, distanceToEdge);
    height *= edgeFactor;
    
    return height;
  }
  
  /**
   * Get distance from a point to nearest track segment
   * @param {number} x - X coordinate
   * @param {number} z - Z coordinate
   * @param {Array} trackPath - Array of track control points
   * @returns {number} Distance to track
   */
  getDistanceToTrack(x, z, trackPath) {
    let minDistance = Infinity;
    
    // Check distance to each track segment
    for (let i = 0; i < trackPath.length - 1; i++) {
      const a = trackPath[i];
      const b = trackPath[(i + 1) % trackPath.length];
      
      // Calculate distance to line segment
      const segment = this.distanceToSegment(x, z, a.x, a.z, b.x, b.z);
      minDistance = Math.min(minDistance, segment);
    }
    
    return minDistance;
  }
  
  /**
   * Calculate distance from point to line segment
   * @param {number} x - Point X coordinate
   * @param {number} z - Point Z coordinate
   * @param {number} x1 - Segment start X coordinate
   * @param {number} z1 - Segment start Z coordinate
   * @param {number} x2 - Segment end X coordinate
   * @param {number} z2 - Segment end Z coordinate
   * @returns {number} Distance to segment
   */
  distanceToSegment(x, z, x1, z1, x2, z2) {
    const A = x - x1;
    const B = z - z1;
    const C = x2 - x1;
    const D = z2 - z1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
      param = dot / lenSq;
    }
    
    let xx, zz;
    
    if (param < 0) {
      xx = x1;
      zz = z1;
    } else if (param > 1) {
      xx = x2;
      zz = z2;
    } else {
      xx = x1 + param * C;
      zz = z1 + param * D;
    }
    
    const dx = x - xx;
    const dz = z - zz;
    
    return Math.sqrt(dx * dx + dz * dz);
  }
  
  /**
   * Create terrain mesh from height data
   */
  createTerrainMesh() {
    // Create terrain geometry
    const geometry = new THREE.PlaneGeometry(
      this.size,
      this.size,
      this.resolution - 1,
      this.resolution - 1
    );
    
    // Rotate to XZ plane
    geometry.rotateX(-Math.PI / 2);
    
    // Apply height data to vertices
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < this.resolution; i++) {
      for (let j = 0; j < this.resolution; j++) {
        const index = (i * this.resolution + j) * 3;
        vertices[index + 1] = this.heightData[i][j]; // Y component
      }
    }
    
    // Update normals
    geometry.computeVertexNormals();
    
    // Create terrain material with texture
    const material = new THREE.MeshStandardMaterial({
      color: 0x7b6d64,
      roughness: 0.95,
      metalness: 0,
      vertexColors: false
    });
    
    // Create terrain mesh
    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = true;
    
    // Center terrain
    this.terrain.position.set(-this.size / 2, 0, -this.size / 2);
    
    // Add to scene
    this.scene.add(this.terrain);
  }
  
  /**
   * Create snow covering mesh on top of terrain
   */
  createSnowCovering() {
    // Create snow geometry (identical to terrain but slightly elevated)
    const geometry = new THREE.PlaneGeometry(
      this.size,
      this.size,
      this.resolution - 1,
      this.resolution - 1
    );
    
    // Rotate to XZ plane
    geometry.rotateX(-Math.PI / 2);
    
    // Apply height data to vertices with snow height variation
    const vertices = geometry.attributes.position.array;
    for (let i = 0; i < this.resolution; i++) {
      for (let j = 0; j < this.resolution; j++) {
        const index = (i * this.resolution + j) * 3;
        
        // Add snow height with variation
        const x = (i / this.resolution) * this.size;
        const z = (j / this.resolution) * this.size;
        
        // Get snow variation from noise
        const snowVariationNoise = this.snowNoise.noise(
          x / (this.size / 10),
          z / (this.size / 10)
        ) * this.snowVariance;
        
        // Apply height with snow on top
        vertices[index + 1] = this.heightData[i][j] + this.snowHeight + snowVariationNoise;
      }
    }
    
    // Update normals
    geometry.computeVertexNormals();
    
    // Create snow material
    const snowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
      metalness: 0.1,
      emissive: 0x444444,
      emissiveIntensity: 0.1
    });
    
    // Create snow mesh
    this.snowCovering = new THREE.Mesh(geometry, snowMaterial);
    this.snowCovering.receiveShadow = true;
    
    // Center snow
    this.snowCovering.position.set(-this.size / 2, 0, -this.size / 2);
    
    // Add to scene
    this.scene.add(this.snowCovering);
  }
  
  /**
   * Create physics body for terrain collision
   */
  createTerrainPhysics() {
    // Convert height data to format needed by physics
    this.physics.createTerrainBody(this.heightData, {
      elementSize: this.size / this.resolution,
      maxHeight: this.maxHeight,
      minHeight: 0
    });
  }
  
  /**
   * Add decorative elements to the terrain
   */
  addDecorations() {
    // Add trees
    this.addTrees(50);
    
    // Add rocks
    this.addRocks(30);
  }
  
  /**
   * Add trees to the terrain
   * @param {number} count - Number of trees to add
   */
  addTrees(count) {
    // Create tree meshes
    for (let i = 0; i < count; i++) {
      // Random position
      const x = Math.random() * this.size - this.size / 2;
      const z = Math.random() * this.size - this.size / 2;
      
      // Find height at this position
      const terrainX = (x + this.size / 2) / this.size * this.resolution;
      const terrainZ = (z + this.size / 2) / this.size * this.resolution;
      
      const ix = Math.floor(terrainX);
      const iz = Math.floor(terrainZ);
      
      // Skip if outside terrain bounds
      if (ix < 0 || ix >= this.resolution - 1 || iz < 0 || iz >= this.resolution - 1) {
        continue;
      }
      
      // Get interpolated height
      const fx = terrainX - ix;
      const fz = terrainZ - iz;
      
      const h1 = this.heightData[ix][iz];
      const h2 = this.heightData[ix + 1][iz];
      const h3 = this.heightData[ix][iz + 1];
      const h4 = this.heightData[ix + 1][iz + 1];
      
      const height = 
        h1 * (1 - fx) * (1 - fz) +
        h2 * fx * (1 - fz) +
        h3 * (1 - fx) * fz +
        h4 * fx * fz;
      
      // Skip if on the road (height too low)
      const distanceToTrack = this.getDistanceToTrack(
        x + this.size / 2,
        z + this.size / 2,
        [] // Use track path here
      );
      
      if (distanceToTrack < this.trackWidth * 1.5) {
        continue;
      }
      
      // Create tree
      const tree = this.createTree();
      tree.position.set(x, height, z);
      
      // Random rotation
      tree.rotation.y = Math.random() * Math.PI * 2;
      
      // Random scale
      const scale = 0.6 + Math.random() * 0.8;
      tree.scale.set(scale, scale, scale);
      
      // Add to scene
      this.scene.add(tree);
      this.trees.push(tree);
    }
  }
  
  /**
   * Create a single tree mesh
   * @returns {THREE.Group} Tree mesh group
   */
  createTree() {
    const tree = new THREE.Group();
    
    // Create trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x614a32,
      roughness: 0.9
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 0.75;
    trunk.castShadow = true;
    
    tree.add(trunk);
    
    // Create snow-covered pine tree
    const pineGeometry = new THREE.ConeGeometry(1, 2, 8);
    const pineMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d4c25,
      roughness: 0.8
    });
    
    // Create multiple cone sections for the tree
    const sections = 4;
    for (let i = 0; i < sections; i++) {
      const section = new THREE.Mesh(pineGeometry, pineMaterial);
      section.position.y = 1.5 + i * 0.5;
      section.scale.set(1 - i * 0.2, 1 - i * 0.15, 1 - i * 0.2);
      section.castShadow = true;
      tree.add(section);
      
      // Add snow on top of each section
      const snowGeometry = new THREE.ConeGeometry(1.05 - i * 0.2, 0.3, 8);
      const snowMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.8
      });
      const snow = new THREE.Mesh(snowGeometry, snowMaterial);
      snow.position.y = 1.5 + i * 0.5 + 0.9 - i * 0.075;
      snow.castShadow = true;
      tree.add(snow);
    }
    
    return tree;
  }
  
  /**
   * Add rocks to the terrain
   * @param {number} count - Number of rocks to add
   */
  addRocks(count) {
    // Create rock meshes
    for (let i = 0; i < count; i++) {
      // Random position
      const x = Math.random() * this.size - this.size / 2;
      const z = Math.random() * this.size - this.size / 2;
      
      // Find height at this position (same as for trees)
      const terrainX = (x + this.size / 2) / this.size * this.resolution;
      const terrainZ = (z + this.size / 2) / this.size * this.resolution;
      
      const ix = Math.floor(terrainX);
      const iz = Math.floor(terrainZ);
      
      // Skip if outside terrain bounds
      if (ix < 0 || ix >= this.resolution - 1 || iz < 0 || iz >= this.resolution - 1) {
        continue;
      }
      
      // Get interpolated height
      const fx = terrainX - ix;
      const fz = terrainZ - iz;
      
      const h1 = this.heightData[ix][iz];
      const h2 = this.heightData[ix + 1][iz];
      const h3 = this.heightData[ix][iz + 1];
      const h4 = this.heightData[ix + 1][iz + 1];
      
      const height = 
        h1 * (1 - fx) * (1 - fz) +
        h2 * fx * (1 - fz) +
        h3 * (1 - fx) * fz +
        h4 * fx * fz;
      
      // Skip if on the road
      const distanceToTrack = this.getDistanceToTrack(
        x + this.size / 2,
        z + this.size / 2,
        [] // Use track path here
      );
      
      if (distanceToTrack < this.trackWidth) {
        continue;
      }
      
      // Create rock
      const rock = this.createRock();
      rock.position.set(x, height, z);
      
      // Random rotation
      rock.rotation.y = Math.random() * Math.PI * 2;
      
      // Random scale
      const scale = 0.3 + Math.random() * 0.7;
      rock.scale.set(scale, scale, scale);
      
      // Add to scene
      this.scene.add(rock);
      this.rocks.push(rock);
    }
  }
  
  /**
   * Create a single rock mesh
   * @returns {THREE.Mesh} Rock mesh
   */
  createRock() {
    // Create rock geometry (irregular polyhedron)
    const rockGeometry = new THREE.DodecahedronGeometry(1, 1);
    
    // Distort vertices to make it look more like a rock
    const positions = rockGeometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += (Math.random() - 0.5) * 0.2;
      positions[i + 1] += (Math.random() - 0.5) * 0.2;
      positions[i + 2] += (Math.random() - 0.5) * 0.2;
    }
    
    // Update normals after vertex modification
    rockGeometry.computeVertexNormals();
    
    // Create rock material
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.9,
      metalness: 0.1
    });
    
    // Create rock mesh
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.castShadow = true;
    rock.receiveShadow = true;
    
    // Add snow on top
    const snowGeometry = new THREE.DodecahedronGeometry(0.95, 1);
    // Take only top part for snow cap
    const positions2 = snowGeometry.attributes.position.array;
    for (let i = 0; i < positions2.length; i += 3) {
      // Remove bottom vertices
      if (positions2[i + 1] < 0.3) {
        positions2[i] = 0;
        positions2[i + 1] = -10; // Move way below
        positions2[i + 2] = 0;
      } else {
        // Add variation to snow
        positions2[i] += (Math.random() - 0.5) * 0.1;
        positions2[i + 1] += (Math.random() - 0.5) * 0.1;
        positions2[i + 2] += (Math.random() - 0.5) * 0.1;
      }
    }
    
    // Update snow normals
    snowGeometry.computeVertexNormals();
    
    // Create snow material
    const snowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0
    });
    
    // Create snow mesh
    const snow = new THREE.Mesh(snowGeometry, snowMaterial);
    snow.castShadow = true;
    
    // Create a group for rock and snow
    const rockGroup = new THREE.Group();
    rockGroup.add(rock);
    rockGroup.add(snow);
    
    return rockGroup;
  }
  
  /**
   * Create visual representation of the road path
   */
  createRoadPath() {
    // In a real implementation, this would create the actual road meshes
    // For this example, we'll rely on the flattened terrain
  }
  
  /**
   * Resize the terrain
   * @param {Object} options - New terrain options
   */
  resize(options) {
    // Update terrain settings
    if (options.size !== undefined) this.size = options.size;
    if (options.resolution !== undefined) this.resolution = options.resolution;
    if (options.maxHeight !== undefined) this.maxHeight = options.maxHeight;
    if (options.roughness !== undefined) this.roughness = options.roughness;
    
    // Remove existing terrain
    if (this.terrain) {
      this.scene.remove(this.terrain);
      this.terrain.geometry.dispose();
      this.terrain.material.dispose();
    }
    
    if (this.snowCovering) {
      this.scene.remove(this.snowCovering);
      this.snowCovering.geometry.dispose();
      this.snowCovering.material.dispose();
    }
    
    // Remove decorations
    this.trees.forEach(tree => {
      this.scene.remove(tree);
      this.disposeMesh(tree);
    });
    
    this.rocks.forEach(rock => {
      this.scene.remove(rock);
      this.disposeMesh(rock);
    });
    
    this.trees = [];
    this.rocks = [];
    
    // Generate new terrain
    this.generate();
  }
  
  /**
   * Dispose of a mesh to free memory
   * @param {THREE.Object3D} object - Object to dispose
   */
  disposeMesh(object) {
    object.traverse(node => {
      if (node.isMesh) {
        node.geometry.dispose();
        
        if (node.material.map) node.material.map.dispose();
        if (node.material.lightMap) node.material.lightMap.dispose();
        if (node.material.bumpMap) node.material.bumpMap.dispose();
        if (node.material.normalMap) node.material.normalMap.dispose();
        if (node.material.specularMap) node.material.specularMap.dispose();
        if (node.material.envMap) node.material.envMap.dispose();
        
        node.material.dispose();
      }
    });
  }
} 