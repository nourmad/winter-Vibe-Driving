import * as THREE from 'three';

/**
 * Hands class creates and animates hands on the steering wheel
 */
export class Hands {
  constructor(scene) {
    this.scene = scene;
    
    // References
    this.leftHand = null;
    this.rightHand = null;
    this.steeringWheel = null;
    
    // Hand properties
    this.handColor = 0xffdbac; // Light skin tone
    this.fingerSegments = 8;
    this.palmSize = 0.08;
    this.fingerLength = 0.06;
    this.fingerWidth = 0.015;
    
    // Steering animation properties
    this.leftHandBasePosition = new THREE.Vector3(-0.15, 0, 0.03);
    this.rightHandBasePosition = new THREE.Vector3(0.15, 0, 0.03);
    this.maxSteeringAngle = Math.PI * 0.8; // How far hands can rotate on wheel
  }
  
  /**
   * Initialize hands with a reference to the steering wheel
   * @param {THREE.Object3D} steeringWheel - The steering wheel object
   */
  init(steeringWheel) {
    if (!steeringWheel) return;
    
    this.steeringWheel = steeringWheel;
    
    // Create hands
    this.createHands();
  }
  
  /**
   * Create hand meshes and add them to the steering wheel
   */
  createHands() {
    // Create left hand
    this.leftHand = this.createHand();
    this.leftHand.position.copy(this.leftHandBasePosition);
    this.leftHand.rotation.z = Math.PI / 2; // Orient hand correctly
    
    // Create right hand
    this.rightHand = this.createHand();
    this.rightHand.position.copy(this.rightHandBasePosition);
    this.rightHand.rotation.z = -Math.PI / 2; // Orient hand correctly
    
    // Add hands to steering wheel
    this.steeringWheel.add(this.leftHand);
    this.steeringWheel.add(this.rightHand);
  }
  
  /**
   * Create a single hand mesh
   * @returns {THREE.Group} Hand mesh group
   */
  createHand() {
    const handGroup = new THREE.Group();
    
    // Create palm
    const palmGeometry = new THREE.BoxGeometry(this.palmSize, this.palmSize, this.palmSize / 2);
    const handMaterial = new THREE.MeshPhongMaterial({ color: this.handColor });
    const palm = new THREE.Mesh(palmGeometry, handMaterial);
    handGroup.add(palm);
    
    // Create fingers
    const fingerPositions = [
      new THREE.Vector3(this.palmSize/3, this.palmSize/2, 0),       // Thumb
      new THREE.Vector3(this.palmSize/2, this.palmSize/3, 0),       // Index finger
      new THREE.Vector3(this.palmSize/2, 0, 0),                     // Middle finger
      new THREE.Vector3(this.palmSize/2, -this.palmSize/3, 0),      // Ring finger
      new THREE.Vector3(this.palmSize/2, -this.palmSize/2, 0)        // Pinky
    ];
    
    // Add each finger
    fingerPositions.forEach((position, index) => {
      const finger = this.createFinger(index === 0); // First finger is thumb
      finger.position.copy(position);
      
      // Different rotation for thumb
      if (index === 0) {
        finger.rotation.z = Math.PI / 4;
      }
      
      handGroup.add(finger);
    });
    
    return handGroup;
  }
  
  /**
   * Create a finger mesh
   * @param {boolean} isThumb - Whether this is a thumb
   * @returns {THREE.Group} Finger mesh group
   */
  createFinger(isThumb = false) {
    const fingerGroup = new THREE.Group();
    const fingerMaterial = new THREE.MeshPhongMaterial({ color: this.handColor });
    
    // Create segments for the finger
    let length = isThumb ? this.fingerLength * 0.8 : this.fingerLength;
    let width = isThumb ? this.fingerWidth * 1.2 : this.fingerWidth;
    
    // Create segments (joints)
    for (let i = 0; i < (isThumb ? 2 : 3); i++) {
      const segmentGeometry = new THREE.BoxGeometry(width, length, width);
      const segment = new THREE.Mesh(segmentGeometry, fingerMaterial);
      
      // Position segments one after another
      segment.position.set(0, length * i + length/2, 0);
      
      // Add slight bend to fingers to wrap around steering wheel
      segment.rotation.x = -Math.PI * 0.05 * (i + 1);
      
      fingerGroup.add(segment);
    }
    
    return fingerGroup;
  }
  
  /**
   * Update hand positions and animations based on steering input
   * @param {number} deltaTime - Time since last update
   * @param {number} steeringInput - Steering input value (-1 to 1)
   */
  update(deltaTime, steeringInput) {
    if (!this.leftHand || !this.rightHand) return;
    
    // Calculate hand rotation based on steering
    const steeringAngle = steeringInput * this.maxSteeringAngle;
    
    // Left hand moves around the left side of the wheel
    if (this.leftHand) {
      // Base position is at 10 o'clock
      const leftHandAngle = Math.PI * 0.8 + steeringAngle;
      this.leftHand.position.set(
        Math.cos(leftHandAngle) * 0.3,
        Math.sin(leftHandAngle) * 0.3,
        0.03
      );
      
      // Rotate hand to follow steering wheel curve
      this.leftHand.rotation.z = leftHandAngle + Math.PI / 2;
      
      // Slightly adjust finger bend based on steering (more grip on turns)
      const gripIntensity = Math.abs(steeringInput) * 0.15;
      this.leftHand.children.forEach((finger, i) => {
        if (i > 0) { // Skip the palm
          finger.rotation.x = -Math.PI * (0.1 + gripIntensity);
        }
      });
    }
    
    // Right hand moves around the right side of the wheel
    if (this.rightHand) {
      // Base position is at 2 o'clock
      const rightHandAngle = Math.PI * 0.2 + steeringAngle;
      this.rightHand.position.set(
        Math.cos(rightHandAngle) * 0.3,
        Math.sin(rightHandAngle) * 0.3,
        0.03
      );
      
      // Rotate hand to follow steering wheel curve
      this.rightHand.rotation.z = rightHandAngle - Math.PI / 2;
      
      // Slightly adjust finger bend based on steering (more grip on turns)
      const gripIntensity = Math.abs(steeringInput) * 0.15;
      this.rightHand.children.forEach((finger, i) => {
        if (i > 0) { // Skip the palm
          finger.rotation.x = -Math.PI * (0.1 + gripIntensity);
        }
      });
    }
  }
  
  /**
   * Set the hand color
   * @param {number} color - THREE.js color value
   */
  setHandColor(color) {
    if (this.leftHand && this.rightHand) {
      this.handColor = color;
      
      // Update material for all hand meshes
      const updateHandColor = (hand) => {
        hand.traverse((object) => {
          if (object.isMesh) {
            object.material.color.set(color);
          }
        });
      };
      
      updateHandColor(this.leftHand);
      updateHandColor(this.rightHand);
    }
  }
} 