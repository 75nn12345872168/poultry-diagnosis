// ============================================================
// تطبيق تشخيص أمراض الدواجن - يعمل بالكامل داخل المتصفح (Client-Side)
// النموذج: EfficientNet-B0 مُصدَّر إلى صيغة ONNX
// ============================================================

import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.min.mjs";

// توجيه محرك WASM لتحميل ملفاته من نفس الـ CDN (سيُخزَّن مؤقتاً عبر Service Worker للعمل بدون إنترنت لاحقاً)
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/";

// --------------------------------------------------------------
// إعدادات ثابتة - يجب أن تطابق بالضبط ما استُخدم أثناء التدريب (Block 4 في النوتبوك)
// --------------------------------------------------------------
const MODEL_PATH = "model/poultry_classifier.onnx";
const IMG_SIZE = 224;
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

// ترتيب الفئات يجب أن يطابق بالضبط ترتيب CLASS_NAMES في Block 2 من النوتبوك
const CLASS_NAMES = ["Coccidiosis", "Salmonella", "Newcastle", "Healthy"];

const CLASS_NAMES_AR = {
  Coccidiosis: "كوكسيديا (Coccidiosis)",
  Salmonella: "سالمونيلا (Salmonella)",
  Newcastle: "نيوكاسل (Newcastle Disease)",
  Healthy: "سليم (Healthy)",
};

// نفس قوالب Stage 2 الموجودة في Block 8 من النوتبوك
const EXPLANATION_TEMPLATES = {
  Coccidiosis: "فضلات غير طبيعية وعلامات متوافقة مع إصابة معوية (كوكسيديا).",
  Salmonella: "علامات متوافقة مع إصابة بكتيرية تؤثر على الجهاز الهضمي (سالمونيلا).",
  Newcastle: "علامات تنفسية و/أو عصبية متوافقة مع إصابة فيروسية (نيوكاسل).",
  Healthy: "لا توجد أعراض غير طبيعية ظاهرة؛ الطائر يبدو في حالة طبيعية.",
};

let session = null;
let selectedImageEl = null;

// --------------------------------------------------------------
// تحميل النموذج عند فتح التطبيق
// --------------------------------------------------------------
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const diagnoseBtn = document.getElementById("diagnose-btn");

async function loadModel() {
  try {
    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["wasm"],
    });
    statusDot.classList.add("ready");
    statusText.textContent = "النموذج جاهز — يعمل بدون إنترنت";
  } catch (err) {
    console.error("Model load failed:", err);
    statusDot.classList.add("error");
    statusText.textContent = "تعذّر تحميل النموذج. تأكد من وجود model/poultry_classifier.onnx";
  }
}
loadModel();

// --------------------------------------------------------------
// اختيار الصورة (كاميرا أو معرض)
// --------------------------------------------------------------
const cameraBtn = document.getElementById("camera-btn");
const galleryBtn = document.getElementById("gallery-btn");
const cameraInput = document.getElementById("camera-input");
const galleryInput = document.getElementById("gallery-input");
const previewWrap = document.getElementById("image-preview-wrap");
const previewImg = document.getElementById("image-preview");
const placeholderIcon = document.getElementById("placeholder-icon");

cameraBtn.addEventListener("click", () => cameraInput.click());
galleryBtn.addEventListener("click", () => galleryInput.click());

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    previewImg.src = ev.target.result;
    previewImg.style.display = "block";
    placeholderIcon.style.display = "none";
    previewWrap.classList.add("has-image");
    selectedImageEl = previewImg;

    diagnoseBtn.disabled = !session;
    diagnoseBtn.textContent = session ? "🔍 تشخيص الصورة" : "جاري تحميل النموذج...";

    document.getElementById("result-card").classList.remove("visible");
  };
  reader.readAsDataURL(file);
}
cameraInput.addEventListener("change", handleFileSelect);
galleryInput.addEventListener("change", handleFileSelect);

// --------------------------------------------------------------
// تجهيز الصورة (Preprocessing) - يجب أن يطابق val_test_transform في Block 4 بالضبط:
// Resize(224,224) ثم Normalize بمتوسط/انحراف ImageNet، وتحويل HWC -> CHW
// --------------------------------------------------------------
function preprocessImage(imgEl) {
  const canvas = document.createElement("canvas");
  canvas.width = IMG_SIZE;
  canvas.height = IMG_SIZE;
  const ctx = canvas.getContext("2d");

  // Resize مباشر بدون Crop (نفس سلوك A.Resize في Albumentations)
  ctx.drawImage(imgEl, 0, 0, IMG_SIZE, IMG_SIZE);
  const imageData = ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE).data; // RGBA, HWC

  const channelSize = IMG_SIZE * IMG_SIZE;
  const floatData = new Float32Array(3 * channelSize); // CHW

  for (let i = 0; i < channelSize; i++) {
    const r = imageData[i * 4] / 255;
    const g = imageData[i * 4 + 1] / 255;
    const b = imageData[i * 4 + 2] / 255;

    floatData[i] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];                  // قناة R
    floatData[channelSize + i] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];    // قناة G
    floatData[2 * channelSize + i] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2]; // قناة B
  }

  return new ort.Tensor("float32", floatData, [1, 3, IMG_SIZE, IMG_SIZE]);
}

function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

function confidenceLabel(prob) {
  if (prob >= 0.8) return { label: "عالية", key: "high" };
  if (prob >= 0.55) return { label: "متوسطة", key: "medium" };
  return { label: "منخفضة", key: "low" };
}

// --------------------------------------------------------------
// التشخيص (Stage 1: تصنيف + Stage 2: توليد التقرير)
// --------------------------------------------------------------
diagnoseBtn.addEventListener("click", async () => {
  if (!session || !selectedImageEl) return;

  diagnoseBtn.disabled = true;
  diagnoseBtn.innerHTML = 'جاري التحليل...<span class="spinner"></span>';

  try {
    const inputTensor = preprocessImage(selectedImageEl);
    const results = await session.run({ input: inputTensor });
    const logits = Array.from(results.output.data);
    const probs = softmax(logits);

    const maxIdx = probs.indexOf(Math.max(...probs));
    const predictedClass = CLASS_NAMES[maxIdx];
    const confidence = probs[maxIdx];

    displayResult(predictedClass, confidence, probs);
  } catch (err) {
    console.error("Inference failed:", err);
    alert("حدث خطأ أثناء التحليل. حاول مرة أخرى بصورة أخرى.");
  } finally {
    diagnoseBtn.disabled = false;
    diagnoseBtn.textContent = "🔍 تشخيص الصورة";
  }
});

function displayResult(predictedClass, confidence, allProbs) {
  const resultCard = document.getElementById("result-card");
  const badge = document.getElementById("result-badge");
  const confFill = document.getElementById("confidence-fill");
  const confPct = document.getElementById("confidence-pct");
  const explanationText = document.getElementById("explanation-text");
  const probList = document.getElementById("prob-list");

  const isHealthy = predictedClass === "Healthy";
  badge.textContent = CLASS_NAMES_AR[predictedClass];
  badge.className = "result-badge " + (isHealthy ? "badge-healthy" : "badge-disease");

  const pct = Math.round(confidence * 100);
  confFill.style.width = pct + "%";
  const { label } = confidenceLabel(confidence);
  confPct.textContent = `${label} (${pct}%)`;

  explanationText.textContent = EXPLANATION_TEMPLATES[predictedClass];

  // ترتيب كل الاحتمالات تنازلياً للعرض التفصيلي
  const sorted = CLASS_NAMES.map((cls, i) => ({ cls, prob: allProbs[i] })).sort((a, b) => b.prob - a.prob);
  probList.innerHTML = sorted
    .map(
      ({ cls, prob }) => `
      <div class="prob-item">
        <span class="name">${CLASS_NAMES_AR[cls].split(" (")[0]}</span>
        <div class="bar-bg"><div class="bar-fill" style="width:${Math.round(prob * 100)}%"></div></div>
        <span class="pct">${Math.round(prob * 100)}%</span>
      </div>`
    )
    .join("");

  resultCard.classList.add("visible");
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// --------------------------------------------------------------
// تسجيل Service Worker للعمل بدون إنترنت
// --------------------------------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}

// --------------------------------------------------------------
// زر تثبيت التطبيق على الهاتف (Add to Home Screen)
// --------------------------------------------------------------
let deferredPrompt = null;
const installBanner = document.getElementById("install-banner");
const installBtn = document.getElementById("install-btn");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBanner.classList.add("visible");
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBanner.classList.remove("visible");
});

window.addEventListener("appinstalled", () => {
  installBanner.classList.remove("visible");
});
