
import { UPSC_CONFIG, CHECKLIST_LABELS, SIGNATURE_CONFIG, SIGNATURE_CHECKLIST_LABELS } from "./config.js";
import { analyzeBackground, analyzeBlur, analyzeShadows, analyzeGlare, detectFace } from "./imageAnalysis.js";
import {
  clamp,
  formatKB,
  toDateInputValue,
  canvasToBlob,
  loadBitmapFromBlob,
  drawRoundedRectPath,
  parseDate,
  dateDiffInDays,
  makeStatus
} from "./utils.js";

const elements = {
  modePhotoBtn: document.getElementById("modePhotoBtn"),
  modeSignatureBtn: document.getElementById("modeSignatureBtn"),
  photoMode: document.getElementById("photoMode"),
  signatureMode: document.getElementById("signatureMode"),

  statusBanner: document.getElementById("statusBanner"),
  sourceMeta: document.getElementById("sourceMeta"),
  step2: document.getElementById("step2"),
  step3: document.getElementById("step3"),
  step4: document.getElementById("step4"),
  startCameraBtn: document.getElementById("startCameraBtn"),
  captureBtn: document.getElementById("captureBtn"),
  stopCameraBtn: document.getElementById("stopCameraBtn"),
  cameraPane: document.getElementById("cameraPane"),
  cameraVideo: document.getElementById("cameraVideo"),
  uploadInput: document.getElementById("uploadInput"),
  captureInput: document.getElementById("captureInput"),
  adjustCanvas: document.getElementById("adjustCanvas"),
  guideCanvas: document.getElementById("guideCanvas"),
  zoomRange: document.getElementById("zoomRange"),
  offsetXRange: document.getElementById("offsetXRange"),
  offsetYRange: document.getElementById("offsetYRange"),
  retakeBtn: document.getElementById("retakeBtn"),
  usePhotoBtn: document.getElementById("usePhotoBtn"),
  candidateName: document.getElementById("candidateName"),
  photoDate: document.getElementById("photoDate"),
  applicationStartDate: document.getElementById("applicationStartDate"),
  captureDate: document.getElementById("captureDate"),
  recencyStatus: document.getElementById("recencyStatus"),
  qualityRange: document.getElementById("qualityRange"),
  qualityValue: document.getElementById("qualityValue"),
  complianceMode: document.getElementById("complianceMode"),
  confirmFrontal: document.getElementById("confirmFrontal"),
  confirmEyesOpen: document.getElementById("confirmEyesOpen"),
  confirmEarsVisible: document.getElementById("confirmEarsVisible"),
  confirmNaturalExpression: document.getElementById("confirmNaturalExpression"),
  confirmHairClear: document.getElementById("confirmHairClear"),
  confirmGlassesNoGlare: document.getElementById("confirmGlassesNoGlare"),
  flagUniformHeadwear: document.getElementById("flagUniformHeadwear"),
  flagSignedPhoto: document.getElementById("flagSignedPhoto"),
  runChecksBtn: document.getElementById("runChecksBtn"),
  warningsList: document.getElementById("warningsList"),
  checklist: document.getElementById("checklist"),
  generateBtn: document.getElementById("generateBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  finalPreview: document.getElementById("finalPreview"),
  detailSize: document.getElementById("detailSize"),
  detailDimensions: document.getElementById("detailDimensions"),
  detailFormat: document.getElementById("detailFormat"),
  detailCompliance: document.getElementById("detailCompliance"),

  signatureStatusBanner: document.getElementById("signatureStatusBanner"),
  sigSourceMeta: document.getElementById("sigSourceMeta"),
  sigStep2: document.getElementById("sigStep2"),
  sigStep3: document.getElementById("sigStep3"),
  sigStartCameraBtn: document.getElementById("sigStartCameraBtn"),
  sigCaptureBtn: document.getElementById("sigCaptureBtn"),
  sigStopCameraBtn: document.getElementById("sigStopCameraBtn"),
  sigCameraPane: document.getElementById("sigCameraPane"),
  sigCameraVideo: document.getElementById("sigCameraVideo"),
  sigUploadInput: document.getElementById("sigUploadInput"),
  sigCaptureInput: document.getElementById("sigCaptureInput"),
  sigAdjustCanvas: document.getElementById("sigAdjustCanvas"),
  sigGuideCanvas: document.getElementById("sigGuideCanvas"),
  sigZoomRange: document.getElementById("sigZoomRange"),
  sigOffsetXRange: document.getElementById("sigOffsetXRange"),
  sigOffsetYRange: document.getElementById("sigOffsetYRange"),
  sigRotateBtn: document.getElementById("sigRotateBtn"),
  sigCropBtn: document.getElementById("sigCropBtn"),
  sigRetakeBtn: document.getElementById("sigRetakeBtn"),
  sigQualityRange: document.getElementById("sigQualityRange"),
  sigQualityValue: document.getElementById("sigQualityValue"),
  sigRunChecksBtn: document.getElementById("sigRunChecksBtn"),
  sigGenerateBtn: document.getElementById("sigGenerateBtn"),
  sigDownloadBtn: document.getElementById("sigDownloadBtn"),
  sigWarningsList: document.getElementById("sigWarningsList"),
  sigChecklist: document.getElementById("sigChecklist"),
  sigFinalPreview: document.getElementById("sigFinalPreview"),
  sigDetailSize: document.getElementById("sigDetailSize"),
  sigDetailDimensions: document.getElementById("sigDetailDimensions"),
  sigDetailFormat: document.getElementById("sigDetailFormat"),
  sigDetailTriplet: document.getElementById("sigDetailTriplet"),
  sigDetailCompliance: document.getElementById("sigDetailCompliance")
};

const photoWidth = UPSC_CONFIG.output.width;
const photoHeight = UPSC_CONFIG.output.height;
const photoMinBytes = UPSC_CONFIG.fileSizeKB.min * 1024;
const photoMaxBytes = UPSC_CONFIG.fileSizeKB.max * 1024;

const sigWidth = SIGNATURE_CONFIG.output.width;
const sigHeight = SIGNATURE_CONFIG.output.height;
const sigMinBytes = SIGNATURE_CONFIG.fileSizeKB.min * 1024;
const sigMaxBytes = SIGNATURE_CONFIG.fileSizeKB.max * 1024;

elements.adjustCanvas.width = photoWidth;
elements.adjustCanvas.height = photoHeight;
elements.guideCanvas.width = photoWidth;
elements.guideCanvas.height = photoHeight;

elements.sigAdjustCanvas.width = sigWidth;
elements.sigAdjustCanvas.height = sigHeight;
elements.sigGuideCanvas.width = sigWidth;
elements.sigGuideCanvas.height = sigHeight;

const photoContext = elements.adjustCanvas.getContext("2d");
const photoGuideContext = elements.guideCanvas.getContext("2d");
const signatureContext = elements.sigAdjustCanvas.getContext("2d");
const signatureGuideContext = elements.sigGuideCanvas.getContext("2d");

const state = {
  activeMode: "photo",
  photo: {
    stream: null,
    sourceBitmap: null,
    baseScale: 1,
    transform: {
      zoom: 1,
      offsetX: 0,
      offsetY: 0
    },
    accepted: false,
    checks: {},
    warnings: [],
    finalBlob: null,
    finalUrl: null
  },
  signature: {
    stream: null,
    sourceBitmap: null,
    baseScale: 1,
    transform: {
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      rotation: 0
    },
    cropped: false,
    checks: {},
    warnings: [],
    hardFails: [],
    finalBlob: null,
    finalUrl: null
  }
};

function setBanner(element, message, tone = "info") {
  element.className = `status ${tone}`;
  element.textContent = message;
}

function setPhotoStatus(message, tone = "info") {
  setBanner(elements.statusBanner, message, tone);
}

function setSignatureStatus(message, tone = "info") {
  setBanner(elements.signatureStatusBanner, message, tone);
}

function setSectionEnabled(sectionElement, enabled) {
  sectionElement.classList.toggle("disabled", !enabled);
  sectionElement.querySelectorAll("input, button").forEach((control) => {
    control.disabled = !enabled;
  });
}

function closeBitmap(bitmap) {
  if (bitmap && typeof bitmap.close === "function") {
    bitmap.close();
  }
}

function stopMediaStream(stream) {
  if (!stream) {
    return;
  }
  stream.getTracks().forEach((track) => track.stop());
}

function setRecencyPill(text, tone) {
  elements.recencyStatus.className = `pill ${tone}`;
  elements.recencyStatus.textContent = text;
}

function releasePhotoFinalUrl() {
  if (state.photo.finalUrl) {
    URL.revokeObjectURL(state.photo.finalUrl);
    state.photo.finalUrl = null;
  }
}

function releaseSignatureFinalUrl() {
  if (state.signature.finalUrl) {
    URL.revokeObjectURL(state.signature.finalUrl);
    state.signature.finalUrl = null;
  }
}

function renderTextWarnings(target, warnings, passText) {
  target.innerHTML = "";
  if (!warnings.length) {
    const li = document.createElement("li");
    li.className = "pass";
    li.textContent = passText;
    target.appendChild(li);
    return;
  }
  warnings.forEach((text) => {
    const li = document.createElement("li");
    li.className = "warn";
    li.textContent = text;
    target.appendChild(li);
  });
}

function renderSignatureWarnings(warnings, hardFails) {
  elements.sigWarningsList.innerHTML = "";
  if (!warnings.length && !hardFails.length) {
    const li = document.createElement("li");
    li.className = "pass";
    li.textContent = "No signature validation warnings were detected.";
    elements.sigWarningsList.appendChild(li);
    return;
  }

  hardFails.forEach((text) => {
    const li = document.createElement("li");
    li.className = "fail";
    li.textContent = `Hard fail: ${text}`;
    elements.sigWarningsList.appendChild(li);
  });
  warnings.forEach((text) => {
    const li = document.createElement("li");
    li.className = "warn";
    li.textContent = `Warning: ${text}`;
    elements.sigWarningsList.appendChild(li);
  });
}

function renderChecklist(target, labels, checks, complianceElement) {
  target.innerHTML = "";
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  Object.entries(labels).forEach(([key, label]) => {
    const status = checks[key]?.status ?? "warn";
    if (status === "pass") {
      passCount += 1;
    } else if (status === "fail") {
      failCount += 1;
    } else {
      warnCount += 1;
    }

    const li = document.createElement("li");
    li.className = status;
    const badge = document.createElement("strong");
    badge.textContent = status.toUpperCase();
    li.append(label, badge);
    target.appendChild(li);
  });

  if (failCount > 0) {
    complianceElement.textContent = `${passCount} PASS / ${warnCount} WARN / ${failCount} FAIL`;
    return;
  }
  complianceElement.textContent = warnCount === 0 ? "PASS" : `${passCount} PASS / ${warnCount} WARN`;
}

function drawPhotoGuide() {
  const width = photoWidth;
  const height = photoHeight;
  const boxWidth = width * UPSC_CONFIG.guide.widthRatio;
  const boxHeight = height * UPSC_CONFIG.guide.heightRatio;
  const x = (width - boxWidth) / 2;
  const y = (height - boxHeight) / 2;
  const radius = Math.min(boxWidth, boxHeight) * UPSC_CONFIG.guide.borderRadiusRatio;
  const earTickHeight = boxHeight * 0.18;

  photoGuideContext.clearRect(0, 0, width, height);
  photoGuideContext.fillStyle = "rgba(6, 24, 30, 0.28)";
  photoGuideContext.fillRect(0, 0, width, height);

  photoGuideContext.globalCompositeOperation = "destination-out";
  drawRoundedRectPath(photoGuideContext, x, y, boxWidth, boxHeight, radius);
  photoGuideContext.fill();
  photoGuideContext.globalCompositeOperation = "source-over";

  photoGuideContext.lineWidth = 3;
  photoGuideContext.strokeStyle = "#00b391";
  drawRoundedRectPath(photoGuideContext, x, y, boxWidth, boxHeight, radius);
  photoGuideContext.stroke();

  photoGuideContext.lineWidth = 2;
  photoGuideContext.strokeStyle = "#00b391";
  photoGuideContext.beginPath();
  photoGuideContext.moveTo(x, height / 2 - earTickHeight / 2);
  photoGuideContext.lineTo(x - 20, height / 2 - earTickHeight / 2);
  photoGuideContext.moveTo(x, height / 2 + earTickHeight / 2);
  photoGuideContext.lineTo(x - 20, height / 2 + earTickHeight / 2);
  photoGuideContext.moveTo(x + boxWidth, height / 2 - earTickHeight / 2);
  photoGuideContext.lineTo(x + boxWidth + 20, height / 2 - earTickHeight / 2);
  photoGuideContext.moveTo(x + boxWidth, height / 2 + earTickHeight / 2);
  photoGuideContext.lineTo(x + boxWidth + 20, height / 2 + earTickHeight / 2);
  photoGuideContext.stroke();
}

function drawSignatureGuide() {
  const width = sigWidth;
  const height = sigHeight;
  const boxWidth = width * SIGNATURE_CONFIG.guide.widthRatio;
  const boxHeight = height * SIGNATURE_CONFIG.guide.heightRatio;
  const x = (width - boxWidth) / 2;
  const y = (height - boxHeight) / 2;
  const radius = Math.min(boxWidth, boxHeight) * SIGNATURE_CONFIG.guide.borderRadiusRatio;
  const gap = boxHeight * SIGNATURE_CONFIG.guide.slotGapRatio;
  const slotHeight = (boxHeight - gap * 2) / 3;

  signatureGuideContext.clearRect(0, 0, width, height);
  signatureGuideContext.fillStyle = "rgba(8, 16, 28, 0.22)";
  signatureGuideContext.fillRect(0, 0, width, height);

  signatureGuideContext.globalCompositeOperation = "destination-out";
  drawRoundedRectPath(signatureGuideContext, x, y, boxWidth, boxHeight, radius);
  signatureGuideContext.fill();
  signatureGuideContext.globalCompositeOperation = "source-over";

  signatureGuideContext.strokeStyle = "#2f9dff";
  signatureGuideContext.lineWidth = 3;
  drawRoundedRectPath(signatureGuideContext, x, y, boxWidth, boxHeight, radius);
  signatureGuideContext.stroke();

  signatureGuideContext.lineWidth = 2;
  signatureGuideContext.setLineDash([8, 7]);
  for (let i = 0; i < 3; i += 1) {
    const slotY = y + i * (slotHeight + gap);
    signatureGuideContext.strokeRect(x + 8, slotY + 6, boxWidth - 16, slotHeight - 12);
  }
  signatureGuideContext.beginPath();
  signatureGuideContext.moveTo(width / 2, y + 8);
  signatureGuideContext.lineTo(width / 2, y + boxHeight - 8);
  signatureGuideContext.stroke();
  signatureGuideContext.setLineDash([]);
}

function resetPhotoFinalState() {
  state.photo.finalBlob = null;
  releasePhotoFinalUrl();
  elements.finalPreview.removeAttribute("src");
  elements.downloadBtn.disabled = true;
  elements.detailSize.textContent = "-";
  elements.detailDimensions.textContent = `${photoWidth} x ${photoHeight}`;
  elements.detailFormat.textContent = "JPG/JPEG";
  elements.detailCompliance.textContent = "Pending";
}

function resetSignatureFinalState() {
  state.signature.finalBlob = null;
  releaseSignatureFinalUrl();
  elements.sigFinalPreview.removeAttribute("src");
  elements.sigDownloadBtn.disabled = true;
  elements.sigDetailSize.textContent = "-";
  elements.sigDetailDimensions.textContent = `${sigWidth} x ${sigHeight}`;
  elements.sigDetailFormat.textContent = "JPG/JPEG";
  elements.sigDetailTriplet.textContent = "Pending";
  elements.sigDetailCompliance.textContent = "Pending";
}

async function compressCanvasToRange(canvas, mimeType, preferredQuality, minBytes, maxBytes, maxKbLabel) {
  let low = 0.05;
  let high = clamp(preferredQuality, 0.4, 1);
  let bestUnder = null;

  for (let iteration = 0; iteration < 14; iteration += 1) {
    const quality = (low + high) / 2;
    const blob = await canvasToBlob(canvas, mimeType, quality);
    if (!blob) {
      throw new Error("Compression failure: unable to convert canvas to JPEG.");
    }
    if (blob.size > maxBytes) {
      high = quality - 0.01;
      continue;
    }
    bestUnder = blob;
    low = quality + 0.01;
  }

  let output = bestUnder;
  if (!output) {
    output = await canvasToBlob(canvas, mimeType, 0.05);
    if (!output) {
      throw new Error("Compression failure: no JPEG output generated.");
    }
  }

  let warning = "";
  if (output.size < minBytes) {
    const maxQualityBlob = await canvasToBlob(canvas, mimeType, 1);
    if (!maxQualityBlob) {
      throw new Error("Compression failure while increasing quality.");
    }
    if (maxQualityBlob.size >= minBytes && maxQualityBlob.size <= maxBytes) {
      output = maxQualityBlob;
    } else if (maxQualityBlob.size < minBytes) {
      output = maxQualityBlob;
      warning = `File is below ${minBytes / 1024}KB even at max quality.`;
    } else {
      warning = "File is below minimum size with current settings. Adjust crop and retry.";
    }
  }

  if (output.size > maxBytes) {
    warning = warning || `Could not reduce below ${maxKbLabel}KB. Retake with cleaner framing.`;
  }

  return { blob: output, warning };
}
function getPhotoManualChecks() {
  return {
    frontal: elements.confirmFrontal.checked,
    eyesOpen: elements.confirmEyesOpen.checked,
    earsVisible: elements.confirmEarsVisible.checked,
    naturalExpression: elements.confirmNaturalExpression.checked,
    hairClear: elements.confirmHairClear.checked,
    glassesNoGlare: elements.confirmGlassesNoGlare.checked,
    flagUniformHeadwear: elements.flagUniformHeadwear.checked,
    flagSignedPhoto: elements.flagSignedPhoto.checked
  };
}

function renderAdjustedPhoto() {
  if (!state.photo.sourceBitmap) {
    return;
  }
  const scale = state.photo.baseScale * state.photo.transform.zoom;
  const drawWidth = state.photo.sourceBitmap.width * scale;
  const drawHeight = state.photo.sourceBitmap.height * scale;
  const x = (photoWidth - drawWidth) / 2 + state.photo.transform.offsetX;
  const y = (photoHeight - drawHeight) / 2 + state.photo.transform.offsetY;

  photoContext.clearRect(0, 0, photoWidth, photoHeight);
  photoContext.fillStyle = "#ffffff";
  photoContext.fillRect(0, 0, photoWidth, photoHeight);
  photoContext.drawImage(state.photo.sourceBitmap, x, y, drawWidth, drawHeight);
}

function handlePhotoTransformChange() {
  state.photo.transform.zoom = Number(elements.zoomRange.value) / 100;
  state.photo.transform.offsetX = Number(elements.offsetXRange.value);
  state.photo.transform.offsetY = Number(elements.offsetYRange.value);
  renderAdjustedPhoto();
  resetPhotoFinalState();
}

function evaluateRecency() {
  const start = parseDate(elements.applicationStartDate.value);
  const capture = parseDate(elements.captureDate.value || elements.photoDate.value);

  if (!start || !capture) {
    setRecencyPill("Provide capture date and application start date.", "neutral");
    return makeStatus("warn", "Recency could not be calculated.");
  }

  const daysOld = dateDiffInDays(start, capture);
  if (daysOld <= UPSC_CONFIG.recencyDays) {
    const text =
      daysOld < 0
        ? "Within 10 days: capture date is after application start date."
        : `Within 10 days: photo is ${daysOld} day(s) older than application start date.`;
    setRecencyPill(text, "pass");
    return makeStatus("pass", text);
  }

  const text = `Not within 10 days: photo is ${daysOld} day(s) older than application start date.`;
  setRecencyPill(text, "warn");
  return makeStatus("warn", text);
}

function annotatePhotoCanvas(name, dateText) {
  const canvas = document.createElement("canvas");
  canvas.width = photoWidth;
  canvas.height = photoHeight;
  const context = canvas.getContext("2d");
  context.drawImage(elements.adjustCanvas, 0, 0);

  const barHeight = UPSC_CONFIG.text.barHeightPx;
  context.fillStyle = UPSC_CONFIG.text.barColor;
  context.fillRect(0, photoHeight - barHeight, photoWidth, barHeight);

  const text = `${name} | ${dateText}`;
  let fontSize = UPSC_CONFIG.text.fontSizePx;
  context.textAlign = "center";
  context.textBaseline = "middle";

  while (fontSize >= UPSC_CONFIG.text.minFontPx) {
    context.font = `${UPSC_CONFIG.text.fontWeight} ${fontSize}px ${UPSC_CONFIG.text.fontFamily}`;
    if (context.measureText(text).width <= photoWidth - 24) {
      break;
    }
    fontSize -= 1;
  }

  context.fillStyle = UPSC_CONFIG.text.color;
  context.fillText(text, photoWidth / 2, photoHeight - barHeight / 2);
  return canvas;
}

function deriveFaceChecks(faceResult) {
  if (!faceResult.available) {
    return {
      faceCoverage: makeStatus("warn", "Face detection unavailable. Use guide and manual checks."),
      headCentered: makeStatus("warn", "Centering check unavailable without face detection."),
      frontalAuto: makeStatus("warn", "Frontal auto-check unavailable."),
      eyesAuto: makeStatus("warn", "Eye detection unavailable.")
    };
  }
  if (!faceResult.detected || !faceResult.box) {
    return {
      faceCoverage: makeStatus("warn", "Face not detected. Ensure full frontal face and better light."),
      headCentered: makeStatus("warn", "Head centering could not be verified."),
      frontalAuto: makeStatus("warn", "Frontal alignment could not be verified."),
      eyesAuto: makeStatus("warn", "Eye visibility could not be verified.")
    };
  }

  const box = faceResult.box;
  const areaRatio = (box.width * box.height) / (photoWidth * photoHeight);
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const diffX = Math.abs(centerX - photoWidth / 2) / photoWidth;
  const diffY = Math.abs(centerY - photoHeight / 2) / photoHeight;

  const coverageOk = areaRatio >= UPSC_CONFIG.face.minCoverageRatio && areaRatio <= UPSC_CONFIG.face.maxCoverageRatio;
  const centeredOk = diffX <= UPSC_CONFIG.face.centerToleranceRatio && diffY <= UPSC_CONFIG.face.centerToleranceRatio;

  let frontalAuto = makeStatus("warn", "Auto frontal check not available.");
  let eyesAuto = makeStatus("warn", "Auto eye check not available.");

  if (faceResult.leftEye && faceResult.rightEye) {
    const tilt = Math.abs(faceResult.leftEye.y - faceResult.rightEye.y);
    frontalAuto =
      tilt <= UPSC_CONFIG.face.tiltTolerancePx
        ? makeStatus("pass", "Face appears straight.")
        : makeStatus("warn", "Face appears tilted.");
    eyesAuto = makeStatus("pass", "Eyes landmarks detected.");
  } else {
    frontalAuto = makeStatus("warn", "Eye landmarks unavailable for tilt check.");
    eyesAuto = makeStatus("warn", "Eyes not clearly detected.");
  }

  return {
    faceCoverage: coverageOk
      ? makeStatus("pass", "Face area appears within UPSC range.")
      : makeStatus("warn", "Face appears too small or too close."),
    headCentered: centeredOk
      ? makeStatus("pass", "Head appears centered.")
      : makeStatus("warn", "Head appears off-center."),
    frontalAuto,
    eyesAuto,
    faceBox: box
  };
}

async function evaluatePhotoChecks(includeOutputChecks = false) {
  const manual = getPhotoManualChecks();
  const recency = evaluateRecency();
  const faceResult = await detectFace(elements.adjustCanvas);
  const faceChecks = deriveFaceChecks(faceResult);

  const background = analyzeBackground(photoContext, photoWidth, photoHeight, UPSC_CONFIG.background);
  const blur = analyzeBlur(photoContext, photoWidth, photoHeight, UPSC_CONFIG.blur);
  const shadows = analyzeShadows(photoContext, photoWidth, photoHeight, UPSC_CONFIG.shadow);
  const glare = analyzeGlare(photoContext, photoWidth, photoHeight, faceChecks.faceBox, UPSC_CONFIG.glare);

  const checks = {
    faceCoverage: faceChecks.faceCoverage,
    headCentered: faceChecks.headCentered,
    frontal:
      faceChecks.frontalAuto.status === "pass" && manual.frontal
        ? makeStatus("pass", "Frontal alignment confirmed.")
        : makeStatus("warn", "Confirm full frontal view."),
    eyesOpen:
      faceChecks.eyesAuto.status === "pass" && manual.eyesOpen
        ? makeStatus("pass", "Eyes appear open and visible.")
        : makeStatus("warn", "Eyes open/visible confirmation is required."),
    earsVisible: manual.earsVisible
      ? makeStatus("pass", "Both ears manually confirmed visible.")
      : makeStatus("warn", "Confirm both ears are clearly visible."),
    plainWhiteBackground: background.status,
    noShadows: shadows.status,
    sharpness: blur.status,
    naturalExpression: manual.naturalExpression
      ? makeStatus("pass", "Natural expression manually confirmed.")
      : makeStatus("warn", "Confirm natural expression."),
    hairClear: manual.hairClear
      ? makeStatus("pass", "Hair clearance manually confirmed.")
      : makeStatus("warn", "Confirm hair is not covering eyes."),
    noGlare: manual.glassesNoGlare
      ? makeStatus("pass", "No glare manually confirmed.")
      : glare.status,
    noRestrictedItems:
      !manual.flagUniformHeadwear && !manual.flagSignedPhoto
        ? makeStatus("pass", "No restricted items flagged.")
        : makeStatus("warn", "Restricted item flags are active."),
    nameDatePrinted:
      elements.candidateName.value.trim() && elements.photoDate.value
        ? makeStatus("pass", "Name and date fields are ready.")
        : makeStatus("warn", "Candidate Name and Date are required."),
    recency,
    fileFormat: includeOutputChecks
      ? makeStatus("pass", "Output format is JPG/JPEG.")
      : makeStatus("warn", "Generate output to verify format."),
    fileSize:
      includeOutputChecks && state.photo.finalBlob
        ? state.photo.finalBlob.size >= photoMinBytes && state.photo.finalBlob.size <= photoMaxBytes
          ? makeStatus("pass", "File size is within 20KB to 200KB.")
          : makeStatus("warn", "File size is outside 20KB to 200KB.")
        : makeStatus("warn", "Generate output to verify file size.")
  };

  const warnings = [];
  if (checks.faceCoverage.status === "warn") {
    warnings.push("Face too small or too close.");
  }
  if (checks.plainWhiteBackground.status === "warn") {
    warnings.push("Dark/colored/patterned background detected.");
  }
  if (manual.flagUniformHeadwear) {
    warnings.push("Uniform/sunglasses/headwear flagged.");
  }
  if (manual.flagSignedPhoto) {
    warnings.push("Signed photo flagged.");
  }
  if (checks.sharpness.status === "warn") {
    warnings.push("Blurry photo detected.");
  }
  if (checks.noShadows.status === "warn") {
    warnings.push("Shadows detected on face/background.");
  }

  state.photo.checks = checks;
  state.photo.warnings = Array.from(new Set(warnings));
  renderTextWarnings(elements.warningsList, state.photo.warnings, "No do-not-upload warnings were detected.");
  renderChecklist(elements.checklist, CHECKLIST_LABELS, checks, elements.detailCompliance);
  return checks;
}

function resetPhotoForNewSource() {
  state.photo.accepted = false;
  state.photo.checks = {};
  state.photo.warnings = [];
  elements.checklist.innerHTML = "";
  elements.warningsList.innerHTML = "";
  setSectionEnabled(elements.step3, false);
  setSectionEnabled(elements.step4, false);
  resetPhotoFinalState();
}

async function loadPhotoSourceFromBlob(blob, label) {
  if (!blob || !blob.type.startsWith("image/")) {
    throw new Error("Invalid file: please select a valid image.");
  }
  const maxBytesInput = UPSC_CONFIG.limits.maxInputMB * 1024 * 1024;
  if (blob.size > maxBytesInput) {
    throw new Error(`Invalid file: image is larger than ${UPSC_CONFIG.limits.maxInputMB}MB.`);
  }

  const bitmap = await loadBitmapFromBlob(blob).catch(() => null);
  if (!bitmap?.width || !bitmap?.height) {
    throw new Error("Invalid file: unable to decode image.");
  }

  closeBitmap(state.photo.sourceBitmap);
  state.photo.sourceBitmap = bitmap;
  state.photo.baseScale = Math.max(photoWidth / bitmap.width, photoHeight / bitmap.height);
  state.photo.transform = { zoom: 1, offsetX: 0, offsetY: 0 };

  elements.zoomRange.value = "100";
  elements.offsetXRange.value = "0";
  elements.offsetYRange.value = "0";

  renderAdjustedPhoto();
  drawPhotoGuide();
  setSectionEnabled(elements.step2, true);
  resetPhotoForNewSource();
  elements.sourceMeta.textContent = `Source: ${label} (${bitmap.width} x ${bitmap.height})`;
  setPhotoStatus("Photo loaded. Step 2: adjust framing, then choose Use this photo.", "success");
}

async function startPhotoCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setPhotoStatus(
      "Camera API is not supported in this browser. Use 'Take Photo (Phone)' or open this app over HTTPS.",
      "error"
    );
    return;
  }

  if (!window.isSecureContext) {
    setPhotoStatus(
      "Live camera preview is blocked on non-HTTPS network URLs. Use 'Take Photo (Phone)' fallback or open this app over HTTPS.",
      "warn"
    );
    return;
  }
  try {
    stopPhotoCamera();
    state.photo.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    elements.cameraVideo.srcObject = state.photo.stream;
    elements.cameraPane.hidden = false;
    setPhotoStatus("Camera active. Align your face and tap Capture Photo.", "info");
  } catch {
    setPhotoStatus("Camera permission denied or unavailable.", "error");
  }
}

function stopPhotoCamera() {
  stopMediaStream(state.photo.stream);
  state.photo.stream = null;
  elements.cameraVideo.srcObject = null;
  elements.cameraPane.hidden = true;
}

async function capturePhotoFromCamera() {
  const video = elements.cameraVideo;
  if (!video.videoWidth || !video.videoHeight) {
    setPhotoStatus("Capture failed: camera stream not ready.", "error");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.95);
  if (!blob) {
    setPhotoStatus("Capture failed: unable to create image.", "error");
    return;
  }

  try {
    await loadPhotoSourceFromBlob(blob, "Camera capture");
    stopPhotoCamera();
  } catch (error) {
    setPhotoStatus(error instanceof Error ? error.message : "Capture failed.", "error");
  }
}
function renderAdjustedSignature() {
  if (!state.signature.sourceBitmap) {
    return;
  }
  const scale = state.signature.baseScale * state.signature.transform.zoom;
  const drawWidth = state.signature.sourceBitmap.width * scale;
  const drawHeight = state.signature.sourceBitmap.height * scale;
  const rotation = (state.signature.transform.rotation * Math.PI) / 180;

  signatureContext.clearRect(0, 0, sigWidth, sigHeight);
  signatureContext.fillStyle = "#ffffff";
  signatureContext.fillRect(0, 0, sigWidth, sigHeight);
  signatureContext.save();
  signatureContext.translate(
    sigWidth / 2 + state.signature.transform.offsetX,
    sigHeight / 2 + state.signature.transform.offsetY
  );
  signatureContext.rotate(rotation);
  signatureContext.drawImage(
    state.signature.sourceBitmap,
    -drawWidth / 2,
    -drawHeight / 2,
    drawWidth,
    drawHeight
  );
  signatureContext.restore();
}

function handleSignatureTransformChange() {
  state.signature.transform.zoom = Number(elements.sigZoomRange.value) / 100;
  state.signature.transform.offsetX = Number(elements.sigOffsetXRange.value);
  state.signature.transform.offsetY = Number(elements.sigOffsetYRange.value);
  renderAdjustedSignature();
  resetSignatureFinalState();
}

function rotateSignature() {
  state.signature.transform.rotation = (state.signature.transform.rotation + 90) % 360;
  renderAdjustedSignature();
  resetSignatureFinalState();
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

function smoothArray(values, radius = 2) {
  const output = new Array(values.length).fill(0);
  for (let i = 0; i < values.length; i += 1) {
    let sum = 0;
    let count = 0;
    for (let j = i - radius; j <= i + radius; j += 1) {
      if (j >= 0 && j < values.length) {
        sum += values[j];
        count += 1;
      }
    }
    output[i] = count ? sum / count : values[i];
  }
  return output;
}

function detectBands(values, minCount, minSpan, maxGap) {
  const bands = [];
  let start = -1;
  let lastActive = -1;
  let peak = 0;

  for (let i = 0; i < values.length; i += 1) {
    const active = values[i] >= minCount;
    if (active) {
      if (start < 0) {
        start = i;
      }
      lastActive = i;
      peak = Math.max(peak, values[i]);
      continue;
    }

    if (start >= 0 && i - lastActive > maxGap) {
      const end = lastActive;
      const span = end - start + 1;
      if (span >= minSpan) {
        bands.push({ start, end, span, peak });
      }
      start = -1;
      lastActive = -1;
      peak = 0;
    }
  }

  if (start >= 0) {
    const end = lastActive >= 0 ? lastActive : values.length - 1;
    const span = end - start + 1;
    if (span >= minSpan) {
      bands.push({ start, end, span, peak });
    }
  }

  return bands;
}

function bandCenterX(imageData, width, band, thresholdLum, maxSat) {
  const data = imageData.data;
  let sumX = 0;
  let count = 0;
  for (let y = band.start; y <= band.end; y += 1) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const index = rowOffset + x * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      if (luminance(r, g, b) < thresholdLum && saturation(r, g, b) <= maxSat) {
        sumX += x;
        count += 1;
      }
    }
  }
  return count ? sumX / count : width / 2;
}

function analyzeSignatureStructure(context, width, height, config) {
  const imageData = context.getImageData(0, 0, width, height);
  const { data } = imageData;
  const thresholdLum = config.detect.inkLuminanceThreshold;
  const maxSat = config.detect.maxInkSaturation;

  const rowInk = new Array(height).fill(0);
  const colInk = new Array(width).fill(0);
  let totalLum = 0;
  let inkLum = 0;
  let inkPixels = 0;

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      const index = rowOffset + x * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const lum = luminance(r, g, b);
      const sat = saturation(r, g, b);
      totalLum += lum;

      if (lum < thresholdLum && sat <= maxSat) {
        inkPixels += 1;
        inkLum += lum;
        rowInk[y] += 1;
        colInk[x] += 1;
      }
    }
  }

  const avgLum = totalLum / (width * height);
  const avgInkLum = inkPixels ? inkLum / inkPixels : avgLum;
  const contrast = avgLum - avgInkLum;
  const inkRatio = inkPixels / (width * height);

  const smoothedRows = smoothArray(rowInk, 2);
  const smoothedCols = smoothArray(colInk, 2);
  const minRowCount = Math.max(2, Math.floor(width * config.detect.minRowInkRatio));
  const minColCount = Math.max(2, Math.floor(height * config.detect.minColInkRatio));
  const minBandHeight = Math.max(6, Math.floor(height * config.detect.minBandHeightRatio));
  const minBandWidth = Math.max(6, Math.floor(width * config.detect.minBandHeightRatio));

  const rowBands = detectBands(smoothedRows, minRowCount, minBandHeight, config.detect.maxBandGapPx);
  const colBands = detectBands(smoothedCols, minColCount, minBandWidth, config.detect.maxBandGapPx);

  const rowGaps = [];
  for (let i = 0; i < rowBands.length - 1; i += 1) {
    rowGaps.push(rowBands[i + 1].start - rowBands[i].end - 1);
  }
  const minGap = rowGaps.length ? Math.min(...rowGaps) : 0;
  const minGapRequired = Math.floor(height * config.detect.minGapRatio);
  const spacingOk = rowBands.length === 3 ? rowGaps.every((value) => value >= minGapRequired) : false;

  const centers = rowBands.map((band) => bandCenterX(imageData, width, band, thresholdLum, maxSat));
  const meanCenter = centers.length ? centers.reduce((sum, value) => sum + value, 0) / centers.length : width / 2;
  const maxCenterDeviation = centers.length
    ? Math.max(...centers.map((value) => Math.abs(value - meanCenter)))
    : 0;
  const alignmentOk = rowBands.length === 3
    ? maxCenterDeviation <= width * config.detect.maxAlignmentDeviationRatio
    : false;

  const rotatedLikely = colBands.length >= 3 && rowBands.length <= 2;

  return {
    signatureCount: rowBands.length,
    rowBands,
    colBands,
    minGap,
    minGapRequired,
    spacingOk,
    alignmentOk,
    maxCenterDeviation,
    rotatedLikely,
    contrast,
    inkRatio
  };
}

async function evaluateSignatureChecks(includeOutputChecks = false) {
  const background = analyzeBackground(signatureContext, sigWidth, sigHeight, SIGNATURE_CONFIG.background);
  const shadows = analyzeShadows(signatureContext, sigWidth, sigHeight, SIGNATURE_CONFIG.shadow);
  const blur = analyzeBlur(signatureContext, sigWidth, sigHeight, SIGNATURE_CONFIG.blur);
  const structure = analyzeSignatureStructure(signatureContext, sigWidth, sigHeight, SIGNATURE_CONFIG);

  const outputBlob = state.signature.finalBlob;
  const widthInRange =
    sigWidth >= SIGNATURE_CONFIG.dimensionPx.min && sigWidth <= SIGNATURE_CONFIG.dimensionPx.max;
  const heightInRange =
    sigHeight >= SIGNATURE_CONFIG.dimensionPx.min && sigHeight <= SIGNATURE_CONFIG.dimensionPx.max;

  const checks = {
    fileFormat: includeOutputChecks
      ? outputBlob && outputBlob.type.includes("jpeg")
        ? makeStatus("pass", "JPG format generated.")
        : makeStatus("fail", "Output is not JPG/JPEG.")
      : makeStatus("warn", "Generate output to verify format."),
    fileSize: includeOutputChecks
      ? outputBlob && outputBlob.size >= sigMinBytes && outputBlob.size <= sigMaxBytes
        ? makeStatus("pass", "File size is within 20KB to 100KB.")
        : makeStatus("fail", "File size is outside 20KB to 100KB.")
      : makeStatus("warn", "Generate output to verify file size."),
    dimensions: includeOutputChecks
      ? widthInRange && heightInRange
        ? makeStatus("pass", "Dimensions are within 350px to 500px.")
        : makeStatus("fail", "Dimensions are outside 350px to 500px.")
      : makeStatus("warn", "Generate output to verify dimensions."),
    threeSignatures:
      structure.signatureCount === 3
        ? makeStatus("pass", "Exactly 3 signature bands detected.")
        : makeStatus("fail", `Detected ${structure.signatureCount} signature band(s).`),
    sharpness:
      blur.status.status === "pass"
        ? makeStatus("pass", "Image sharpness looks acceptable.")
        : makeStatus("fail", "Image appears blurry or unreadable."),
    plainWhiteBackground:
      background.status.status === "pass"
        ? makeStatus("pass", "Background appears plain white.")
        : makeStatus("warn", "Background may not be pure white."),
    noShadows:
      shadows.status.status === "pass"
        ? makeStatus("pass", "No major shadows detected.")
        : makeStatus("warn", "Shadow detected on paper."),
    contrast:
      structure.contrast >= SIGNATURE_CONFIG.detect.minContrast
        ? makeStatus("pass", "Ink contrast is acceptable.")
        : makeStatus("warn", "Low contrast or faint ink detected."),
    spacing:
      structure.spacingOk
        ? makeStatus("pass", "Spacing between signatures looks good.")
        : makeStatus("warn", "Signatures may be too close together."),
    alignment:
      structure.alignmentOk
        ? makeStatus("pass", "Signatures look vertically aligned.")
        : makeStatus("warn", "Signatures may not be vertically aligned."),
    orientation:
      structure.rotatedLikely
        ? makeStatus("warn", "Image may be tilted or rotated.")
        : makeStatus("pass", "Orientation appears acceptable.")
  };

  const hardFails = [];
  if (checks.fileFormat.status === "fail") {
    hardFails.push("Not JPG/JPEG output.");
  }
  if (checks.fileSize.status === "fail" && includeOutputChecks) {
    hardFails.push("File size not within 20KB to 100KB.");
  }
  if (checks.dimensions.status === "fail" && includeOutputChecks) {
    hardFails.push("Dimensions not within 350px to 500px.");
  }
  if (checks.threeSignatures.status === "fail") {
    hardFails.push("Less than 3 or more than 3 signatures detected.");
  }
  if (checks.sharpness.status === "fail") {
    hardFails.push("Signature image is blurry or unreadable.");
  }
  if (structure.inkRatio < SIGNATURE_CONFIG.detect.minInkRatioHard) {
    hardFails.push("Signature ink coverage is too low and unreadable.");
  }
  if (structure.contrast < SIGNATURE_CONFIG.detect.severeContrast) {
    hardFails.push("Signature contrast is too low for reliable readability.");
  }

  const warnings = [];
  if (checks.plainWhiteBackground.status === "warn") {
    warnings.push("Background is not pure white.");
  }
  if (checks.noShadows.status === "warn") {
    warnings.push("Shadows detected on paper.");
  }
  if (checks.contrast.status === "warn") {
    warnings.push("Low contrast or faint ink.");
  }
  if (checks.spacing.status === "warn") {
    warnings.push("Signatures are too close together.");
  }
  if (checks.alignment.status === "warn") {
    warnings.push("Signatures are not vertically aligned.");
  }
  if (checks.orientation.status === "warn") {
    warnings.push("Image appears tilted or rotated.");
  }

  state.signature.checks = checks;
  state.signature.warnings = Array.from(new Set(warnings));
  state.signature.hardFails = Array.from(new Set(hardFails));

  renderSignatureWarnings(state.signature.warnings, state.signature.hardFails);
  renderChecklist(
    elements.sigChecklist,
    SIGNATURE_CHECKLIST_LABELS,
    state.signature.checks,
    elements.sigDetailCompliance
  );
  elements.sigDetailTriplet.textContent = checks.threeSignatures.status.toUpperCase();

  return checks;
}

function resetSignatureForNewSource() {
  state.signature.cropped = false;
  state.signature.checks = {};
  state.signature.warnings = [];
  state.signature.hardFails = [];
  elements.sigChecklist.innerHTML = "";
  elements.sigWarningsList.innerHTML = "";
  setSectionEnabled(elements.sigStep3, false);
  resetSignatureFinalState();
}

async function loadSignatureSourceFromBlob(blob, label) {
  if (!blob || !blob.type.startsWith("image/")) {
    throw new Error("Invalid file: please select a valid signature image.");
  }
  const maxBytesInput = SIGNATURE_CONFIG.limits.maxInputMB * 1024 * 1024;
  if (blob.size > maxBytesInput) {
    throw new Error(`Invalid file: image is larger than ${SIGNATURE_CONFIG.limits.maxInputMB}MB.`);
  }

  const bitmap = await loadBitmapFromBlob(blob).catch(() => null);
  if (!bitmap?.width || !bitmap?.height) {
    throw new Error("Invalid file: unable to decode signature image.");
  }

  closeBitmap(state.signature.sourceBitmap);
  state.signature.sourceBitmap = bitmap;
  state.signature.baseScale = Math.max(sigWidth / bitmap.width, sigHeight / bitmap.height);
  state.signature.transform = { zoom: 1, offsetX: 0, offsetY: 0, rotation: 0 };

  elements.sigZoomRange.value = "100";
  elements.sigOffsetXRange.value = "0";
  elements.sigOffsetYRange.value = "0";

  renderAdjustedSignature();
  drawSignatureGuide();
  setSectionEnabled(elements.sigStep2, true);
  resetSignatureForNewSource();
  elements.sigSourceMeta.textContent = `Source: ${label} (${bitmap.width} x ${bitmap.height})`;
  setSignatureStatus("Signature image loaded. Step 2: crop/adjust, then tap Crop.", "success");
}

async function startSignatureCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setSignatureStatus(
      "Camera API is not supported in this browser. Use 'Take Signature (Phone)' or open this app over HTTPS.",
      "error"
    );
    return;
  }

  if (!window.isSecureContext) {
    setSignatureStatus(
      "Live camera preview is blocked on non-HTTPS network URLs. Use 'Take Signature (Phone)' fallback or open app over HTTPS.",
      "warn"
    );
    return;
  }
  try {
    stopSignatureCamera();
    state.signature.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    elements.sigCameraVideo.srcObject = state.signature.stream;
    elements.sigCameraPane.hidden = false;
    setSignatureStatus("Signature camera active. Capture the paper with all 3 signatures.", "info");
  } catch {
    setSignatureStatus("Camera permission denied or unavailable.", "error");
  }
}

function stopSignatureCamera() {
  stopMediaStream(state.signature.stream);
  state.signature.stream = null;
  elements.sigCameraVideo.srcObject = null;
  elements.sigCameraPane.hidden = true;
}

async function captureSignatureFromCamera() {
  const video = elements.sigCameraVideo;
  if (!video.videoWidth || !video.videoHeight) {
    setSignatureStatus("Capture failed: signature camera stream not ready.", "error");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.95);
  if (!blob) {
    setSignatureStatus("Capture failed: unable to create image.", "error");
    return;
  }

  try {
    await loadSignatureSourceFromBlob(blob, "Signature camera capture");
    stopSignatureCamera();
  } catch (error) {
    setSignatureStatus(error instanceof Error ? error.message : "Capture failed.", "error");
  }
}

function activateMode(mode) {
  state.activeMode = mode;
  elements.photoMode.hidden = mode !== "photo";
  elements.signatureMode.hidden = mode !== "signature";
  elements.modePhotoBtn.classList.toggle("active", mode === "photo");
  elements.modeSignatureBtn.classList.toggle("active", mode === "signature");

  if (mode === "photo") {
    stopSignatureCamera();
    setPhotoStatus("Photo mode active. Capture or upload your face photo.", "info");
  } else {
    stopPhotoCamera();
    setSignatureStatus("Signature mode active. Prepare exactly 3 signatures in one image.", "info");
  }
}
function registerPhotoEvents() {
  elements.startCameraBtn.addEventListener("click", startPhotoCamera);
  elements.stopCameraBtn.addEventListener("click", stopPhotoCamera);
  elements.captureBtn.addEventListener("click", capturePhotoFromCamera);

  elements.uploadInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      await loadPhotoSourceFromBlob(file, file.name);
    } catch (error) {
      setPhotoStatus(error instanceof Error ? error.message : "Invalid file.", "error");
    } finally {
      elements.uploadInput.value = "";
    }
  });

  elements.captureInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      await loadPhotoSourceFromBlob(file, "Phone camera capture");
    } catch (error) {
      setPhotoStatus(error instanceof Error ? error.message : "Invalid capture file.", "error");
    } finally {
      elements.captureInput.value = "";
    }
  });

  elements.zoomRange.addEventListener("input", handlePhotoTransformChange);
  elements.offsetXRange.addEventListener("input", handlePhotoTransformChange);
  elements.offsetYRange.addEventListener("input", handlePhotoTransformChange);

  elements.retakeBtn.addEventListener("click", () => {
    closeBitmap(state.photo.sourceBitmap);
    state.photo.sourceBitmap = null;
    resetPhotoForNewSource();
    setSectionEnabled(elements.step2, false);
    photoContext.clearRect(0, 0, photoWidth, photoHeight);
    elements.sourceMeta.textContent = "No source selected yet.";
    setPhotoStatus("Retake requested. Capture or upload a new photo.", "info");
  });

  elements.usePhotoBtn.addEventListener("click", async () => {
    if (!state.photo.sourceBitmap) {
      setPhotoStatus("Please capture or upload a photo first.", "error");
      return;
    }
    state.photo.accepted = true;
    setSectionEnabled(elements.step3, true);
    setSectionEnabled(elements.step4, true);
    elements.downloadBtn.disabled = true;
    await evaluatePhotoChecks(false);
    setPhotoStatus("Photo accepted. Complete Step 3 checks before export.", "success");
  });

  elements.runChecksBtn.addEventListener("click", async () => {
    if (!state.photo.accepted) {
      setPhotoStatus("Use this photo in Step 2 before running checks.", "warn");
      return;
    }
    await evaluatePhotoChecks(false);
    setPhotoStatus("Compliance checks updated. Review warnings before export.", "info");
  });

  elements.applicationStartDate.addEventListener("change", evaluateRecency);
  elements.captureDate.addEventListener("change", evaluateRecency);
  elements.photoDate.addEventListener("change", evaluateRecency);

  elements.qualityRange.addEventListener("input", () => {
    elements.qualityValue.textContent = `${elements.qualityRange.value}%`;
  });

  elements.generateBtn.addEventListener("click", async () => {
    if (!state.photo.accepted || !state.photo.sourceBitmap) {
      setPhotoStatus("Please finish Steps 1 and 2 first.", "error");
      return;
    }
    if (!elements.complianceMode.checked) {
      setPhotoStatus("Enable UPSC compliance mode confirmation before export.", "warn");
      return;
    }
    const candidateName = elements.candidateName.value.trim();
    const photoDate = elements.photoDate.value;
    if (!candidateName || !photoDate) {
      setPhotoStatus("Candidate Name and Date are required before export.", "warn");
      return;
    }

    try {
      const annotated = annotatePhotoCanvas(candidateName, photoDate);
      const preferredQuality = Number(elements.qualityRange.value) / 100;
      const { blob, warning } = await compressCanvasToRange(
        annotated,
        UPSC_CONFIG.output.mimeType,
        preferredQuality,
        photoMinBytes,
        photoMaxBytes,
        UPSC_CONFIG.fileSizeKB.max
      );

      state.photo.finalBlob = blob;
      releasePhotoFinalUrl();
      state.photo.finalUrl = URL.createObjectURL(blob);
      elements.finalPreview.src = state.photo.finalUrl;
      elements.downloadBtn.disabled = false;

      await evaluatePhotoChecks(true);
      elements.detailSize.textContent = formatKB(blob.size);
      elements.detailDimensions.textContent = `${photoWidth} x ${photoHeight}`;
      elements.detailFormat.textContent = "JPG/JPEG";

      if (warning) {
        setPhotoStatus(`Generated with warning: ${warning}`, "warn");
      } else {
        setPhotoStatus("Final JPG generated. Review details and download photo.jpg.", "success");
      }
    } catch (error) {
      setPhotoStatus(error instanceof Error ? error.message : "Export failure.", "error");
    }
  });

  elements.downloadBtn.addEventListener("click", () => {
    if (!state.photo.finalBlob || !state.photo.finalUrl) {
      setPhotoStatus("Export failure: final image is not ready.", "error");
      return;
    }
    try {
      const link = document.createElement("a");
      link.href = state.photo.finalUrl;
      link.download = UPSC_CONFIG.output.filename;
      link.click();
      setPhotoStatus("Download started as photo.jpg.", "success");
    } catch {
      setPhotoStatus("Export failure: could not trigger download.", "error");
    }
  });
}

function registerSignatureEvents() {
  elements.sigStartCameraBtn.addEventListener("click", startSignatureCamera);
  elements.sigStopCameraBtn.addEventListener("click", stopSignatureCamera);
  elements.sigCaptureBtn.addEventListener("click", captureSignatureFromCamera);

  elements.sigUploadInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      await loadSignatureSourceFromBlob(file, file.name);
    } catch (error) {
      setSignatureStatus(error instanceof Error ? error.message : "Invalid file.", "error");
    } finally {
      elements.sigUploadInput.value = "";
    }
  });

  elements.sigCaptureInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      await loadSignatureSourceFromBlob(file, "Phone camera capture");
    } catch (error) {
      setSignatureStatus(error instanceof Error ? error.message : "Invalid capture file.", "error");
    } finally {
      elements.sigCaptureInput.value = "";
    }
  });

  elements.sigZoomRange.addEventListener("input", handleSignatureTransformChange);
  elements.sigOffsetXRange.addEventListener("input", handleSignatureTransformChange);
  elements.sigOffsetYRange.addEventListener("input", handleSignatureTransformChange);
  elements.sigRotateBtn.addEventListener("click", rotateSignature);

  elements.sigRetakeBtn.addEventListener("click", () => {
    closeBitmap(state.signature.sourceBitmap);
    state.signature.sourceBitmap = null;
    resetSignatureForNewSource();
    setSectionEnabled(elements.sigStep2, false);
    signatureContext.clearRect(0, 0, sigWidth, sigHeight);
    elements.sigSourceMeta.textContent = "No signature source selected yet.";
    setSignatureStatus("Retake requested. Capture or upload a new signature image.", "info");
  });

  elements.sigCropBtn.addEventListener("click", async () => {
    if (!state.signature.sourceBitmap) {
      setSignatureStatus("Capture or upload signature image first.", "error");
      return;
    }
    state.signature.cropped = true;
    setSectionEnabled(elements.sigStep3, true);
    elements.sigDownloadBtn.disabled = true;
    await evaluateSignatureChecks(false);
    setSignatureStatus("Crop applied. Run checks and generate signature.jpg.", "success");
  });

  elements.sigQualityRange.addEventListener("input", () => {
    elements.sigQualityValue.textContent = `${elements.sigQualityRange.value}%`;
  });

  elements.sigRunChecksBtn.addEventListener("click", async () => {
    if (!state.signature.cropped) {
      setSignatureStatus("Use Crop in Step 2 before running signature checks.", "warn");
      return;
    }
    await evaluateSignatureChecks(false);
    if (state.signature.hardFails.length) {
      setSignatureStatus("Hard fail issues found. Resolve before export.", "error");
    } else {
      setSignatureStatus("Signature checks updated. Review warnings before export.", "info");
    }
  });

  elements.sigGenerateBtn.addEventListener("click", async () => {
    if (!state.signature.cropped || !state.signature.sourceBitmap) {
      setSignatureStatus("Finish Step 1 and Step 2 before export.", "error");
      return;
    }

    try {
      const preferredQuality = Number(elements.sigQualityRange.value) / 100;
      const { blob, warning } = await compressCanvasToRange(
        elements.sigAdjustCanvas,
        SIGNATURE_CONFIG.output.mimeType,
        preferredQuality,
        sigMinBytes,
        sigMaxBytes,
        SIGNATURE_CONFIG.fileSizeKB.max
      );

      state.signature.finalBlob = blob;
      releaseSignatureFinalUrl();
      state.signature.finalUrl = URL.createObjectURL(blob);
      elements.sigFinalPreview.src = state.signature.finalUrl;

      await evaluateSignatureChecks(true);
      elements.sigDetailSize.textContent = formatKB(blob.size);
      elements.sigDetailDimensions.textContent = `${sigWidth} x ${sigHeight}`;
      elements.sigDetailFormat.textContent = "JPG/JPEG";

      if (state.signature.hardFails.length) {
        elements.sigDownloadBtn.disabled = true;
        setSignatureStatus(
          `Export blocked by hard fail checks (${state.signature.hardFails.length}). Resolve and regenerate.`,
          "error"
        );
        return;
      }

      elements.sigDownloadBtn.disabled = false;
      if (warning || state.signature.warnings.length) {
        setSignatureStatus(
          `signature.jpg generated with ${state.signature.warnings.length} warning(s). Review before download.`,
          "warn"
        );
      } else {
        setSignatureStatus("signature.jpg generated and ready for download.", "success");
      }
    } catch (error) {
      setSignatureStatus(error instanceof Error ? error.message : "Export failure.", "error");
    }
  });

  elements.sigDownloadBtn.addEventListener("click", () => {
    if (!state.signature.finalBlob || !state.signature.finalUrl) {
      setSignatureStatus("Export failure: final signature image is not ready.", "error");
      return;
    }
    if (state.signature.hardFails.length) {
      setSignatureStatus("Download blocked. Resolve hard fail checks first.", "error");
      return;
    }

    try {
      const link = document.createElement("a");
      link.href = state.signature.finalUrl;
      link.download = SIGNATURE_CONFIG.output.filename;
      link.click();
      setSignatureStatus("Download started as signature.jpg.", "success");
    } catch {
      setSignatureStatus("Export failure: could not trigger download.", "error");
    }
  });
}

function registerModeEvents() {
  elements.modePhotoBtn.addEventListener("click", () => {
    activateMode("photo");
  });
  elements.modeSignatureBtn.addEventListener("click", () => {
    activateMode("signature");
  });
}

function initialize() {
  setSectionEnabled(elements.step2, false);
  setSectionEnabled(elements.step3, false);
  setSectionEnabled(elements.step4, false);
  setSectionEnabled(elements.sigStep2, false);
  setSectionEnabled(elements.sigStep3, false);

  drawPhotoGuide();
  drawSignatureGuide();

  const today = toDateInputValue(new Date());
  elements.photoDate.value = today;
  elements.applicationStartDate.value = today;
  elements.qualityValue.textContent = `${elements.qualityRange.value}%`;
  elements.sigQualityValue.textContent = `${elements.sigQualityRange.value}%`;
  setRecencyPill("Reminder: photo should not be older than 10 days from application start date.", "neutral");

  elements.detailDimensions.textContent = `${photoWidth} x ${photoHeight}`;
  elements.sigDetailDimensions.textContent = `${sigWidth} x ${sigHeight}`;

  registerModeEvents();
  registerPhotoEvents();
  registerSignatureEvents();
  activateMode("photo");
}

initialize();
