let noise;
let pixels1 = [];
let pixels2 = [];
let currentPixels = [];
let isAnimating = false;
let animationProgress = 0;
let pixelSize = 20;
let pixelCount = 50;
let threshold = 128;
let isFirstImage = true;
let delaySpread = 0;
let pixelDelays = [];
let sourcePixels = [];
let targetPixels = [];
let noiseScale = 0.02; // Controls noise "zoom level"
let noiseOffset = 0; // For animating noise

function setup() {
    const canvas = createCanvas(1280, 720); // 16:9 ratio
    canvas.parent('canvas-container');
    
    // Initialize noise with random seed
    noise = new OpenSimplexNoise(Date.now());
    
    // Generate initial pixel positions
    pixels1 = generateNoisePixels(0);
    pixels2 = generateNoisePixels(1000); // Offset for different pattern
    
    sourcePixels = pixels1;
    targetPixels = pixels2;
    currentPixels = pixels1.map(p => ({x: p.x, y: p.y}));
    
    // Setup UI controls
    setupControls();
    resetPixelDelays();
}

function generateNoisePixels(offset) {
    let points = [];
    let occupied = new Set();
    let positions = [];
    
    // Create a grid of potential positions
    let gridSize = pixelSize;
    for (let x = 0; x < width; x += gridSize) {
        for (let y = 0; y < height; y += gridSize) {
            // Get noise value for this position
            let noiseVal = (noise.noise2D((x + offset) * noiseScale, y * noiseScale) + 1) * 127.5;
            if (noiseVal > threshold) {
                positions.push({x, y, brightness: noiseVal});
            }
        }
    }
    
    // Sort by brightness to prioritize brighter areas
    positions.sort((a, b) => b.brightness - a.brightness);
    
    // Take the brightest positions that don't overlap
    for (let pos of positions) {
        if (points.length >= pixelCount) break;
        
        // Snap to grid
        let canvasX = floor(pos.x / gridSize) * gridSize;
        let canvasY = floor(pos.y / gridSize) * gridSize;
        
        // Check if position is available
        let key = `${canvasX},${canvasY}`;
        if (!occupied.has(key)) {
            occupied.add(key);
            points.push({
                x: canvasX,
                y: canvasY
            });
        }
    }
    
    return points;
}

function resetPixelDelays() {
    pixelDelays = [];
    // Assign random delays to each pixel
    for (let i = 0; i < pixelCount; i++) {
        pixelDelays[i] = random(0, delaySpread / 100); // Convert to 0-1 range
    }
}

function draw() {
    background(0);
    
    // Draw pixels
    if (isAnimating) {
        // Animation logic
        animationProgress = min(animationProgress + 0.008, 1);
        
        // Safety check for array lengths
        if (currentPixels.length === 0 || sourcePixels.length === 0 || targetPixels.length === 0) {
            console.log('Error: Empty pixel arrays');
            return;
        }
        
        // Update and draw pixels
        for (let i = 0; i < currentPixels.length; i++) {
            let startPos = sourcePixels[i];
            let endPos = targetPixels[i];
            
            let delayedProgress = max(0, animationProgress - pixelDelays[i]);
            let normalizedProgress = delayedProgress;
            let eased = easeInOutCubic(normalizedProgress);
            
            currentPixels[i].x = lerp(startPos.x, endPos.x, eased);
            currentPixels[i].y = lerp(startPos.y, endPos.y, eased);
        }
        
        // Check if animation is complete
        let allPixelsComplete = currentPixels.every((pixel, i) => {
            return animationProgress >= (1 + pixelDelays[i]);
        });
        
        if (allPixelsComplete) {
            isAnimating = false;
            isFirstImage = !isFirstImage;
            let temp = sourcePixels;
            sourcePixels = targetPixels;
            targetPixels = temp;
            animationProgress = 0;
        }
    }
    
    // Draw all pixels
    noStroke();
    fill(255);
    let visiblePixels = 0;
    for (let pixel of currentPixels) {
        if (pixel && !isNaN(pixel.x) && !isNaN(pixel.y)) {
            rect(pixel.x, pixel.y, pixelSize, pixelSize);
            visiblePixels++;
        }
    }
    
    // Draw debug info below the canvas
    push();
    translate(0, height + 10);
    fill(255);
    noStroke();
    textSize(12);
    text('Current Pixels: ' + currentPixels.length, 10, 60);
    text('Source Pixels: ' + sourcePixels.length, 10, 80);
    text('Target Pixels: ' + targetPixels.length, 10, 100);
    text('Animation Progress: ' + animationProgress.toFixed(2), 10, 120);
    text('Is Animating: ' + isAnimating, 10, 140);
    text('Visible Pixels: ' + visiblePixels, 10, 160);
    pop();
}

function processImage(img) {
    console.log('Processing image:', img.width, 'x', img.height);
    let points = [];
    img.loadPixels();
    
    // Grid to track occupied positions
    let occupied = new Set();
    
    // Sort random positions by brightness to prioritize brighter areas
    let positions = [];
    // Create a grid where pixels will touch
    let gridSize = pixelSize;
    for (let x = 0; x < img.width; x += gridSize) {
        for (let y = 0; y < img.height; y += gridSize) {
            let index = (y * img.width + x) * 4;
            let brightness = (img.pixels[index] + img.pixels[index + 1] + img.pixels[index + 2]) / 3;
            if (brightness > threshold) {
                positions.push({x, y, brightness});
            }
        }
    }
    positions.sort((a, b) => b.brightness - a.brightness);
    
    // Take the brightest positions that don't overlap
    for (let pos of positions) {
        if (points.length >= pixelCount) break;
        
        // Convert to canvas coordinates and snap to grid
        let canvasX = floor(map(pos.x, 0, img.width, 0, width) / gridSize) * gridSize;
        let canvasY = floor(map(pos.y, 0, img.height, 0, height) / gridSize) * gridSize;
        
        // Check if position is available (not overlapping)
        let key = `${canvasX},${canvasY}`;
        if (!occupied.has(key)) {
            // Mark this position and surrounding area as occupied
            // Only mark the exact grid position as occupied
            occupied.add(key);
            points.push({
                x: canvasX,
                y: canvasY
            });
        }
    }
    
    console.log('Generated points:', points.length);
    return points;
}

function handleImage(file, isFirst) {
    loadImage(URL.createObjectURL(file), img => {
        if (isFirst) {
            img1 = img;
            pixels1 = processImage(img1);
            currentPixels = [...pixels1];
            isFirstImage = true;
        } else {
            img2 = img;
            pixels2 = processImage(img2);
        }
    });
}

function setupControls() {
    // Pixel size slider
    select('#pixelSize').input(function() {
        pixelSize = parseInt(this.value());
        select('#pixelSizeValue').html(pixelSize);
        pixels1 = generateNoisePixels(0);
        pixels2 = generateNoisePixels(1000);
        currentPixels = pixels1.map(p => ({x: p.x, y: p.y}));
        sourcePixels = pixels1;
        targetPixels = pixels2;
    });
    
    // Pixel count slider
    select('#pixelCount').input(function() {
        pixelCount = parseInt(this.value());
        select('#pixelCountValue').html(pixelCount);
        pixels1 = generateNoisePixels(0);
        pixels2 = generateNoisePixels(1000);
        currentPixels = pixels1.map(p => ({x: p.x, y: p.y}));
        sourcePixels = pixels1;
        targetPixels = pixels2;
    });
    
    // Threshold slider
    select('#threshold').input(function() {
        threshold = parseInt(this.value());
        select('#thresholdValue').html(threshold);
        pixels1 = generateNoisePixels(0);
        pixels2 = generateNoisePixels(1000);
        currentPixels = pixels1.map(p => ({x: p.x, y: p.y}));
        sourcePixels = pixels1;
        targetPixels = pixels2;
    });
    
    // Delay spread slider
    select('#delaySpread').input(function() {
        delaySpread = parseInt(this.value());
        select('#delaySpreadValue').html(delaySpread);
        resetPixelDelays();
    });
    
    // Generate button
    select('#generate').mousePressed(function() {
        if (!isAnimating) {
            isAnimating = true;
            animationProgress = 0;
            resetPixelDelays();
            // Generate new noise patterns
            pixels1 = generateNoisePixels(noiseOffset);
            pixels2 = generateNoisePixels(noiseOffset + 1000);
            noiseOffset += 100; // Increment offset for next generation
            sourcePixels = isFirstImage ? pixels1 : pixels2;
            targetPixels = isFirstImage ? pixels2 : pixels1;
        }
    });
}

function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2;
} 