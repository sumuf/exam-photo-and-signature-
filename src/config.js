export const UPSC_CONFIG = {
  output: {
    width: 600,
    height: 800,
    mimeType: "image/jpeg",
    filename: "photo.jpg"
  },
  fileSizeKB: {
    min: 20,
    max: 200
  },
  limits: {
    maxInputMB: 15
  },
  face: {
    minCoverageRatio: 0.75,
    maxCoverageRatio: 0.95,
    centerToleranceRatio: 0.12,
    tiltTolerancePx: 20
  },
  guide: {
    widthRatio: 0.82,
    heightRatio: 0.92,
    borderRadiusRatio: 0.12
  },
  background: {
    edgeSampleRatio: 0.1,
    minBrightness: 224,
    maxSaturation: 0.12,
    maxVariance: 980
  },
  blur: {
    minEdgeScore: 12
  },
  shadow: {
    maxDarkPixelRatio: 0.06,
    maxSideDifference: 24
  },
  glare: {
    maxBrightRatio: 0.028
  },
  recencyDays: 10,
  text: {
    barHeightPx: 92,
    fontSizePx: 30,
    minFontPx: 17,
    fontWeight: 700,
    fontFamily: "\"Trebuchet MS\", \"Avenir Next\", sans-serif",
    color: "#0f2f36",
    barColor: "rgba(255, 255, 255, 0.96)"
  }
};

export const CHECKLIST_LABELS = {
  faceCoverage: "Face coverage at least 75%",
  headCentered: "Head centered in frame",
  frontal: "Frontal alignment",
  eyesOpen: "Eyes open and visible",
  earsVisible: "Both ears visible",
  plainWhiteBackground: "Plain white background",
  noShadows: "No major shadows",
  sharpness: "Photo is not blurry",
  naturalExpression: "Natural expression",
  hairClear: "No hair over eyes",
  noGlare: "No glare on glasses",
  noRestrictedItems: "No restricted items or marks",
  nameDatePrinted: "Name and Date printed clearly",
  recency: "Photo recency within 10 days",
  fileFormat: "JPG/JPEG format",
  fileSize: "File size 20KB to 200KB"
};

export const SIGNATURE_CONFIG = {
  output: {
    width: 400,
    height: 500,
    mimeType: "image/jpeg",
    filename: "signature.jpg"
  },
  fileSizeKB: {
    min: 20,
    max: 100
  },
  dimensionPx: {
    min: 350,
    max: 500
  },
  limits: {
    maxInputMB: 15
  },
  guide: {
    widthRatio: 0.9,
    heightRatio: 0.9,
    borderRadiusRatio: 0.04,
    slotGapRatio: 0.06
  },
  background: {
    edgeSampleRatio: 0.1,
    minBrightness: 228,
    maxSaturation: 0.08,
    maxVariance: 820
  },
  blur: {
    minEdgeScore: 9
  },
  shadow: {
    maxDarkPixelRatio: 0.09,
    maxSideDifference: 30
  },
  detect: {
    inkLuminanceThreshold: 145,
    maxInkSaturation: 0.5,
    minRowInkRatio: 0.015,
    minColInkRatio: 0.015,
    minBandHeightRatio: 0.04,
    maxBandGapPx: 3,
    minGapRatio: 0.05,
    minContrast: 65,
    severeContrast: 42,
    minInkRatioHard: 0.002,
    maxAlignmentDeviationRatio: 0.18
  }
};

export const SIGNATURE_CHECKLIST_LABELS = {
  fileFormat: "Format is JPG/JPEG",
  fileSize: "File size is 20KB to 100KB",
  dimensions: "Dimensions are between 350 and 500 px",
  threeSignatures: "Exactly 3 signatures present",
  sharpness: "Signature image is sharp and readable",
  plainWhiteBackground: "Plain white paper background",
  noShadows: "No major shadows",
  contrast: "Ink contrast is acceptable",
  spacing: "Signatures have enough spacing",
  alignment: "Signatures are vertically aligned",
  orientation: "Image is properly oriented (not tilted)"
};
