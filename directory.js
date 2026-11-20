// ============================================================
// وحدة دليل الصيدليات البيطرية ومورّدي الأعلاف في السودان
// 100% مجاني للتجار والمربين — مربوط مباشرة بواتساب الإدارة (+249125939730)
// ============================================================

import {
  DEFAULT_MERCHANT_REGISTER_TEXT,
  DIRECTORY_LISTINGS,
  MERCHANT_CATEGORIES,
  OWNER_WHATSAPP_NUMBER,
  SUDAN_CITIES,
  buildWhatsAppUrl,
  getOwnerRegisterUrl,
} from "./directory-data.js";

const LOCAL_CONTACTS_KEY = "poultry_local_vet_contacts_v1";
const PREFERRED_CITY_KEY = "poultry_preferred_city_v1";

export function loadLocalContacts() {
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

export function getPreferredCity() {
  try {
    const saved = localStorage.getItem(PREFERRED_CITY_KEY);
    if (saved && SUDAN_CITIES.includes(saved)) return saved;
  } catch {
    // ignore
  }
  return SUDAN_CITIES[0];
}

export function setPreferredCity(city) {
  try {
    if (SUDAN_CITIES.includes(city)) localStorage.setItem(PREFERRED_CITY_KEY, city);
  } catch {
    // ignore
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// عرض الصيدليات البيطرية المقترحة حسب الولاية أسفل نتيجة الفحص مباشرة (تبويب 1)
export function renderResultPharmacies(city, listEl) {
  if (!listEl) return;
  const savedLocal = loadLocalContacts().map((c) => ({ ...c, isLocalSaved: true }));
  const all = [...savedLocal, ...DIRECTORY_LISTINGS];

  const matches = all.filter(
    (item) => item.city === city && (item.category === "pharmacy" || item.isLocalSaved)
  );
  const shown = matches.length > 0 ? matches : all.filter((item) => item.city === city);

  listEl.innerHTML = shown
    .slice(0, 3)
    .map((item) => {
      if (item.whatsapp) {
        const waMsg = `السلام عليكم، أجريت فحصاً عبر تطبيق تشخيص أمراض الدواجن وأحتاج استشارة/علاجاً في ${item.city}.`;
        const waUrl = buildWhatsAppUrl(item.whatsapp, waMsg);
        return `
          <div class="mini-pharm-item">
            <div class="mini-pharm-title">🏥 ${escapeHtml(item.name)}</div>
            <div class="mini-pharm-area">📍 ${escapeHtml(item.city)}${item.area ? ` — ${escapeHtml(item.area)}` : ""}</div>
            <a class="btn-wa-link" href="${waUrl}" target="_blank" rel="noopener noreferrer">💬 تواصل عبر واتساب</a>
          </div>
        `;
      }

      const registerUrl = getOwnerRegisterUrl(`الولاية/المدينة: ${item.city}`);
      return `
        <div class="mini-pharm-item">
          <div class="mini-pharm-title">🏥 ${escapeHtml(item.name)}</div>
          <div class="mini-pharm-area">📍 ${escapeHtml(item.area || item.city)}</div>
          <a class="btn-wa-link btn-wa-outline" href="${registerUrl}" target="_blank" rel="noopener noreferrer">
            📲 أضف صيدليتك في ${escapeHtml(item.city)} مجاناً عبر واتساب
          </a>
        </div>
      `;
    })
    .join("");
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

  const localForm = document.getElementById("dir-local-add-form");
  const localName = document.getElementById("local-contact-name");
  const localCity = document.getElementById("local-contact-city");
  const localCat = document.getElementById("local-contact-category");
  const localPhone = document.getElementById("local-contact-phone");

  const merchantNameInput = document.getElementById("merchant-reg-name");
  const merchantCityInput = document.getElementById("merchant-reg-city");
  const merchantTypeInput = document.getElementById("merchant-reg-type");
  const merchantPhoneInput = document.getElementById("merchant-reg-phone");
  const merchantWaLink = document.getElementById("merchant-reg-whatsapp-btn");

  const cityOptionsHtml = SUDAN_CITIES.map((c) => `<option value="${c}">${c}</option>`).join("");
  if (localCity) localCity.innerHTML = cityOptionsHtml;
  if (merchantCityInput) merchantCityInput.innerHTML = cityOptionsHtml;

  // تحديث رابط واتساب التسجيل المجاني (+249125939730) فورياً
  function syncMerchantWhatsappHref() {
    if (!merchantWaLink) return;
    const bName = (merchantNameInput?.value || "").trim();
    const bCity = merchantCityInput?.value || "";
    const bType = MERCHANT_CATEGORIES[merchantTypeInput?.value] || "";
    const bPhone = (merchantPhoneInput?.value || "").trim();

    if (!bName && !bPhone) {
      // الرابط المباشر النظيف تماماً حسب نص الإطلاق المعتمد
      merchantWaLink.href = buildWhatsAppUrl(OWNER_WHATSAPP_NUMBER, DEFAULT_MERCHANT_REGISTER_TEXT);
      return;
    }

    const details = [
      bName ? `• اسم النشاط: ${bName}` : "",
      bCity ? `• الولاية/المدينة: ${bCity}` : "",
      bType ? `• نوع النشاط: ${bType}` : "",
      bPhone ? `• رقم التواصل: ${bPhone}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    merchantWaLink.href = getOwnerRegisterUrl(details);
  }

  [merchantNameInput, merchantCityInput, merchantTypeInput, merchantPhoneInput].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", syncMerchantWhatsappHref);
    el.addEventListener("change", syncMerchantWhatsappHref);
  });
  syncMerchantWhatsappHref();

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
          const waUrl = getOwnerRegisterUrl(
            `• المدينة/الولاية: ${item.city}\n• القسم: ${catLabel}`
          );
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
    if (activeCity !== "الكل") setPreferredCity(activeCity);
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

  renderCityChips();
  renderListings();
}
