// ============================================================
// تطبيق تشخيص أمراض الدواجن — واجهة المربي المبسّطة + وضع المطور المخفي
// ============================================================

import * as ort from "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/ort.min.mjs";
import { APP_PUBLIC_URL, SUDAN_CITIES, buildWhatsAppUrl } from "./directory-data.js";
import { initBroilerTracker } from "./tracker.js";
import {
  getPreferredCity,
  initDirectory,
  renderResultPharmacies,
  setPreferredCity,
} from "./directory.js";

// توجيه محرك WASM لتحميل ملفاته من نفس الـ CDN (يُخزَّن مؤقتاً عبر Service Worker للعمل بدون إنترنت لاحقاً)
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/";

// --------------------------------------------------------------
// وضع المطور المخفي (5 نقرات سريعة على عنوان التطبيق لإظهار/إخفاء القراءات التقنية)
// --------------------------------------------------------------
function initDeveloperModeToggle() {
  const titleEl = document.getElementById("app-title");
  if (!titleEl) return;

  let tapCount = 0;
  let tapTimer = null;

  titleEl.addEventListener("click", () => {
    tapCount += 1;
    clearTimeout(tapTimer);
    if (tapCount >= 5) {
      tapCount = 0;
      document.body.classList.toggle("dev-mode");
      return;
    }
    tapTimer = setTimeout(() => {
      tapCount = 0;
    }, 3000);
  });
}

// --------------------------------------------------------------
// نظام التبويبات في شريط التنقل السفلي
// --------------------------------------------------------------
function initTabs() {
  const buttons = Array.from(document.querySelectorAll(".bottom-tab-btn[data-tab]"));
  const panels = Array.from(document.querySelectorAll(".tab-panel"));

  function activateTab(tabId) {
    buttons.forEach((btn) => {
      const active = btn.getAttribute("data-tab") === tabId;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.id === tabId);
    });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-tab");
      activateTab(target);
      history.replaceState(null, "", `#${target.replace("tab-", "")}`);
    });
  });

  const hash = window.location.hash.replace("#", "");
  if (hash === "cycle") activateTab("tab-cycle");
  else if (hash === "directory") activateTab("tab-directory");
}

// تهيئة فورية (تعمل أوفلاين بدون انتظار تحميل النموذج)
initDeveloperModeToggle();
initTabs();
initBroilerTracker();
initDirectory();

// تهيئة محدد الولاية أسفل نتيجة التشخيص
const resultCitySelect = document.getElementById("result-city-select");
const resultPharmList = document.getElementById("result-pharm-list");
if (resultCitySelect) {
  resultCitySelect.innerHTML = SUDAN_CITIES.map((c) => `<option value="${c}">${c}</option>`).join("");
  resultCitySelect.value = getPreferredCity();
  resultCitySelect.addEventListener("change", () => {
    setPreferredCity(resultCitySelect.value);
    renderResultPharmacies(resultCitySelect.value, resultPharmList);
  });
}

// --------------------------------------------------------------
// إعدادات النموذج والمعايرة وبوابة الحماية (تُحمَّل تلقائياً من ood_config.json)
// --------------------------------------------------------------
const MODEL_PATH = "model/poultry_classifier.onnx";
const CONFIG_PATHS = ["model/ood_config.json", "model/class_config.json"];

let IMG_SIZE = 224;
let IMAGENET_MEAN = [0.485, 0.456, 0.406];
let IMAGENET_STD = [0.229, 0.224, 0.225];
let CLASS_NAMES = ["Coccidiosis", "Salmonella", "Newcastle", "Healthy", "Other"];
let TEMPERATURE = 0.8892;
let USE_TTA = true;
let MODEL_VERSION = "2026-11-20-v2";
let NOVELTY_GATE = null;

const QUALITY_WARNING_CONFIDENCE = 0.65;

const CLASS_NAMES_AR = {
  Coccidiosis: "كوكسيديا (Coccidiosis)",
  Salmonella: "سالمونيلا (Salmonella)",
  Newcastle: "نيوكاسل (Newcastle Disease)",
  Healthy: "سليم (Healthy)",
  Other: "غير واضح",
};

let EXPLANATION_TEMPLATES_AR = {
  Coccidiosis:
    "قوام/لون الفضلات (احتمال وجود دم أو مخاط) مطابق لنمط بصري شبيه بحالات كوكسيديا في بيانات التدريب. هذه مطابقة بصرية أولية وليست تشخيصاً سريرياً نهائياً.",
  Salmonella:
    "قوام/لون/تماسك الفضلات مطابق لنمط بصري شبيه بحالات سالمونيلا في بيانات التدريب. هذه مطابقة بصرية أولية وليست تشخيصاً سريرياً نهائياً.",
  Newcastle:
    "نمط الفضلات مطابق لنمط بصري شبيه بحالات نيوكاسل. تنبيه مهم: مرض نيوكاسل غالباً يصاحبه أعراض تنفسية وعصبية لا تظهر في صور الفضلات — الفحص البيطري للطائر ضروري.",
  Healthy: "لم يُلاحَظ نمط فضلات غير طبيعي مقارنة بصور التدريب.",
  Other: "يرجى التقاط صورة قريبة وواضحة لفضلات الدواجن بإضاءة جيدة.",
};

const TTA_VARIANTS = [
  { flip: false, centerCropFactor: 1.0 },
  { flip: true, centerCropFactor: 1.0 },
  { flip: false, centerCropFactor: 0.9 },
];

let session = null;
let selectedImageEl = null;
let lastShareMessage = "";

// --------------------------------------------------------------
// تحميل النموذج وإعدادات المعايرة
// --------------------------------------------------------------
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const diagnoseBtn = document.getElementById("diagnose-btn");

async function loadOodConfig() {
  for (const url of CONFIG_PATHS) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const cfg = await res.json();
      if (Array.isArray(cfg.class_names) && cfg.class_names.length > 0) CLASS_NAMES = cfg.class_names;
      if (typeof cfg.temperature === "number" && cfg.temperature > 0) TEMPERATURE = cfg.temperature;
      if (typeof cfg.img_size === "number") IMG_SIZE = cfg.img_size;
      if (Array.isArray(cfg.mean) && cfg.mean.length === 3) IMAGENET_MEAN = cfg.mean;
      if (Array.isArray(cfg.std) && cfg.std.length === 3) IMAGENET_STD = cfg.std;
      if (typeof cfg.use_tta === "boolean") USE_TTA = cfg.use_tta;
      if (cfg.model_version) MODEL_VERSION = cfg.model_version;
      if (cfg.novelty_gate) NOVELTY_GATE = cfg.novelty_gate;
      if (cfg.explanation_templates_ar) {
        EXPLANATION_TEMPLATES_AR = { ...EXPLANATION_TEMPLATES_AR, ...cfg.explanation_templates_ar };
      }
      return cfg;
    } catch (err) {
      console.warn(`Config load attempt failed for ${url}:`, err);
    }
  }
  return null;
}

async function loadModel() {
  try {
    await Promise.all([
      loadOodConfig(),
      ort.InferenceSession.create(MODEL_PATH, { executionProviders: ["wasm"] }).then((s) => {
        session = s;
      }),
    ]);

    statusDot.classList.remove("error");
    statusDot.classList.add("ready");
    // شارة ثقة بسيطة وجذابة للمربي بدون أي أرقام تقنية
    statusText.textContent = "جاهز للفحص بدون إنترنت · يحفظ باقتك 🔒";

    if (selectedImageEl) {
      diagnoseBtn.disabled = false;
      diagnoseBtn.textContent = "🔍 ابدأ الفحص الآن";
    }
  } catch (err) {
    console.error("Model load failed:", err);
    statusDot.classList.add("error");
    statusText.textContent = "تعذّر تجهيز الفاحص. يرجى تحديث الصفحة مع توفر اتصال بالإنترنت لأول مرة.";
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
    previewImg.onload = () => {
      previewImg.style.display = "block";
      placeholderIcon.style.display = "none";
      previewWrap.classList.add("has-image");
      selectedImageEl = previewImg;

      diagnoseBtn.disabled = !session;
      diagnoseBtn.textContent = session ? "🔍 ابدأ الفحص الآن" : "جاري تجهيز الفاحص الذكي...";
      document.getElementById("result-card").classList.remove("visible");
    };
    previewImg.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
cameraInput.addEventListener("change", handleFileSelect);
galleryInput.addEventListener("change", handleFileSelect);

// --------------------------------------------------------------
// تجهيز الصورة والاستدلال (TTA + Temperature Scaling + بوابة OOD الثلاثية)
// --------------------------------------------------------------
function preprocessImage(imgEl, { flip = false, centerCropFactor = 1.0 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = IMG_SIZE;
  canvas.height = IMG_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const iw = imgEl.naturalWidth || imgEl.width;
  const ih = imgEl.naturalHeight || imgEl.height;

  let sx = 0;
  let sy = 0;
  let sw = iw;
  let sh = ih;
  if (centerCropFactor < 1.0) {
    sw = iw * centerCropFactor;
    sh = ih * centerCropFactor;
    sx = (iw - sw) / 2;
    sy = (ih - sh) / 2;
  }

  if (flip) {
    ctx.translate(IMG_SIZE, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, IMG_SIZE, IMG_SIZE);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const imageData = ctx.getImageData(0, 0, IMG_SIZE, IMG_SIZE).data;
  const channelSize = IMG_SIZE * IMG_SIZE;
  const floatData = new Float32Array(3 * channelSize);

  for (let i = 0; i < channelSize; i++) {
    const r = imageData[i * 4] / 255;
    const g = imageData[i * 4 + 1] / 255;
    const b = imageData[i * 4 + 2] / 255;

    floatData[i] = (r - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
    floatData[channelSize + i] = (g - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
    floatData[2 * channelSize + i] = (b - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
  }

  return new ort.Tensor("float32", floatData, [1, 3, IMG_SIZE, IMG_SIZE]);
}

function softmaxWithTemperature(logits, temperature) {
  const safeTemp = temperature > 0 ? temperature : 1.0;
  const scaled = logits.map((v) => v / safeTemp);
  const max = Math.max(...scaled);
  const exps = scaled.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

function computeCosineOOD(embedding) {
  if (!NOVELTY_GATE || !NOVELTY_GATE.cosine_centroids || !embedding) return null;

  let normSq = 0;
  for (let i = 0; i < embedding.length; i++) normSq += embedding[i] * embedding[i];
  const embNorm = Math.sqrt(normSq) + 1e-8;

  let maxCosSim = -Infinity;
  const centroids = NOVELTY_GATE.cosine_centroids;
  for (const cls of Object.keys(centroids)) {
    const centroid = centroids[cls];
    let dot = 0;
    for (let i = 0; i < embedding.length; i++) {
      dot += (embedding[i] / embNorm) * centroid[i];
    }
    if (dot > maxCosSim) maxCosSim = dot;
  }

  const cosineDistance = 1.0 - maxCosSim;
  const cosineThreshold =
    typeof NOVELTY_GATE.cosine_threshold === "number" ? NOVELTY_GATE.cosine_threshold : 0.8024;

  return { cosineDistance, maxCosSim, cosineThreshold };
}

function computeMahalanobisOOD(embedding) {
  if (!NOVELTY_GATE || !NOVELTY_GATE.class_means || !NOVELTY_GATE.global_var || !embedding) {
    return null;
  }

  const { class_means, global_var } = NOVELTY_GATE;
  let minDist = Infinity;

  for (const cls of Object.keys(class_means)) {
    const mean = class_means[cls];
    let dist = 0;
    for (let i = 0; i < embedding.length; i++) {
      const diff = embedding[i] - mean[i];
      dist += (diff * diff) / global_var[i];
    }
    if (dist < minDist) minDist = dist;
  }

  const mahalThreshold =
    typeof NOVELTY_GATE.threshold === "number" ? NOVELTY_GATE.threshold : 2705.7917;

  return { mahalDistance: minDist, mahalThreshold };
}

function confidenceLabel(prob) {
  if (prob >= 0.85) return { label: "عالية", key: "high" };
  if (prob >= QUALITY_WARNING_CONFIDENCE) return { label: "جيدة", key: "medium" };
  return { label: "منخفضة", key: "low" };
}

async function runInference(imgEl) {
  const variants = USE_TTA ? TTA_VARIANTS : [TTA_VARIANTS[0]];
  const numClasses = CLASS_NAMES.length;
  const accumProbs = new Array(numClasses).fill(0);
  let accumEmbedding = null;

  for (const variant of variants) {
    const inputTensor = preprocessImage(imgEl, variant);
    const results = await session.run({ input: inputTensor });
    const logits = Array.from(results.output.data);
    const probs = softmaxWithTemperature(logits, TEMPERATURE);

    for (let i = 0; i < numClasses; i++) accumProbs[i] += probs[i];

    if (results.embedding && results.embedding.data) {
      const emb = results.embedding.data;
      if (!accumEmbedding) accumEmbedding = new Float64Array(emb.length);
      for (let i = 0; i < emb.length; i++) accumEmbedding[i] += emb[i];
    }
  }

  const probs = accumProbs.map((v) => v / variants.length);
  const embedding = accumEmbedding
    ? Array.from(accumEmbedding, (v) => v / variants.length)
    : null;

  const maxIdx = probs.indexOf(Math.max(...probs));
  const predictedClass = CLASS_NAMES[maxIdx];
  const confidence = probs[maxIdx];

  const cosineOOD = computeCosineOOD(embedding);
  const mahalOOD = computeMahalanobisOOD(embedding);

  const isSoftmaxOther = predictedClass === "Other";
  const isCosineRejected =
    cosineOOD !== null && cosineOOD.cosineDistance > cosineOOD.cosineThreshold;
  const isHardReject = isSoftmaxOther || isCosineRejected;

  const isMahalWarning =
    !isHardReject && mahalOOD !== null && mahalOOD.mahalDistance > mahalOOD.mahalThreshold;
  const isLowConfWarning = !isHardReject && confidence < QUALITY_WARNING_CONFIDENCE;
  const isQualityWarning = isMahalWarning || isLowConfWarning;

  const outcome = {
    decision: isHardReject ? "OOD_REJECT" : isQualityWarning ? "QUALITY_WARNING" : "DIAGNOSIS_OK",
    predictedClass,
    confidence,
    probs,
    temperature: TEMPERATURE,
    isSoftmaxOther,
    isCosineRejected,
    isMahalWarning,
    isLowConfWarning,
    cosineOOD,
    mahalOOD,
  };

  window.__POULTRY_LAST_INFERENCE__ = outcome;
  return outcome;
}

diagnoseBtn.addEventListener("click", async () => {
  if (!session || !selectedImageEl) return;

  diagnoseBtn.disabled = true;
  diagnoseBtn.innerHTML = 'جاري فحص الصورة... <span class="spinner"></span>';

  try {
    const outcome = await runInference(selectedImageEl);
    displayResult(outcome);
  } catch (err) {
    console.error("Inference failed:", err);
    alert("حدث خطأ أثناء الفحص. حاول مرة أخرى بصورة أوضح.");
  } finally {
    diagnoseBtn.disabled = false;
    diagnoseBtn.textContent = "🔍 ابدأ الفحص الآن";
  }
});

function buildDiagnosisShareMessage(outcome) {
  const clsAr = CLASS_NAMES_AR[outcome.predictedClass] || outcome.predictedClass;
  const pct = Math.round(outcome.confidence * 100);
  const note = EXPLANATION_TEMPLATES_AR[outcome.predictedClass] || "";
  const qualityLine =
    outcome.decision === "QUALITY_WARNING"
      ? "• تنبيه جودة الصورة: يُنصح بإعادة التصوير بوضوح أعلى للتأكيد.\n"
      : "";

  return (
    `🐔 *تقرير فحص مبدئي — تطبيق تشخيص أمراض الدواجن*\n` +
    `• الحالة المتوقعة: *${clsAr}*\n` +
    `• نسبة التأكد: *${pct}%*\n` +
    qualityLine +
    `• الملاحظة: ${note}\n` +
    `⚠️ فحص مبدئي بالذكاء الاصطناعي — استشر طبيباً بيطرياً قبل بدء العلاج.\n\n` +
    `📲 افحص قطيعك وتابع دورة التسمين مجاناً وبدون إنترنت:\n` +
    `${APP_PUBLIC_URL}`
  );
}

function displayResult(outcome) {
  const resultCard = document.getElementById("result-card");
  const badge = document.getElementById("result-badge");
  const warningBanner = document.getElementById("quality-warning");
  const oodBox = document.getElementById("ood-guidance");
  const confidenceRow = document.getElementById("confidence-row");
  const confFill = document.getElementById("confidence-fill");
  const confPct = document.getElementById("confidence-pct");
  const explanationText = document.getElementById("explanation-text");
  const probList = document.getElementById("prob-list");
  const shareActions = document.getElementById("share-actions");
  const resultPharmacies = document.getElementById("result-pharmacies");
  const gateMeta = document.getElementById("gate-meta");

  warningBanner.classList.remove("visible");
  warningBanner.textContent = "";
  oodBox.classList.remove("visible");
  oodBox.innerHTML = "";
  shareActions.classList.remove("visible");
  resultPharmacies.classList.remove("visible");
  gateMeta.classList.remove("has-data");
  gateMeta.innerHTML = "";
  lastShareMessage = "";

  // تُجهَّز البيانات التقنية لوضع المطور فقط (مخفية بـ CSS ما لم يُفعَّل وضع المطور بـ 5 نقرات)
  const cosText = outcome.cosineOOD
    ? `Cosine dist: ${outcome.cosineOOD.cosineDistance.toFixed(3)} / ${outcome.cosineOOD.cosineThreshold.toFixed(3)}`
    : "";
  const mahalText = outcome.mahalOOD
    ? `Mahalanobis: ${Math.round(outcome.mahalOOD.mahalDistance)} / ${Math.round(outcome.mahalOOD.mahalThreshold)}`
    : "";

  // ── الحالة 1: رفض ودّي عند عدم وضوح فضلات الدواجن ──
  if (outcome.decision === "OOD_REJECT") {
    badge.textContent = "⚠️ لم نتمكن من رؤية فضلات الدواجن بوضوح";
    badge.className = "result-badge badge-ood";

    confidenceRow.style.display = "none";
    explanationText.textContent = "";
    probList.innerHTML = "";

    oodBox.innerHTML = `
      <strong>حتى نعطيك نتيجة صحيحة، نحتاج صورة أوضح لفضلات الدواجن:</strong>
      <ul>
        <li>قرّب الكاميرا من الفضلات بحيث تظهر بوضوح في وسط الصورة.</li>
        <li>تأكّد من وجود إضاءة كافية وثبّت الهاتف لحظة التصوير.</li>
        <li>تجنّب تصوير الأرضية الفارغة أو الأجسام البعيدة عن القطيع.</li>
      </ul>
      <button type="button" class="btn-retake" id="retake-photo-btn">إعادة التصوير الآن 📸</button>
    `;
    oodBox.classList.add("visible");

    const retakeBtn = document.getElementById("retake-photo-btn");
    if (retakeBtn) {
      retakeBtn.addEventListener("click", () => {
        cameraInput.value = "";
        cameraInput.click();
      });
    }

    gateMeta.innerHTML = `<span>[DEV] OOD_REJECT · ${MODEL_VERSION}</span><span>${[cosText, mahalText].filter(Boolean).join(" · ")}</span>`;
    gateMeta.classList.add("has-data");

    resultCard.classList.add("visible");
    resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  // ── الحالة 2 و 3: نتيجة الفحص ──
  confidenceRow.style.display = "flex";

  const isHealthy = outcome.predictedClass === "Healthy";
  badge.textContent = CLASS_NAMES_AR[outcome.predictedClass] || outcome.predictedClass;
  badge.className = "result-badge " + (isHealthy ? "badge-healthy" : "badge-disease");

  if (outcome.decision === "QUALITY_WARNING") {
    warningBanner.innerHTML =
      "⚠️ <strong>تنبيه جودة الصورة:</strong> وضوح الصورة أقل من المثالي — يُنصح بإعادة تصوير الفضلات عن قرب وبإضاءة أوضح للتأكيد قبل بدء أي علاج.";
    warningBanner.classList.add("visible");
  }

  const pct = Math.round(outcome.confidence * 100);
  confFill.style.width = pct + "%";
  const { label } = confidenceLabel(outcome.confidence);
  confPct.textContent = `${label} (${pct}%)`;

  explanationText.textContent = EXPLANATION_TEMPLATES_AR[outcome.predictedClass] || "";

  const sorted = CLASS_NAMES.map((cls, i) => ({ cls, prob: outcome.probs[i] }))
    .filter(({ cls }) => cls !== "Other")
    .sort((a, b) => b.prob - a.prob);

  probList.innerHTML = sorted
    .map(
      ({ cls, prob }) => `
      <div class="prob-item">
        <span class="name">${(CLASS_NAMES_AR[cls] || cls).split(" (")[0]}</span>
        <div class="bar-bg"><div class="bar-fill" style="width:${Math.round(prob * 100)}%"></div></div>
        <span class="pct">${Math.round(prob * 100)}%</span>
      </div>`
    )
    .join("");

  // زر مشاركة التقرير عبر واتساب
  lastShareMessage = buildDiagnosisShareMessage(outcome);
  shareActions.classList.add("visible");

  // عرض الصيدليات البيطرية حسب الولاية أسفل النتيجة مباشرة
  if (resultCitySelect && resultPharmList) {
    const preferred = getPreferredCity();
    resultCitySelect.value = preferred;
    renderResultPharmacies(preferred, resultPharmList);
    resultPharmacies.classList.add("visible");
  }

  // قراءات تقنية مخفية لوضع المطور فقط
  gateMeta.innerHTML = `<span>[DEV] T=${TEMPERATURE} · ${MODEL_VERSION}</span><span>${[cosText, mahalText].filter(Boolean).join(" · ")}</span>`;
  gateMeta.classList.add("has-data");

  resultCard.classList.add("visible");
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// مشاركة التقرير عبر واتساب أو نسخه
const shareWhatsappBtn = document.getElementById("share-whatsapp-btn");
const copyReportBtn = document.getElementById("copy-report-btn");

shareWhatsappBtn.addEventListener("click", () => {
  if (!lastShareMessage) return;
  window.open(buildWhatsAppUrl("", lastShareMessage), "_blank", "noopener,noreferrer");
});

copyReportBtn.addEventListener("click", async () => {
  if (!lastShareMessage) return;
  try {
    await navigator.clipboard.writeText(lastShareMessage);
    const oldText = copyReportBtn.textContent;
    copyReportBtn.textContent = "✅ تم النسخ";
    setTimeout(() => {
      copyReportBtn.textContent = oldText;
    }, 1800);
  } catch {
    alert(lastShareMessage);
  }
});

// --------------------------------------------------------------
// تسجيل Service Worker وتحديث الكاش تلقائياً
// --------------------------------------------------------------
if ("serviceWorker" in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController && !reloading) {
      reloading = true;
      window.location.reload();
    }
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then((reg) => reg.update().catch(() => {}))
      .catch((err) => {
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
