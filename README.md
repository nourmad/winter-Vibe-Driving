# Winter Driving Simulator

A 3D driving simulator with winter environment using Three.js and Cannon.js physics.

## Features

- Drive a vehicle in a winter landscape
- Physics-based driving mechanics
- Snow effects
- Camera modes (first and third person)
- Snow intensity controls

## Getting Started

### Prerequisites

- Node.js (v14+ recommended)
- npm

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

### Running the Application

Start the development server:

```bash
npm start
```

The application will be available at http://localhost:1234 (or another port if 1234 is already in use).

### Alternative Direct Version

If you encounter any issues with the main application, you can use the standalone version by opening `direct.html` or `fix.html` directly in your browser. These versions don't require a build step and contain all the code in a single file.

### Controls

- **W / Up Arrow**: Accelerate forward
- **S / Down Arrow**: Brake/Reverse
- **A / Left Arrow**: Steer left
- **D / Right Arrow**: Steer right
- **Toggle Camera Button**: Switch between first-person and third-person view
- **Snow Intensity Slider**: Adjust the amount of snow in the scene

## Troubleshooting

If you encounter any issues:

1. Make sure all dependencies are installed with `npm install`
2. Try using the direct.html version as a fallback
3. Check the browser console for any error messages
4. Try refreshing the page or clicking the "Retry" button

## Technologies Used

- Three.js - 3D WebGL graphics
- Cannon.js - Physics engine
- Parcel - Bundler 