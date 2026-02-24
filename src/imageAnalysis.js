import { makeStatus } from "./utils.js";

let detector = null;

function getFaceDetector() {
  if (detector) {
    return detector;
  }
  if ("FaceDetector" in window) {
    detector = new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
  }
  return detector;
}

function landmarkPoint(landmarks, type) {
  if (!landmarks?.length) {
    return null;
  }
  const match = landmarks.find((item) => item.type === type);
  if (!match) {
    return null;
  }
  if (Array.isArray(match.locations) && match.locations.length > 0) {
    return match.locations[0];
  }
  if (match.location) {
    return match.location;
  }
  return null;
}

export async function detectFace(canvas) {
  const faceDetector = getFaceDetector();
  if (!faceDetector) {
    return { available: false, detected: false };
  }
  try {
    const faces = await faceDetector.detect(canvas);
    if (!faces?.length) {
      return { available: true, detected: false };
    }
    const face = faces[0];
    const leftEye = landmarkPoint(face.landmarks, "leftEye");
    const rightEye = landmarkPoint(face.landmarks, "rightEye");
    return {
      available: true,
      detected: true,
      box: face.boundingBox,
      leftEye,
      rightEye,
      landmarks: face.landmarks ?? []
    };
  } catch (error) {
    return {
      available: false,
      detected: false,
      error: error instanceof Error ? error.message : "Face detection failed."
    };
  }
}

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) {
    return 0;
  }
  return (max - min) / max;
}

export function analyzeBackground(context, width, height, config) {
  const { data } = context.getImageData(0, 0, width, height);
  const edgeX = Math.max(2, Math.floor(width * config.edgeSampleRatio));
  const edgeY = Math.max(2, Math.floor(height * config.edgeSampleRatio));

  let count = 0;
  let sumLum = 0;
  let sumLumSq = 0;
  let sumSat = 0;

  for (let y = 0; y < height; y += 2) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x += 2) {
      const onEdge = x < edgeX || x > width - edgeX || y < edgeY || y > height - edgeY;
      if (!onEdge) {
        continue;
      }
      const index = rowOffset + x * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const lum = luminance(r, g, b);
      const sat = saturation(r, g, b);
      sumLum += lum;
      sumLumSq += lum * lum;
      sumSat += sat;
      count += 1;
    }
  }

  if (count === 0) {
    return {
      status: makeStatus("warn", "Background could not be evaluated."),
      metrics: null
    };
  }

  const avgLum = sumLum / count;
  const avgSat = sumSat / count;
  const variance = sumLumSq / count - avgLum * avgLum;

  const pass =
    avgLum >= config.minBrightness &&
    avgSat <= config.maxSaturation &&
    variance <= config.maxVariance;

  return {
    status: pass
      ? makeStatus("pass", "Background appears plain white.")
      : makeStatus("warn", "Background may be dark, colored, or patterned."),
    metrics: {
      avgLum,
      avgSat,
      variance
    }
  };
}

export function analyzeBlur(context, width, height, config) {
  const { data } = context.getImageData(0, 0, width, height);
  const w = width;
  const h = height;
  let score = 0;
  let count = 0;

  for (let y = 0; y < h - 2; y += 2) {
    for (let x = 0; x < w - 2; x += 2) {
      const i = (y * w + x) * 4;
      const right = (y * w + (x + 2)) * 4;
      const down = ((y + 2) * w + x) * 4;
      const lum = luminance(data[i], data[i + 1], data[i + 2]);
      const lumRight = luminance(data[right], data[right + 1], data[right + 2]);
      const lumDown = luminance(data[down], data[down + 1], data[down + 2]);
      score += Math.abs(lum - lumRight) + Math.abs(lum - lumDown);
      count += 1;
    }
  }

  const edgeScore = count === 0 ? 0 : score / count;
  const blurry = edgeScore < config.minEdgeScore;

  return {
    status: blurry
      ? makeStatus("warn", "Photo appears blurry.")
      : makeStatus("pass", "Photo sharpness looks acceptable."),
    metrics: {
      edgeScore
    }
  };
}

export function analyzeShadows(context, width, height, config) {
  const { data } = context.getImageData(0, 0, width, height);
  let total = 0;
  let dark = 0;
  let leftLum = 0;
  let rightLum = 0;
  let leftCount = 0;
  let rightCount = 0;

  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const i = (y * width + x) * 4;
      const lum = luminance(data[i], data[i + 1], data[i + 2]);
      if (lum < 70) {
        dark += 1;
      }
      if (x < width / 2) {
        leftLum += lum;
        leftCount += 1;
      } else {
        rightLum += lum;
        rightCount += 1;
      }
      total += 1;
    }
  }

  const darkRatio = total === 0 ? 0 : dark / total;
  const leftAvg = leftCount ? leftLum / leftCount : 0;
  const rightAvg = rightCount ? rightLum / rightCount : 0;
  const sideDiff = Math.abs(leftAvg - rightAvg);
  const hasShadows = darkRatio > config.maxDarkPixelRatio || sideDiff > config.maxSideDifference;

  return {
    status: hasShadows
      ? makeStatus("warn", "Shadows detected on face or background.")
      : makeStatus("pass", "Shadow levels look acceptable."),
    metrics: {
      darkRatio,
      sideDiff
    }
  };
}

export function analyzeGlare(context, width, height, faceBox, config) {
  if (!faceBox) {
    return {
      status: makeStatus("warn", "Glare check unavailable without face detection."),
      metrics: null
    };
  }

  const xStart = Math.max(0, Math.floor(faceBox.x + faceBox.width * 0.15));
  const yStart = Math.max(0, Math.floor(faceBox.y + faceBox.height * 0.18));
  const xEnd = Math.min(width, Math.floor(faceBox.x + faceBox.width * 0.85));
  const yEnd = Math.min(height, Math.floor(faceBox.y + faceBox.height * 0.42));

  if (xEnd <= xStart || yEnd <= yStart) {
    return {
      status: makeStatus("warn", "Glare region could not be evaluated."),
      metrics: null
    };
  }

  const { data } = context.getImageData(xStart, yStart, xEnd - xStart, yEnd - yStart);
  let bright = 0;
  let total = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = luminance(r, g, b);
    const sat = saturation(r, g, b);
    if (lum > 245 && sat < 0.2) {
      bright += 1;
    }
    total += 1;
  }

  const brightRatio = total === 0 ? 0 : bright / total;
  const hasGlare = brightRatio > config.maxBrightRatio;

  return {
    status: hasGlare
      ? makeStatus("warn", "Possible glare detected near eye area.")
      : makeStatus("pass", "No obvious glare detected."),
    metrics: {
      brightRatio
    }
  };
}
