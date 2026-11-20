// ============================================================
// بيانات دليل الصيدليات البيطرية ومورّدي الأعلاف في السودان
// 100% مجاني خلال فترة الإطلاق — مربوط مباشرة بواتساب الإدارة
// ============================================================

export const APP_PUBLIC_URL = "https://75nn12345872168.github.io/poultry-diagnosis/";

// رقم واتساب الإدارة بالصيغة الدولية بدون + (+249125939730)
export const OWNER_WHATSAPP_NUMBER = "249125939730";

export const DEFAULT_MERCHANT_REGISTER_TEXT =
  "مرحباً، أرغب في إضافة صيدليتي البيطرية / نشاطي في دليل تطبيق تشخيص الدواجن";

export const SUDAN_CITIES = [
  "القضارف",
  "مدني",
  "الخرطوم/أمدرمان",
  "بورتسودان",
  "كسلا",
  "عطبرة",
];

export const MERCHANT_CATEGORIES = {
  pharmacy: "صيدلية بيطرية",
  feed: "مصنع / مورّد أعلاف",
  chicks: "كتاكيت وتجهيزات مزارع",
};

// قائمة المراكز البيطرية ومورّدي الأعلاف المصنّفة بالولايات
// (لا نعرض أرقام هواتف غير موثّقة؛ يُضاف كل شريك فور تواصله المجاني عبر واتساب)
export const DIRECTORY_LISTINGS = [
  {
    id: "gedaref-vet-hub",
    name: "منطقة الصيدليات البيطرية — القضارف",
    city: "القضارف",
    category: "pharmacy",
    area: "السوق العمومي ومحيط وزارة الثروة الحيوانية",
    services: ["لقاحات نيوكاسل وغومبورو", "مضادات الكوكسيديا والسالمونيلا", "فيتامينات وأملاح"],
    whatsapp: "",
    status: "open_slot",
    verified: false,
  },
  {
    id: "gedaref-feed-hub",
    name: "مورّدو الأعلاف وكسب السمسم — القضارف",
    city: "القضارف",
    category: "feed",
    area: "المنطقة الصناعية وسوق المحاصيل",
    services: ["علف بادي / نامي / ناهي", "ذرة وكسب سمسم ومركزات"],
    whatsapp: "",
    status: "open_slot",
    verified: false,
  },
  {
    id: "madani-vet-hub",
    name: "صيدليات ومراكز الأدوية البيطرية — مدني",
    city: "مدني",
    category: "pharmacy",
    area: "السوق الكبير وشارع الدكاترة / ود مدني",
    services: ["أدوية بيطرية وتحصينات مبردة", "استشارات تشخيص ميدانية"],
    whatsapp: "",
    status: "open_slot",
    verified: false,
  },
  {
    id: "madani-feed-hub",
    name: "مورّدو الأعلاف والكتاكيت — ولاية الجزيرة (مدني)",
    city: "مدني",
    category: "feed",
    area: "مدني والمنطقة الصناعية",
    services: ["أعلاف تسمين متوازنة", "كتاكيت عمر يوم وتجهيزات عنابر"],
    whatsapp: "",
    status: "open_slot",
    verified: false,
  },
  {
    id: "khartoum-vet-hub",
    name: "الصيدليات البيطرية — الخرطوم / أمدرمان",
    city: "الخرطوم/أمدرمان",
    category: "pharmacy",
    area: "أمدرمان (السوق الشعبي / الثورة / كرري)",
    services: ["لقاحات وتحصينات دواجن", "مضادات حيوية ومطهرات عنابر"],
    whatsapp: "",
    status: "open_slot",
    verified: false,
  },
  {
    id: "khartoum-feed-hub",
    name: "مصانع وموزّعو أعلاف الدواجن — الخرطوم / أمدرمان",
    city: "الخرطوم/أمدرمان",
    category: "feed",
    area: "أمدرمان والمنطقة الصناعية",
    services: ["علف تسمين 50 كجم", "مركزات أعلاف وإضافات غذائية"],
    whatsapp: "",
    status: "open_slot",
    verified: false,
  },
  {
    id: "portsudan-vet-hub",
    name: "الصيدليات البيطرية ومستوردو اللقاحات — بورتسودان",
    city: "بورتسودان",
    category: "pharmacy",
    area: "السوق الكبير والمنطقة التجارية",
    services: ["أدوية ولقاحات مستوردة", "فيتامينات ومضادات إجهاد حراري"],
    whatsapp: "",
    status: "open_slot",
    verified: false,
  },
  {
    id: "portsudan-feed-hub",
    name: "مورّدو الأعلاف والمركزات — بورتسودان",
    city: "بورتسودان",
    category: "feed",
    area: "المنطقة الصناعية ومحيط الميناء",
    services: ["مركزات أعلاف مستوردة", "أعلاف دواجن وتجهيزات مشارب"],
    whatsapp: "",
    status: "open_slot",
    verified: false,
  },
  {
    id: "kassala-vet-hub",
    name: "الصيدليات البيطرية ومورّدو المزارع — كسلا",
    city: "كسلا",
    category: "pharmacy",
    area: "السوق الكبير / شرق وغرب القاش",
    services: ["لقاحات نيوكاسل وIB وغومبورو", "أدوية معوية وتنفسية"],
    whatsapp: "",
    status: "open_slot",
    verified: false,
  },
  {
    id: "atbara-vet-hub",
    name: "الصيدليات البيطرية ومورّدو الأعلاف — عطبرة",
    city: "عطبرة",
    category: "pharmacy",
    area: "السوق الكبير والمنطقة الصناعية (نهر النيل)",
    services: ["أدوية بيطرية وتحصينات", "أعلاف تسمين ومستلزمات عنابر"],
    whatsapp: "",
    status: "open_slot",
    verified: false,
  },
];

export function buildWhatsAppUrl(phone, message) {
  const cleanPhone = String(phone || "").replace(/[^\d]/g, "");
  const encoded = encodeURIComponent(message);
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export function getOwnerRegisterUrl(extraDetails = "") {
  const msg = extraDetails
    ? `${DEFAULT_MERCHANT_REGISTER_TEXT}\n${extraDetails}`
    : DEFAULT_MERCHANT_REGISTER_TEXT;
  return buildWhatsAppUrl(OWNER_WHATSAPP_NUMBER, msg);
}
