// ============================================================
// وحدة متابع دورة التسمين (45 يوماً) — أوفلاين بالكامل عبر localStorage
// ============================================================

import { APP_PUBLIC_URL, buildWhatsAppUrl } from "./directory-data.js";

const STORAGE_KEY = "poultry_broiler_cycle_v1";

// جدول التحصينات القياسي في السودان لدورة التسمين (45 يوماً)
const SUDAN_VACCINATION_SCHEDULE = [
  {
    id: "vac-d1-welcome",
    dayStart: 1,
    dayEnd: 3,
    name: "برنامج الاستقبال (فيتامينات + أملاح + مضاد معوي وقائي)",
    method: "مياه الشرب — يُرفع التوتر الحراري بعد النقل",
    tag: "استقبال",
  },
  {
    id: "vac-d6-nb1-ib",
    dayStart: 5,
    dayEnd: 7,
    name: "نيوكاسل B1 + إي بي (Newcastle Hitchner B1 + IB)",
    method: "تقطير في العين (الأفضل) أو مياه الشرب الخالية من الكلور",
    tag: "تحصين أساسي",
  },
  {
    id: "vac-d13-gumboro1",
    dayStart: 12,
    dayEnd: 14,
    name: "غومبورو الجرعة الأولى (Gumboro / IBD)",
    method: "مياه الشرب بعد تعطيش ساعتين (صباحاً قبل اشتداد الحرارة)",
    tag: "تحصين أساسي",
  },
  {
    id: "vac-d18-lasota1",
    dayStart: 18,
    dayEnd: 20,
    name: "نيوكاسل لاسوتا (Newcastle LaSota)",
    method: "مياه الشرب مع حليب بودرة منزوع الدسم لتثبيت اللقاح",
    tag: "تحصين أساسي",
  },
  {
    id: "vac-d22-gumboro2",
    dayStart: 22,
    dayEnd: 24,
    name: "غومبورو الجرعة المنشّطة (Gumboro Booster)",
    method: "مياه الشرب — مهمة في المناطق عالية الإصابة أو الرطوبة",
    tag: "منشّط",
  },
  {
    id: "vac-d28-lasota-ib",
    dayStart: 28,
    dayEnd: 30,
    name: "نيوكاسل لاسوتا + إي بي (LaSota + IB)",
    method: "مياه الشرب — الجرعة الختامية لحماية القطيع حتى التسويق",
    tag: "تحصين ختامي",
  },
];

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function defaultState() {
  return {
    flockName: "عنبر التسمين 1",
    startDate: todayISO(),
    initialBirds: 500,
    chickPriceSDG: 2500,
    feedBagPriceSDG: 65000, // جوال 50 كجم
    extraCostsSDG: 150000, // أدوية + تدفئة + فرشة + عمالة
    sellPricePerKgSDG: 9500,
    avgWeightGrams: 0,
    completedVaccines: {},
    dailyLogs: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      ...defaultState(),
      ...parsed,
      completedVaccines: parsed.completedVaccines || {},
      dailyLogs: Array.isArray(parsed.dailyLogs) ? parsed.dailyLogs : [],
    };
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to persist cycle state:", err);
  }
}

function calcAgeDays(startDateStr) {
  if (!startDateStr) return 1;
  const start = new Date(`${startDateStr}T00:00:00`);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = today.getTime() - start.getTime();
  const days = Math.floor(diffMs / 86400000) + 1;
  return Math.max(1, days);
}

function feedStageLabel(ageDays) {
  if (ageDays <= 14) return "مرحلة العلف البادي (Starter)";
  if (ageDays <= 28) return "مرحلة العلف النامي (Grower)";
  if (ageDays <= 45) return "مرحلة العلف الناهي (Finisher)";
  return "تجاوز عمر 45 يوماً (جاهز للتسويق)";
}

// تقدير إرشادي للوزن القياسي لكتكوت التسمين (جرام) إذا لم يُدخل المربي وزناً مقاساً بعد
function standardBroilerWeightGrams(ageDays) {
  const table = [
    42, 55, 72, 93, 118, 147, 180, 218, 260, 307, 359, 416, 478, 545, 617,
    694, 776, 862, 952, 1046, 1143, 1243, 1345, 1449, 1554, 1660, 1767, 1874,
    1980, 2085, 2189, 2292, 2393, 2492, 2589, 2684, 2777, 2867, 2954, 3038,
    3119, 3197, 3272, 3344, 3412,
  ];
  const idx = Math.min(Math.max(ageDays - 1, 0), table.length - 1);
  return table[idx];
}

function formatSDG(num) {
  if (!Number.isFinite(num)) return "0";
  return Math.round(num).toLocaleString("en-US");
}

function computeMetrics(state) {
  const ageDays = calcAgeDays(state.startDate);
  const initialBirds = Math.max(1, Number(state.initialBirds) || 1);
  const totalMortality = state.dailyLogs.reduce((sum, l) => sum + (Number(l.mortality) || 0), 0);
  const aliveBirds = Math.max(0, initialBirds - totalMortality);
  const mortalityPct = (totalMortality / initialBirds) * 100;

  const totalFeedKg = state.dailyLogs.reduce((sum, l) => sum + (Number(l.feedKg) || 0), 0);

  // آخر وزن مسجّل في اليوميات، وإلا الوزن المدخل في الإعدادات
  const latestLoggedWeight = [...state.dailyLogs]
    .reverse()
    .find((l) => Number(l.avgWeightGrams) > 0);
  const measuredWeightGrams = latestLoggedWeight
    ? Number(latestLoggedWeight.avgWeightGrams)
    : Number(state.avgWeightGrams) || 0;
  const isWeightEstimated = measuredWeightGrams <= 0;
  const effectiveWeightGrams = isWeightEstimated
    ? standardBroilerWeightGrams(ageDays)
    : measuredWeightGrams;

  const totalLiveWeightKg = (aliveBirds * effectiveWeightGrams) / 1000;
  const fcr = totalFeedKg > 0 && totalLiveWeightKg > 0 ? totalFeedKg / totalLiveWeightKg : null;

  const feedPricePerKg = (Number(state.feedBagPriceSDG) || 0) / 50;
  const chicksCost = initialBirds * (Number(state.chickPriceSDG) || 0);
  const feedCost = totalFeedKg * feedPricePerKg;
  const extraCosts = Number(state.extraCostsSDG) || 0;
  const totalCostSDG = chicksCost + feedCost + extraCosts;
  const costPerAliveBirdSDG = aliveBirds > 0 ? totalCostSDG / aliveBirds : totalCostSDG;

  const estimatedRevenueSDG = totalLiveWeightKg * (Number(state.sellPricePerKgSDG) || 0);
  const netProfitSDG = estimatedRevenueSDG - totalCostSDG;

  return {
    ageDays,
    initialBirds,
    totalMortality,
    aliveBirds,
    mortalityPct,
    totalFeedKg,
    effectiveWeightGrams,
    isWeightEstimated,
    totalLiveWeightKg,
    fcr,
    chicksCost,
    feedCost,
    extraCosts,
    totalCostSDG,
    costPerAliveBirdSDG,
    estimatedRevenueSDG,
    netProfitSDG,
  };
}

export function initBroilerTracker() {
  const root = document.getElementById("tab-cycle");
  if (!root) return;

  let state = loadState();

  const els = {
    flockName: document.getElementById("cycle-flock-name"),
    startDate: document.getElementById("cycle-start-date"),
    initialBirds: document.getElementById("cycle-initial-birds"),
    chickPrice: document.getElementById("cycle-chick-price"),
    feedBagPrice: document.getElementById("cycle-feed-bag-price"),
    extraCosts: document.getElementById("cycle-extra-costs"),
    sellPrice: document.getElementById("cycle-sell-price"),
    avgWeight: document.getElementById("cycle-avg-weight"),
    saveSettingsBtn: document.getElementById("cycle-save-settings"),
    resetCycleBtn: document.getElementById("cycle-reset-btn"),
    shareCycleBtn: document.getElementById("cycle-share-whatsapp"),

    kpiAge: document.getElementById("kpi-age"),
    kpiStage: document.getElementById("kpi-stage"),
    ageProgressFill: document.getElementById("cycle-age-progress"),
    kpiAlive: document.getElementById("kpi-alive"),
    kpiMortality: document.getElementById("kpi-mortality"),
    kpiFcr: document.getElementById("kpi-fcr"),
    kpiFcrNote: document.getElementById("kpi-fcr-note"),
    kpiCostBird: document.getElementById("kpi-cost-bird"),
    kpiTotalCost: document.getElementById("kpi-total-cost"),
    kpiProfit: document.getElementById("kpi-profit"),
    kpiRevenue: document.getElementById("kpi-revenue"),
    mortalityAlert: document.getElementById("cycle-mortality-alert"),

    vacAlertBanner: document.getElementById("vac-due-banner"),
    vacList: document.getElementById("vac-schedule-list"),

    logForm: document.getElementById("daily-log-form"),
    logDate: document.getElementById("log-date"),
    logMortality: document.getElementById("log-mortality"),
    logFeedKg: document.getElementById("log-feed-kg"),
    logWeight: document.getElementById("log-weight-g"),
    logNote: document.getElementById("log-note"),
    logList: document.getElementById("daily-log-list"),
    settingsToast: document.getElementById("cycle-settings-toast"),
  };

  function populateSettingsInputs() {
    els.flockName.value = state.flockName;
    els.startDate.value = state.startDate;
    els.initialBirds.value = state.initialBirds;
    els.chickPrice.value = state.chickPriceSDG;
    els.feedBagPrice.value = state.feedBagPriceSDG;
    els.extraCosts.value = state.extraCostsSDG;
    els.sellPrice.value = state.sellPricePerKgSDG;
    els.avgWeight.value = state.avgWeightGrams || "";
    if (els.logDate && !els.logDate.value) {
      els.logDate.value = todayISO();
    }
  }

  function renderVaccines(ageDays) {
    const dueNow = [];
    const overdue = [];

    els.vacList.innerHTML = SUDAN_VACCINATION_SCHEDULE.map((v) => {
      const done = Boolean(state.completedVaccines[v.id]);
      let statusBadge = "";
      let rowClass = "vac-item";

      if (done) {
        statusBadge = `<span class="vac-pill vac-done">✅ تم</span>`;
        rowClass += " is-done";
      } else if (ageDays >= v.dayStart && ageDays <= v.dayEnd) {
        statusBadge = `<span class="vac-pill vac-due">🔔 مستحق الآن</span>`;
        rowClass += " is-due";
        dueNow.push(v.name);
      } else if (ageDays > v.dayEnd) {
        statusBadge = `<span class="vac-pill vac-overdue">⚠️ متأخر</span>`;
        rowClass += " is-overdue";
        overdue.push(v.name);
      } else {
        const diff = v.dayStart - ageDays;
        statusBadge = `<span class="vac-pill vac-upcoming">⏳ بعد ${diff} ${diff === 1 ? "يوم" : "أيام"}</span>`;
      }

      return `
        <label class="${rowClass}">
          <input type="checkbox" data-vac-id="${v.id}" ${done ? "checked" : ""}>
          <div class="vac-body">
            <div class="vac-head">
              <strong>يوم ${v.dayStart}–${v.dayEnd}: ${v.name}</strong>
              ${statusBadge}
            </div>
            <div class="vac-method">${v.method}</div>
          </div>
        </label>
      `;
    }).join("");

    // تنبيه مرئي أعلى الجدول عند وجود تحصين مستحق أو متأخر
    if (dueNow.length > 0 || overdue.length > 0) {
      const parts = [];
      if (dueNow.length > 0) parts.push(`🔔 <strong>تحصين مستحق الآن:</strong> ${dueNow.join(" · ")}`);
      if (overdue.length > 0) parts.push(`⚠️ <strong>تحصين غير مسجّل كمنجز:</strong> ${overdue.join(" · ")}`);
      els.vacAlertBanner.innerHTML = parts.join("<br>");
      els.vacAlertBanner.classList.add("visible");
    } else {
      els.vacAlertBanner.classList.remove("visible");
      els.vacAlertBanner.innerHTML = "";
    }
  }

  function renderLogs() {
    if (state.dailyLogs.length === 0) {
      els.logList.innerHTML = `<div class="empty-state">لا توجد سجلات يومية بعد. سجّل النفوق والعلف اليومي أعلاه لحساب معامل التحويل (FCR) وتكلفة الطائر بدقة.</div>`;
      return;
    }

    const sorted = [...state.dailyLogs].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    els.logList.innerHTML = sorted
      .map(
        (log) => `
      <div class="log-row">
        <div class="log-main">
          <div class="log-date">📅 ${log.date}</div>
          <div class="log-stats">
            <span>نفوق: <strong>${log.mortality}</strong></span>
            <span>علف: <strong>${log.feedKg} كجم</strong></span>
            ${log.avgWeightGrams ? `<span>وزن: <strong>${log.avgWeightGrams} جم</strong></span>` : ""}
          </div>
          ${log.note ? `<div class="log-note">📝 ${escapeHtml(log.note)}</div>` : ""}
        </div>
        <button type="button" class="btn-icon-del" data-del-log="${log.id}" title="حذف السجل">✕</button>
      </div>`
      )
      .join("");
  }

  function render() {
    const m = computeMetrics(state);

    els.kpiAge.textContent = `اليوم ${m.ageDays} / 45`;
    els.kpiStage.textContent = feedStageLabel(m.ageDays);
    const pctProgress = Math.min(100, Math.round((m.ageDays / 45) * 100));
    els.ageProgressFill.style.width = `${pctProgress}%`;

    els.kpiAlive.textContent = `${m.aliveBirds.toLocaleString("en-US")} طائر`;
    els.kpiMortality.textContent = `نفوق: ${m.totalMortality} (${m.mortalityPct.toFixed(1)}%)`;

    if (m.mortalityPct >= 5) {
      els.mortalityAlert.innerHTML = `🚨 <strong>تنبيه نفوق مرتفع (${m.mortalityPct.toFixed(1)}%):</strong> تجاوز النفوق التراكمي 5%. يُنصح بفحص عينة فضلات في تبويب التشخيص ومراجعة طبيب بيطري فوراً.`;
      els.mortalityAlert.classList.add("visible");
    } else {
      els.mortalityAlert.classList.remove("visible");
    }

    if (m.fcr === null) {
      els.kpiFcr.textContent = "—";
      els.kpiFcrNote.textContent = "سجّل العلف اليومي لحساب FCR";
    } else {
      els.kpiFcr.textContent = m.fcr.toFixed(2);
      const quality =
        m.fcr <= 1.65 ? "ممتاز" : m.fcr <= 1.85 ? "جيد" : "مرتفع — راجع العلف/الصحة";
      const weightTag = m.isWeightEstimated
        ? `وزن تقديري ${m.effectiveWeightGrams} جم`
        : `وزن مقاس ${m.effectiveWeightGrams} جم`;
      els.kpiFcrNote.textContent = `${quality} (${weightTag})`;
    }

    els.kpiCostBird.textContent = `${formatSDG(m.costPerAliveBirdSDG)} ج.س`;
    els.kpiTotalCost.textContent = `إجمالي التكلفة: ${formatSDG(m.totalCostSDG)} ج.س (علف: ${m.totalFeedKg.toFixed(1)} كجم)`;

    const isProfit = m.netProfitSDG >= 0;
    els.kpiProfit.textContent = `${isProfit ? "+" : ""}${formatSDG(m.netProfitSDG)} ج.س`;
    els.kpiProfit.className = `kpi-value ${isProfit ? "text-success" : "text-danger"}`;
    els.kpiRevenue.textContent = `إيراد تقديري (${m.totalLiveWeightKg.toFixed(1)} كجم): ${formatSDG(m.estimatedRevenueSDG)} ج.س`;

    renderVaccines(m.ageDays);
    renderLogs();
  }

  // حفظ إعدادات الدورة
  els.saveSettingsBtn.addEventListener("click", () => {
    state.flockName = (els.flockName.value || "عنبر التسمين 1").trim();
    state.startDate = els.startDate.value || todayISO();
    state.initialBirds = Math.max(1, parseInt(els.initialBirds.value, 10) || 1);
    state.chickPriceSDG = Math.max(0, parseFloat(els.chickPrice.value) || 0);
    state.feedBagPriceSDG = Math.max(0, parseFloat(els.feedBagPrice.value) || 0);
    state.extraCostsSDG = Math.max(0, parseFloat(els.extraCosts.value) || 0);
    state.sellPricePerKgSDG = Math.max(0, parseFloat(els.sellPrice.value) || 0);
    state.avgWeightGrams = Math.max(0, parseFloat(els.avgWeight.value) || 0);

    saveState(state);
    render();

    els.settingsToast.textContent = "✅ تم حفظ بيانات الدورة محلياً على جهازك";
    els.settingsToast.classList.add("visible");
    setTimeout(() => els.settingsToast.classList.remove("visible"), 2600);
  });

  // تحديد التحصينات المنجزة
  els.vacList.addEventListener("change", (e) => {
    const cb = e.target.closest("input[data-vac-id]");
    if (!cb) return;
    const id = cb.getAttribute("data-vac-id");
    state.completedVaccines[id] = cb.checked;
    saveState(state);
    render();
  });

  // إضافة سجل يومي (نفوق + علف + وزن)
  els.logForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const date = els.logDate.value || todayISO();
    const mortality = Math.max(0, parseInt(els.logMortality.value, 10) || 0);
    const feedKg = Math.max(0, parseFloat(els.logFeedKg.value) || 0);
    const avgWeightGrams = Math.max(0, parseFloat(els.logWeight.value) || 0);
    const note = (els.logNote.value || "").trim();

    if (mortality === 0 && feedKg === 0 && avgWeightGrams === 0 && !note) {
      alert("أدخل النفوق أو كمية العلف أو الوزن على الأقل لحفظ السجل اليومي.");
      return;
    }

    state.dailyLogs.push({
      id: `log-${Date.now()}`,
      date,
      mortality,
      feedKg,
      avgWeightGrams,
      note,
    });

    if (avgWeightGrams > 0) {
      state.avgWeightGrams = avgWeightGrams;
      els.avgWeight.value = avgWeightGrams;
    }

    saveState(state);
    els.logMortality.value = "";
    els.logFeedKg.value = "";
    els.logWeight.value = "";
    els.logNote.value = "";
    render();
  });

  // حذف سجل يومي
  els.logList.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-del-log]");
    if (!btn) return;
    const id = btn.getAttribute("data-del-log");
    state.dailyLogs = state.dailyLogs.filter((l) => l.id !== id);
    saveState(state);
    render();
  });

  // بدء دورة جديدة
  els.resetCycleBtn.addEventListener("click", () => {
    if (!confirm("هل تريد مسح السجلات الحالية وبدء دورة تسمين جديدة؟")) return;
    state = defaultState();
    saveState(state);
    populateSettingsInputs();
    render();
  });

  // مشاركة ملخص الدورة عبر واتساب
  els.shareCycleBtn.addEventListener("click", () => {
    const m = computeMetrics(state);
    const fcrText = m.fcr ? m.fcr.toFixed(2) : "غير محسوب بعد";
    const msg =
      `🐣 *ملخص دورة التسمين — ${state.flockName}*\n` +
      `• عمر القطيع: اليوم ${m.ageDays} من 45 (${feedStageLabel(m.ageDays)})\n` +
      `• الطيور الحية: ${m.aliveBirds} من ${m.initialBirds} (نسبة النفوق: ${m.mortalityPct.toFixed(1)}%)\n` +
      `• إجمالي العلف المستهلك: ${m.totalFeedKg.toFixed(1)} كجم | معامل التحويل FCR: ${fcrText}\n` +
      `• تكلفة الطائر التراكمية: ${formatSDG(m.costPerAliveBirdSDG)} ج.س\n\n` +
      `📲 تابع قطيعك وافحص الأمراض مجاناً وبدون إنترنت:\n${APP_PUBLIC_URL}`;
    window.open(buildWhatsAppUrl("", msg), "_blank", "noopener,noreferrer");
  });

  populateSettingsInputs();
  render();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
