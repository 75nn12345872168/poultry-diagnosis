// ============================================================
// وحدة دليل الصيدليات البيطرية ومورّدي الأعلاف في السودان
// 100% مجاني للتجار والمربين خلال فترة الإطلاق
// ============================================================

import {
  APP_PUBLIC_URL,
  DIRECTORY_LISTINGS,
  MERCHANT_CATEGORIES,
  OWNER_WHATSAPP_NUMBER,
  SUDAN_CITIES,
  buildWhatsAppUrl,
} from "./directory-data.js";

const LOCAL_CONTACTS_KEY = "poultry_local_vet_contacts_v1";

function loadLocalContacts() {
  try {
    const raw = localStorage.getItem(LOCAL_CONTACTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalContacts(list) {
  try {
    localStorage.setItem(LOCAL_CONTACTS_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("Failed to persist local contacts:", err);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function initDirectory() {
  const root = document.getElementById("tab-directory");
  if (!root) return;

  let activeCity = "الكل";
  let activeCategory = "all";
  let searchQuery = "";
  let localContacts = loadLocalContacts();

  const cityFilterWrap = document.getElementById("dir-city-filters");
  const catFilterSelect = document.getElementById("dir-category-filter");
  const searchInput = document.getElementById("dir-search-input");
  const listContainer = document.getElementById("dir-listings");

  // نموذج حفظ صيدلية/مورّد خاص بالمربي محلياً (أوفلاين)
  const localForm = document.getElementById("dir-local-add-form");
  const localName = document.getElementById("local-contact-name");
  const localCity = document.getElementById("local-contact-city");
  const localCat = document.getElementById("local-contact-category");
  const localPhone = document.getElementById("local-contact-phone");

  // بطاقة تسجيل التجار مجاناً عبر واتساب مع المالك
  const merchantNameInput = document.getElementById("merchant-reg-name");
  const merchantCityInput = document.getElementById("merchant-reg-city");
  const merchantTypeInput = document.getElementById("merchant-reg-type");
  const merchantPhoneInput = document.getElementById("merchant-reg-phone");
  const merchantWaBtn = document.getElementById("merchant-reg-whatsapp-btn");

  // تعبئة قوائم المدن
  const cityOptionsHtml = SUDAN_CITIES.map((c) => `<option value="${c}">${c}</option>`).join("");
  if (localCity) localCity.innerHTML = cityOptionsHtml;
  if (merchantCityInput) merchantCityInput.innerHTML = cityOptionsHtml;

  // رسم أزرار تصفية المدن
  function renderCityChips() {
    const cities = ["الكل", ...SUDAN_CITIES];
    cityFilterWrap.innerHTML = cities
      .map(
        (city) =>
          `<button type="button" class="chip-btn ${activeCity === city ? "active" : ""}" data-city="${city}">${city}</button>`
      )
      .join("");
  }

  function renderListings() {
    const combined = [
      ...localContacts.map((c) => ({ ...c, isLocalSaved: true })),
      ...DIRECTORY_LISTINGS,
    ];

    const q = searchQuery.trim().toLowerCase();
    const filtered = combined.filter((item) => {
      if (activeCity !== "الكل" && item.city !== activeCity) return false;
      if (activeCategory !== "all" && item.category !== activeCategory) return false;
      if (q) {
        const hay = `${item.name} ${item.city} ${item.area || ""} ${(item.services || []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      listContainer.innerHTML = `<div class="empty-state">لا توجد نتائج مطابقة للبحث في هذه الولاية حالياً. يمكنك تسجيل صيدليتك أو مصنعك مجاناً بالأسفل.</div>`;
      return;
    }

    listContainer.innerHTML = filtered
      .map((item) => {
        const catLabel = MERCHANT_CATEGORIES[item.category] || "خدمات دواجن";
        const servicesHtml = (item.services || [])
          .map((s) => `<span class="service-tag">${escapeHtml(s)}</span>`)
          .join("");

        let actionHtml = "";
        if (item.whatsapp) {
          const waMsg = `السلام عليكم، تواصلت معكم عبر تطبيق تشخيص أمراض الدواجن للاستفسار عن الأدوية/الأعلاف (${item.city}).`;
          const waUrl = buildWhatsAppUrl(item.whatsapp, waMsg);
          actionHtml = `
            <a class="btn-wa-link" href="${waUrl}" target="_blank" rel="noopener noreferrer">
              💬 تواصل عبر واتساب
            </a>`;
        } else {
          const claimMsg =
            `السلام عليكم، أرغب في تسجيل نشاطي مجاناً في دليل تطبيق تشخيص أمراض الدواجن:\n` +
            `• المدينة/الولاية: ${item.city}\n` +
            `• القسم: ${catLabel}\n` +
            `• اسم الصيدلية أو المصنع: \n` +
            `• رقم الواتساب للعملاء: \n` +
            `• العنوان المختصر: `;
          const waUrl = buildWhatsAppUrl(OWNER_WHATSAPP_NUMBER, claimMsg);
          actionHtml = `
            <a class="btn-wa-link btn-wa-outline" href="${waUrl}" target="_blank" rel="noopener noreferrer">
              📲 سجّل صيدليتك/مصنعك في ${escapeHtml(item.city)} مجاناً
            </a>`;
        }

        const badgeHtml = item.isLocalSaved
          ? `<span class="dir-badge badge-local">محفوظ على جهازك</span>`
          : item.verified
          ? `<span class="dir-badge badge-verified">شريك موثّق</span>`
          : `<span class="dir-badge badge-open">مقعد شريك مجاني</span>`;

        const delBtn = item.isLocalSaved
          ? `<button type="button" class="btn-icon-del" data-del-local="${item.id}" title="حذف">✕</button>`
          : "";

        return `
          <div class="dir-card">
            <div class="dir-card-head">
              <div>
                <div class="dir-title">${escapeHtml(item.name)}</div>
                <div class="dir-meta">📍 ${escapeHtml(item.city)}${item.area ? ` — ${escapeHtml(item.area)}` : ""} · ${escapeHtml(catLabel)}</div>
              </div>
              <div class="dir-head-right">
                ${badgeHtml}
                ${delBtn}
              </div>
            </div>
            ${servicesHtml ? `<div class="service-tags">${servicesHtml}</div>` : ""}
            <div class="dir-actions">${actionHtml}</div>
          </div>
        `;
      })
      .join("");
  }

  cityFilterWrap.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-city]");
    if (!btn) return;
    activeCity = btn.getAttribute("data-city");
    renderCityChips();
    renderListings();
  });

  catFilterSelect.addEventListener("change", () => {
    activeCategory = catFilterSelect.value;
    renderListings();
  });

  searchInput.addEventListener("input", () => {
    searchQuery = searchInput.value;
    renderListings();
  });

  // حفظ جهة اتصال بيطرية محلية على جهاز المربي
  localForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = (localName.value || "").trim();
    const phone = (localPhone.value || "").trim();
    if (!name || !phone) {
      alert("أدخل اسم الصيدلية أو المورّد ورقم الواتساب.");
      return;
    }

    localContacts.unshift({
      id: `local-${Date.now()}`,
      name,
      city: localCity.value || SUDAN_CITIES[0],
      category: localCat.value || "pharmacy",
      area: "جهة اتصال مضافة بواسطة المربي",
      services: ["تواصل سريع أوفلاين"],
      whatsapp: phone,
    });
    saveLocalContacts(localContacts);
    localName.value = "";
    localPhone.value = "";
    renderListings();
  });

  listContainer.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-del-local]");
    if (!btn) return;
    const id = btn.getAttribute("data-del-local");
    localContacts = localContacts.filter((c) => c.id !== id);
    saveLocalContacts(localContacts);
    renderListings();
  });

  // زر بطاقة تسجيل التجار والشركاء الأوائل مجاناً عبر واتساب
  merchantWaBtn.addEventListener("click", () => {
    const bName = (merchantNameInput.value || "").trim() || "(لم يُكتب بعد)";
    const bCity = merchantCityInput.value || SUDAN_CITIES[0];
    const bType = MERCHANT_CATEGORIES[merchantTypeInput.value] || "صيدلية بيطرية";
    const bPhone = (merchantPhoneInput.value || "").trim() || "(رقم هذا الواتساب)";

    const msg =
      `🏪 *طلب إضافة مجانية في دليل تطبيق تشخيص أمراض الدواجن*\n` +
      `• اسم الصيدلية / المصنع: ${bName}\n` +
      `• المدينة / الولاية: ${bCity}\n` +
      `• نوع النشاط: ${bType}\n` +
      `• رقم التواصل للعملاء: ${bPhone}\n\n` +
      `رابط التطبيق: ${APP_PUBLIC_URL}`;

    window.open(buildWhatsAppUrl(OWNER_WHATSAPP_NUMBER, msg), "_blank", "noopener,noreferrer");
  });

  renderCityChips();
  renderListings();
}
