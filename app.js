/* =====================================================================
   منظومة القرطاسية — app.js
   JavaScript خام (ES6) بلا مكتبات. البيانات تُحفظ في LocalStorage.

   المحتويات
   1) أدوات عامة               7) المخزون
   2) الأرقام والتواريخ واللغة   8) نقطة البيع
   3) التخزين المحلي            9) الفواتير
   4) البيانات التجريبية        10) العملاء والموردون
   5) النوافذ والإشعارات        11) الإعدادات والنسخ الاحتياطي
   6) لوحة المؤشرات            12) التنقل وربط الأحداث
   ===================================================================== */
(() => {
  'use strict';

  /* ---------- 1) أدوات عامة ---------- */
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  /* كل نص يدخله المستخدم يمرّ من هنا قبل وضعه في HTML (حماية من حقن الوسوم) */
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  /* ---------- 2) الأرقام والتواريخ واللغة ---------- */

  /* يقبل الأرقام العربية (٠-٩) والفارسية والفاصلة العشرية العربية */
  const toLatinDigits = (text) => String(text)
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660)
    .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06F0)
    .replace(/٫/g, '.');

  /* نص الحقل ← رقم، أو NaN إن لم يكن رقماً */
  const parseNumber = (text) => {
    const clean = toLatinDigits(text).trim();
    return /^-?(\d+\.?\d*|\.\d+)$/.test(clean) ? Number(clean) : NaN;
  };

  /* توحيد النص للبحث: بلا تشكيل، وتوحيد الهمزات والتاء المربوطة والألف المقصورة */
  const normalize = (text) => toLatinDigits(text).toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ').trim();

  const intFormat = new Intl.NumberFormat('en-US');
  const moneyFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const int = (n) => intFormat.format(n);
  const money = (n) => moneyFormat.format(n);

  const LOCALE = 'ar-u-nu-latn';
  const dateFormat = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });
  const dayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
  const shortDateFormat = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long' });
  const timeFormat = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
  const weekdayFormat = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
  const weekdayLetter = new Intl.DateTimeFormat(LOCALE, { weekday: 'narrow' });

  const startOfDay = (date = new Date()) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };
  const dayKey = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const formatWhen = (iso) => {
    const d = new Date(iso);
    if (dayKey(d) === dayKey(new Date())) return `اليوم ${timeFormat.format(d)}`;
    if (dayKey(d) === dayKey(addDays(new Date(), -1))) return `أمس ${timeFormat.format(d)}`;
    return `${shortDateFormat.format(d)}، ${timeFormat.format(d)}`;
  };

  /* المعدود في العربية يتغيّر مع العدد: صنف واحد، صنفان، 3 أصناف، 11 صنفاً، 100 صنف */
  const pluralRules = new Intl.PluralRules('ar');
  const count = (n, forms) => (forms[pluralRules.select(n)] ?? forms.other).replace('{n}', int(n));
  const WORDS = {
    item:     { zero: 'لا أصناف', one: 'صنف واحد', two: 'صنفان', few: '{n} أصناف', many: '{n} صنفاً', other: '{n} صنف' },
    piece:    { zero: 'لا قطع', one: 'قطعة واحدة', two: 'قطعتان', few: '{n} قطع', many: '{n} قطعة', other: '{n} قطعة' },
    invoice:  { zero: 'لا فواتير', one: 'فاتورة واحدة', two: 'فاتورتان', few: '{n} فواتير', many: '{n} فاتورة', other: '{n} فاتورة' },
    customer: { zero: 'لا عملاء', one: 'عميل واحد', two: 'عميلان', few: '{n} عملاء', many: '{n} عميلاً', other: '{n} عميل' },
    supplier: { zero: 'لا موردين', one: 'مورد واحد', two: 'موردان', few: '{n} موردين', many: '{n} مورداً', other: '{n} مورد' },
    lowStock: { one: 'صنف واحد مخزونه منخفض', two: 'صنفان مخزونهما منخفض', few: '{n} أصناف مخزونها منخفض', many: '{n} صنفاً مخزونها منخفض', other: '{n} صنف مخزونها منخفض' },
    outStock: { one: 'صنف واحد نفد', two: 'صنفان نفدا', few: '{n} أصناف نفدت', many: '{n} صنفاً نفدت', other: '{n} صنف نفدت' },
    left:     { one: 'بقيت قطعة واحدة', two: 'بقيت قطعتان', few: 'بقيت {n} قطع', many: 'بقيت {n} قطعة', other: 'بقيت {n} قطعة' },
  };

  /* ---------- 3) التخزين المحلي ---------- */
  const PREFIX = 'qartasia.';
  const memoryStore = {};     // بديل مؤقت إن منع المتصفح LocalStorage
  let storageWorks = true;

  function readStore(name, fallback) {
    let raw = null;
    try { raw = localStorage.getItem(PREFIX + name); }
    catch { storageWorks = false; return name in memoryStore ? memoryStore[name] : fallback; }
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  }
  function writeStore(name, value) {
    memoryStore[name] = value;
    try { localStorage.setItem(PREFIX + name, JSON.stringify(value)); storageWorks = true; }
    catch { storageWorks = false; }
  }

  const DEFAULT_SETTINGS = { storeName: 'قرطاسيتي', phone: '', address: '', currency: 'د.ل', nextInvoiceNo: 1, demo: false };
  const emptyCart = () => ({ items: [], customerId: '', discount: '' });

  /* حالة المنظومة كلها في كائن واحد */
  const db = { products: [], sales: [], contacts: [], settings: { ...DEFAULT_SETTINGS }, cart: emptyCart() };

  function save(...names) {
    names.forEach((name) => writeStore(name, db[name]));
    renderSaveState();
  }

  /* تنظيف البيانات المقروءة (من التخزين أو من نسخة احتياطية) حتى لا يدخل نوع خاطئ */
  const cleanId = (id) => String(id ?? '').replace(/[^\w-]/g, '').slice(0, 40) || uid();
  const cleanText = (text, max) => String(text ?? '').trim().slice(0, max);
  const cleanInt = (n) => Math.max(0, Math.floor(Number(n)) || 0);
  const cleanMoney = (n) => Math.max(0, round2(Number(n) || 0));

  function cleanProduct(p) {
    if (!p || typeof p !== 'object' || !cleanText(p.name, 60)) return null;
    return {
      id: cleanId(p.id), name: cleanText(p.name, 60), category: cleanText(p.category, 30) || 'غير مصنّف',
      price: cleanMoney(p.price), qty: cleanInt(p.qty), minQty: cleanInt(p.minQty),
    };
  }
  function cleanContact(c) {
    if (!c || typeof c !== 'object' || !cleanText(c.name, 60)) return null;
    return {
      id: cleanId(c.id), type: c.type === 'supplier' ? 'supplier' : 'customer', name: cleanText(c.name, 60),
      phone: cleanText(c.phone, 20), address: cleanText(c.address, 80), notes: cleanText(c.notes, 160),
    };
  }
  function cleanSale(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.items)) return null;
    const items = s.items
      .map((it) => ({ productId: cleanId(it && it.productId), name: cleanText(it && it.name, 60), price: cleanMoney(it && it.price), qty: cleanInt(it && it.qty) }))
      .filter((it) => it.name && it.qty > 0);
    if (!items.length) return null;
    const subtotal = round2(sum(items, (it) => it.price * it.qty));
    const discount = Math.min(cleanMoney(s.discount), subtotal);
    const date = new Date(s.at);
    return {
      id: cleanId(s.id), no: cleanInt(s.no), at: (Number.isNaN(date.getTime()) ? new Date() : date).toISOString(),
      customerId: s.customerId ? cleanId(s.customerId) : '', customerName: cleanText(s.customerName, 60),
      items, subtotal, discount, total: round2(subtotal - discount),
    };
  }
  function cleanSettings(s) {
    const src = s && typeof s === 'object' ? s : {};
    return {
      storeName: cleanText(src.storeName, 40) || DEFAULT_SETTINGS.storeName,
      phone: cleanText(src.phone, 20), address: cleanText(src.address, 80),
      currency: cleanText(src.currency, 6) || DEFAULT_SETTINGS.currency,
      nextInvoiceNo: Math.max(1, cleanInt(src.nextInvoiceNo)), demo: Boolean(src.demo),
    };
  }
  const cleanList = (list, cleaner) => (Array.isArray(list) ? list.map(cleaner).filter(Boolean) : []);

  function setData(data) {
    db.products = cleanList(data.products, cleanProduct);
    db.contacts = cleanList(data.contacts, cleanContact);
    db.sales = cleanList(data.sales, cleanSale).sort((a, b) => new Date(a.at) - new Date(b.at));
    db.settings = cleanSettings(data.settings);
    // رقم الفاتورة التالي لا يقلّ أبداً عن أكبر رقم مستعمل + 1
    db.settings.nextInvoiceNo = Math.max(db.settings.nextInvoiceNo, 1 + Math.max(0, ...db.sales.map((s) => s.no)));
    const cart = data.cart && typeof data.cart === 'object' ? data.cart : {};
    db.cart = {
      items: Array.isArray(cart.items) ? cart.items.map((it) => ({ productId: cleanId(it && it.productId), qty: cleanInt(it && it.qty) })) : [],
      customerId: cart.customerId ? cleanId(cart.customerId) : '',
      discount: cleanText(cart.discount, 12),
    };
    tidyCart();
  }

  function loadAll() {
    const settings = readStore('settings', null);
    if (settings === null) {            // أول تشغيل: نبدأ ببيانات تجريبية
      setData(demoData());
      save('products', 'sales', 'contacts', 'settings', 'cart');
      return;
    }
    setData({
      settings, products: readStore('products', []), sales: readStore('sales', []),
      contacts: readStore('contacts', []), cart: readStore('cart', null),
    });
  }

  /* ---------- 4) البيانات التجريبية ---------- */
  function demoData() {
    const P = (id, name, category, price, qty, minQty) => ({ id, name, category, price, qty, minQty });
    const products = [
      P('p01', 'قلم حبر جاف أزرق', 'أقلام', 1, 120, 20),
      P('p02', 'قلم رصاص HB', 'أقلام', 0.5, 200, 30),
      P('p03', 'قلم تحديد فسفوري', 'أقلام', 2.5, 45, 10),
      P('p04', 'قلم سبورة أسود', 'أقلام', 3, 8, 10),
      P('p05', 'دفتر 100 ورقة', 'دفاتر وكراسات', 4, 60, 15),
      P('p06', 'كراسة رسم A4', 'دفاتر وكراسات', 6.5, 25, 8),
      P('p07', 'دفتر سلك A5', 'دفاتر وكراسات', 5, 4, 10),
      P('p08', 'رزمة ورق A4 (500 ورقة)', 'ورق وطباعة', 28, 30, 6),
      P('p09', 'ألوان خشبية 12 لوناً', 'ألوان ورسم', 7.5, 35, 8),
      P('p10', 'ألوان مائية 12 لوناً', 'ألوان ورسم', 9, 0, 5),
      P('p11', 'ممحاة بيضاء', 'أدوات مدرسية', 0.75, 150, 25),
      P('p12', 'مبراة معدنية', 'أدوات مدرسية', 1, 90, 20),
      P('p13', 'مسطرة 30 سم', 'أدوات مدرسية', 1.5, 70, 15),
      P('p14', 'علبة هندسة', 'أدوات مدرسية', 8, 18, 6),
      P('p15', 'مقص مدرسي', 'أدوات مدرسية', 3.5, 22, 6),
      P('p16', 'صمغ عصا', 'أدوات مدرسية', 2, 3, 10),
      P('p17', 'ملف بلاستيكي A4', 'ملفات وتنظيم', 2, 80, 15),
      P('p18', 'دباسة مكتبية', 'أدوات مكتبية', 12, 14, 4),
      P('p19', 'شريط لاصق شفاف', 'أدوات مكتبية', 1.5, 55, 12),
      P('p20', 'آلة حاسبة علمية', 'أدوات مكتبية', 45, 9, 3),
    ];
    const contacts = [
      { id: 'c01', type: 'customer', name: 'مدرسة النور الابتدائية', phone: '0910000001', address: 'طرابلس', notes: 'طلبيات مع بداية كل فصل دراسي' },
      { id: 'c02', type: 'customer', name: 'مكتب الأمل للخدمات', phone: '0920000002', address: 'طرابلس', notes: '' },
      { id: 'c03', type: 'customer', name: 'أحمد سالم', phone: '', address: '', notes: 'ولي أمر' },
      { id: 'c04', type: 'supplier', name: 'شركة الأفق لتوريد القرطاسية', phone: '0910000004', address: 'طرابلس', notes: 'أقلام ودفاتر، توريد أسبوعي' },
      { id: 'c05', type: 'supplier', name: 'مؤسسة الورّاق للورق', phone: '0920000005', address: 'مصراتة', notes: 'ورق تصوير وطباعة' },
    ];

    // فواتير موزّعة على آخر 7 أيام نسبةً إلى لحظة التشغيل
    const now = new Date();
    const today = startOfDay(now);
    const at = (daysAgo, hour, minute) => { const d = addDays(today, -daysAgo); d.setHours(hour, minute, 0, 0); return d; };
    const recent = (minutesAgo) => new Date(Math.max(today.getTime() + 60000, now.getTime() - minutesAgo * 60000));
    const seeds = [
      [at(6, 10, 15), '', [['p01', 4], ['p05', 2], ['p11', 3]], 0],
      [at(6, 17, 40), 'c02', [['p08', 1], ['p17', 5]], 0],
      [at(5, 11, 5), 'c01', [['p02', 10], ['p11', 5], ['p12', 5]], 1],
      [at(5, 16, 20), '', [['p09', 1], ['p06', 1]], 0],
      [at(4, 9, 50), '', [['p03', 2], ['p01', 2]], 0],
      [at(4, 12, 30), '', [['p14', 1], ['p13', 2], ['p02', 4]], 0],
      [at(4, 18, 5), '', [['p19', 3]], 0],
      [at(3, 10, 40), '', [['p05', 3], ['p01', 3]], 0],
      [at(2, 11, 20), 'c02', [['p08', 2]], 0],
      [at(2, 15, 45), '', [['p18', 1], ['p19', 2], ['p17', 4]], 0],
      [at(2, 19, 10), 'c03', [['p09', 2], ['p15', 1]], 0],
      [at(1, 10, 5), '', [['p20', 1]], 0],
      [at(1, 13, 15), 'c01', [['p05', 4], ['p02', 6], ['p11', 4]], 0],
      [at(1, 17, 55), '', [['p03', 3], ['p12', 2]], 0],
      [recent(95), '', [['p01', 5], ['p05', 2]], 0],
      [recent(40), 'c02', [['p08', 1], ['p17', 3]], 0],
      [recent(10), '', [['p06', 1], ['p09', 1], ['p13', 1]], 0],
    ];
    const sales = seeds.map(([date, customerId, lines, discount], index) => {
      const items = lines.map(([id, qty]) => {
        const product = products.find((p) => p.id === id);
        return { productId: id, name: product.name, price: product.price, qty };
      });
      const customer = contacts.find((c) => c.id === customerId);
      return { id: `s${index + 1}`, no: index + 1, at: date.toISOString(), customerId, customerName: customer ? customer.name : '', items, discount };
    });
    return { products, contacts, sales, settings: { ...DEFAULT_SETTINGS, nextInvoiceNo: sales.length + 1, demo: true }, cart: emptyCart() };
  }

  /* ---------- 5) النوافذ والإشعارات والنماذج ---------- */
  const openDialog = (dialog) => (typeof dialog.showModal === 'function' ? dialog.showModal() : dialog.setAttribute('open', ''));
  const closeDialog = (dialog) => (typeof dialog.close === 'function' && dialog.open ? dialog.close() : dialog.removeAttribute('open'));

  function toast(message, isError = false) {
    const el = document.createElement('div');
    el.className = `toast${isError ? ' is-error' : ''}`;
    el.textContent = message;
    $('#toasts').append(el);
    setTimeout(() => el.remove(), 3400);
  }

  /* نافذة تأكيد تعيد Promise: true إذا وافق المستخدم */
  function confirmAction({ title, text, okLabel, danger = true }) {
    const dialog = $('#confirm-dialog');
    const ok = $('#confirm-ok');
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    ok.textContent = okLabel;
    ok.className = `btn ${danger ? 'danger-solid' : 'primary'}`;
    return new Promise((resolve) => {
      let answer = false;
      const onOk = () => { answer = true; closeDialog(dialog); };
      const onClose = () => { ok.removeEventListener('click', onOk); resolve(answer); };
      ok.addEventListener('click', onOk);
      dialog.addEventListener('close', onClose, { once: true });
      openDialog(dialog);
    });
  }

  /* رسالة الخطأ تظهر تحت الحقل نفسه وتُربط به لقارئات الشاشة */
  function setError(input, message) {
    const box = $(`#${input.id}-error`);
    if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    if (box) { box.textContent = message || ''; box.hidden = !message; }
  }
  const clearErrors = (form) => $$('.input', form).forEach((input) => setError(input, ''));
  const focusFirstError = (form) => { const bad = $('[aria-invalid="true"]', form); if (bad) bad.focus(); return !bad; };

  /* يتحقق من حقل رقمي: غير فارغ، رقم، غير سالب، وصحيح أو موجب عند الطلب */
  function numberField(input, messages, { integer = false, positive = false, max = 1000000 } = {}) {
    const raw = input.value.trim();
    const n = parseNumber(raw);
    let error = '';
    if (!raw) error = messages.empty;
    else if (Number.isNaN(n)) error = messages.invalid;
    else if (n < 0) error = messages.negative;
    else if (positive && n === 0) error = messages.zero;
    else if (integer && !Number.isInteger(n)) error = messages.integer;
    else if (n > max) error = `أكبر قيمة مسموحة ${int(max)}.`;
    setError(input, error);
    return error ? null : (integer ? n : round2(n));
  }
  const validPhone = (phone) => /^\+?[\d\s-]+$/.test(phone) && phone.replace(/\D/g, '').length >= 6 && phone.replace(/\D/g, '').length <= 15;

  function download(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- مشتقات مشتركة ---------- */
  const currency = () => esc(db.settings.currency);
  const stockState = (p) => (p.qty === 0 ? 'out' : p.qty <= p.minQty ? 'low' : 'ok');
  const needsRestock = (p) => stockState(p) !== 'ok';
  const productById = (id) => db.products.find((p) => p.id === id);
  const saleById = (id) => db.sales.find((s) => s.id === id);
  const categories = () => [...new Set(db.products.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'ar'));
  const pieces = (sale) => sum(sale.items, (it) => it.qty);
  const byName = (a, b) => a.name.localeCompare(b.name, 'ar');
  const emptyBox = (text, action = '') => `<div class="empty"><p>${text}</p>${action}</div>`;

  /* ---------- 6) لوحة المؤشرات ---------- */
  let chartMetric = 'revenue';
  const METRICS = {
    revenue:  { title: 'المبيعات في آخر 7 أيام', of: (sale) => sale.total, format: money, money: true },
    invoices: { title: 'عدد الفواتير في آخر 7 أيام', of: () => 1, format: int, noun: 'invoice' },
    pieces:   { title: 'القطع المباعة في آخر 7 أيام', of: pieces, format: int, noun: 'piece' },
  };

  /* آخر 7 أيام من الأقدم إلى اليوم، مع فواتير كل يوم */
  function lastWeek() {
    const today = startOfDay();
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i - 6);
      const key = dayKey(date);
      return { date, isToday: i === 6, sales: db.sales.filter((s) => dayKey(s.at) === key) };
    });
  }

  /* تدريج محور الصادات: خطوات مدوّرة (1، 2، 2.5، 5 × 10ⁿ) وأعلى علامة فوق أكبر قيمة */
  function axisTicks(maxValue, wholeNumbers) {
    const max = maxValue > 0 ? maxValue : (wholeNumbers ? 4 : 100);
    const raw = max / 4;
    const magnitude = 10 ** Math.floor(Math.log10(raw));
    let step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw && (!wholeNumbers || Number.isInteger(s)));
    if (!step) step = wholeNumbers ? 1 : 10 * magnitude;
    let top = Math.ceil(max / step) * step;
    if (top <= max) top += step;
    const ticks = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(round2(v));
    return ticks;
  }

  function renderChart(days) {
    const metric = METRICS[chartMetric];
    const values = days.map((day) => round2(sum(day.sales, metric.of)));
    const ticks = axisTicks(Math.max(...values), !metric.money);
    const top = ticks[ticks.length - 1];
    const box = $('#sales-chart');
    const narrow = box.clientWidth > 0 && box.clientWidth / 7 < 58;   // أعمدة ضيقة: حرف واحد لاسم اليوم
    const valueText = (v) => (metric.money ? `${money(v)} ${currency()}` : esc(count(v, WORDS[metric.noun])));
    const pct = (v) => +(v / top * 100).toFixed(2);

    const yLabels = ticks.map((t) => `<span style="bottom:${pct(t)}%">${int(t)}</span>`).join('');
    const lines = ticks.map((t) => `<i class="chart-line${t === 0 ? ' is-base' : ''}" style="bottom:${pct(t)}%"></i>`).join('');
    const columns = days.map((day, i) => {
      const label = dayFormat.format(day.date);
      return `<div class="chart-col${day.isToday ? ' is-today' : ''}" tabindex="0" role="img" style="--h:${pct(values[i])}%"
        aria-label="${esc(label)}: ${metric.money ? `${money(values[i])} ${currency()}` : esc(count(values[i], WORDS[metric.noun]))}">
        <span class="chart-bar" style="height:${pct(values[i])}%"></span>
        <span class="chart-tip"><strong class="num">${valueText(values[i])}</strong>${esc(label)}</span>
      </div>`;
    }).join('');
    const xLabels = days.map((day) => (day.isToday
      ? '<span class="is-today">اليوم</span>'
      : `<span>${esc((narrow ? weekdayLetter : weekdayFormat).format(day.date))}</span>`)).join('');

    box.innerHTML = `<div class="chart-y num" aria-hidden="true">${yLabels}</div>
      <div class="chart-plot">${lines}<div class="chart-cols">${columns}</div></div>
      <div class="chart-x" aria-hidden="true">${xLabels}</div>`;
    $('#chart-title').textContent = metric.title;
    const total = round2(sum(values, (v) => v));
    $('#chart-total').innerHTML = `المجموع <span class="num">${valueText(total)}</span>`;
  }

  function renderDashboard() {
    const low = db.products.filter((p) => stockState(p) === 'low');
    const out = db.products.filter((p) => stockState(p) === 'out');

    // السطر تحت العنوان: أهم ما يحتاج إلى انتباه اليوم
    let finding = 'كل الأصناف فوق حد التنبيه.';
    if (!db.products.length) finding = 'لا أصناف في المخزون بعد. أضف أول صنف من صفحة المخزون.';
    else if (low.length || out.length) {
      finding = [low.length && count(low.length, WORDS.lowStock), out.length && count(out.length, WORDS.outStock)]
        .filter(Boolean).join('، و') + '.';
    }
    $('#dash-finding').textContent = finding;
    $('#demo-notice').hidden = !db.settings.demo;

    // أرصدة المخزون
    $('#kpi-products').textContent = int(db.products.length);
    $('#kpi-units').textContent = int(sum(db.products, (p) => p.qty));
    $('#kpi-value').innerHTML = `${money(round2(sum(db.products, (p) => p.price * p.qty)))} <span class="unit">${currency()}</span>`;

    // مؤشرات اليوم + الرسم
    const days = lastWeek();
    const todaySales = days[6].sales;
    $('#tab-revenue').innerHTML = `${money(round2(sum(todaySales, (s) => s.total)))} <span class="unit">${currency()}</span>`;
    $('#tab-invoices').textContent = int(todaySales.length);
    $('#tab-pieces').textContent = int(sum(todaySales, pieces));
    $$('.kpi-tab').forEach((tab) => {
      const selected = tab.dataset.metric === chartMetric;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    renderChart(days);

    // المخزون المنخفض: الأشدّ نقصاً أولاً
    const urgent = [...out, ...low.sort((a, b) => a.qty / a.minQty - b.qty / b.minQty)];
    $('#low-list').innerHTML = urgent.slice(0, 5).map((p) => {
      const scale = Math.max(p.minQty * 2, 1);
      return `<li class="row">
        <span class="row-title">${esc(p.name)}</span>
        ${p.qty === 0 ? '<span class="pill neg">نفد</span>' : `<span class="row-figure">${esc(count(p.qty, WORDS.left))}</span>`}
        <button type="button" class="btn btn-sm" data-action="restock" data-id="${p.id}" data-key="restock:${p.id}">تزويد</button>
        <span class="stock-meter" aria-hidden="true">
          <span class="stock-bar"><span class="stock-bar-fill" style="width:${Math.min(p.qty / scale, 1) * 100}%"></span><span class="stock-bar-tick" style="inset-inline-start:${p.minQty / scale * 100}%"></span></span>
          <span class="meta">حد التنبيه <span class="num">${int(p.minQty)}</span></span>
        </span>
      </li>`;
    }).join('') || `<li class="empty">${db.products.length ? 'كل الأصناف فوق حد التنبيه.' : 'لا أصناف في المخزون بعد.'}</li>`;
    $('#low-all').hidden = urgent.length === 0;

    // آخر الفواتير
    const recent = db.sales.slice(-5).reverse();
    $('#recent-invoices').innerHTML = recent.length ? `<table class="data-table">
      <thead><tr><th scope="col">الفاتورة</th><th scope="col" class="c-extra">الوقت</th><th scope="col" class="c-extra">العميل</th><th scope="col" class="c-extra num">القطع</th><th scope="col" class="num">الإجمالي (${currency()})</th></tr></thead>
      <tbody>${recent.map((s) => `<tr>
        <td class="c-main"><button type="button" class="cell-link" data-action="view-invoice" data-id="${s.id}">رقم <span class="num">${int(s.no)}</span></button>
          <span class="sub sub-narrow">${esc(formatWhen(s.at))}${s.customerName ? `، ${esc(s.customerName)}` : ''}</span></td>
        <td class="c-extra">${esc(formatWhen(s.at))}</td>
        <td class="c-extra">${s.customerName ? `<span class="cell-clip">${esc(s.customerName)}</span>` : '<span class="meta">—</span>'}</td>
        <td class="c-extra num">${int(pieces(s))}</td>
        <td class="c-key num">${money(s.total)}</td>
      </tr>`).join('')}</tbody></table>`
      : emptyBox('لم تُسجَّل أي فاتورة بعد.', '<a class="btn" href="#pos">بيع جديد</a>');

    // الأكثر مبيعاً في آخر 7 أيام
    const sold = new Map();
    days.forEach((day) => day.sales.forEach((s) => s.items.forEach((it) => {
      sold.set(it.productId, { name: it.name, qty: (sold.get(it.productId)?.qty || 0) + it.qty });
    })));
    const topSellers = [...sold.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
    const best = topSellers.length ? topSellers[0].qty : 1;
    $('#top-list').innerHTML = topSellers.map((it) => `<li class="rank">
        <span class="row-title">${esc(it.name)}</span>
        <span class="row-figure num">${esc(count(it.qty, WORDS.piece))}</span>
        <span class="rank-bar" aria-hidden="true"><span style="width:${it.qty / best * 100}%"></span></span>
      </li>`).join('') || '<li class="empty">لا مبيعات في آخر 7 أيام.</li>';
  }

  /* ---------- 7) المخزون ---------- */
  const inv = { tab: 'all', query: '', category: '', sortKey: 'name', sortDir: 1, limit: 100 };
  let editingProductId = null;
  let restockId = null;

  const statusCell = (p) => ({
    out: '<span class="pill neg">نفد</span>',
    low: '<span class="pill warn">منخفض</span>',
    ok: '<span class="meta">متوفر</span>',
  }[stockState(p)]);

  function renderInventory() {
    const totalUnits = sum(db.products, (p) => p.qty);
    $('#inv-summary').innerHTML = db.products.length
      ? `${esc(count(db.products.length, WORDS.item))}، فيها ${esc(count(totalUnits, WORDS.piece))} بقيمة <span class="num">${money(round2(sum(db.products, (p) => p.price * p.qty)))}</span> ${currency()}.`
      : 'لا أصناف في المخزون بعد.';

    $('#inv-count-all').textContent = int(db.products.length);
    $('#inv-count-low').textContent = int(db.products.filter(needsRestock).length);
    $$('[data-inv-tab]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.invTab === inv.tab)));

    // قائمة الفئات (تبقى على المختار ما دام موجوداً)
    const cats = categories();
    if (!cats.includes(inv.category)) inv.category = '';
    $('#inv-category').innerHTML = `<option value="">كل الفئات</option>${cats.map((c) => `<option value="${esc(c)}"${c === inv.category ? ' selected' : ''}>${esc(c)}</option>`).join('')}`;

    // التصفية ثم الترتيب
    const q = normalize(inv.query);
    const rows = db.products
      .filter((p) => inv.tab === 'all' || needsRestock(p))
      .filter((p) => !inv.category || p.category === inv.category)
      .filter((p) => !q || normalize(`${p.name} ${p.category}`).includes(q))
      .sort((a, b) => {
        const x = a[inv.sortKey]; const y = b[inv.sortKey];
        const order = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'ar');
        return (order || byName(a, b)) * inv.sortDir;
      });

    $$('.sort-btn').forEach((btn) => {
      const active = btn.dataset.sort === inv.sortKey;
      btn.classList.toggle('is-desc', active && inv.sortDir === -1);
      btn.closest('th').toggleAttribute('aria-sort', active);
      if (active) btn.closest('th').setAttribute('aria-sort', inv.sortDir === 1 ? 'ascending' : 'descending');
      const arrow = $('.icon', btn);
      if (active && !arrow) btn.insertAdjacentHTML('beforeend', icon('sort'));
      if (!active && arrow) arrow.remove();
    });

    const shown = rows.slice(0, inv.limit);
    $('#inv-body').innerHTML = shown.map((p) => `<tr>
      <td class="c-main"><span class="cell-title">${esc(p.name)}</span>
        <span class="sub sub-md">${esc(p.category)}</span>
        <span class="sub sub-narrow">${esc(p.category)}، <span class="num">${money(p.price)}</span> ${currency()} ${p.qty === 0 || stockState(p) === 'low' ? statusCell(p) : ''}</span></td>
      <td class="c-extra c-md-hide">${esc(p.category)}</td>
      <td class="c-extra num">${money(p.price)}</td>
      <td class="c-key num">${int(p.qty)}</td>
      <td class="c-extra">${statusCell(p)}</td>
      <td class="c-actions"><span class="row-actions">
        <button type="button" class="icon-btn" data-action="restock" data-id="${p.id}" data-key="restock:${p.id}" title="تزويد المخزون" aria-label="تزويد مخزون ${esc(p.name)}">${icon('restock')}</button>
        <button type="button" class="icon-btn" data-action="edit-product" data-id="${p.id}" data-key="edit:${p.id}" title="تعديل" aria-label="تعديل ${esc(p.name)}">${icon('edit')}</button>
        <button type="button" class="icon-btn danger" data-action="delete-product" data-id="${p.id}" title="حذف" aria-label="حذف ${esc(p.name)}">${icon('trash')}</button>
      </span></td>
    </tr>`).join('');

    $('#inv-table').hidden = rows.length === 0;
    $('#inv-shown').textContent = rows.length === db.products.length ? '' : `${count(rows.length, WORDS.item)} من ${int(db.products.length)}`;
    $('#inv-more').hidden = rows.length <= inv.limit;
    $('#inv-range').textContent = `معروض ${int(shown.length)} من ${int(rows.length)}`;

    let empty = '';
    if (!db.products.length) empty = emptyBox('لا أصناف في المخزون بعد.', `<button type="button" class="btn primary" data-action="add-product">${icon('plus')}إضافة صنف</button>`);
    else if (!rows.length && (q || inv.category)) empty = emptyBox('لا صنف يطابق البحث.', '<button type="button" class="btn" data-action="inv-reset">مسح البحث</button>');
    else if (!rows.length) empty = emptyBox('كل الأصناف فوق حد التنبيه، ولا شيء يحتاج إلى تزويد.');
    $('#inv-empty').innerHTML = empty;
  }

  function openProductForm(id = null) {
    const form = $('#product-form');
    const p = id ? productById(id) : null;
    editingProductId = p ? p.id : null;
    form.reset();
    clearErrors(form);
    $('#product-dialog-title').textContent = p ? 'تعديل الصنف' : 'إضافة صنف';
    $('#product-submit').textContent = p ? 'حفظ التعديلات' : 'إضافة الصنف';
    $('#category-options').innerHTML = categories().map((c) => `<option value="${esc(c)}"></option>`).join('');
    form.elements.name.value = p ? p.name : '';
    form.elements.category.value = p ? p.category : (inv.category || '');
    form.elements.price.value = p ? p.price : '';
    form.elements.qty.value = p ? p.qty : '';
    form.elements.minQty.value = p ? p.minQty : 5;
    openDialog($('#product-dialog'));
    form.elements.name.focus();
  }

  function submitProduct(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.elements.name.value.trim();
    const category = form.elements.category.value.trim();
    const duplicate = db.products.some((p) => p.id !== editingProductId && normalize(p.name) === normalize(name));

    setError(form.elements.name, !name ? 'اكتب اسم الصنف.' : duplicate ? 'يوجد صنف آخر بهذا الاسم.' : '');
    setError(form.elements.category, category ? '' : 'اكتب الفئة أو اخترها من القائمة.');
    const price = numberField(form.elements.price, {
      empty: 'أدخل السعر.', invalid: 'اكتب السعر بالأرقام، مثل 2.50.',
      negative: 'لا يمكن أن يكون السعر سالباً.', zero: 'يجب أن يكون السعر أكبر من صفر.',
    }, { positive: true });
    const qty = numberField(form.elements.qty, {
      empty: 'أدخل الكمية المتوفرة.', invalid: 'اكتب الكمية بالأرقام، مثل 12.',
      negative: 'لا يمكن أن تكون الكمية سالبة.', integer: 'الكمية عدد صحيح بلا كسور.',
    }, { integer: true });
    const minQty = numberField(form.elements.minQty, {
      empty: 'أدخل حد التنبيه، أو صفراً لإيقاف التنبيه.', invalid: 'اكتب حد التنبيه بالأرقام، مثل 5.',
      negative: 'لا يمكن أن يكون حد التنبيه سالباً.', integer: 'حد التنبيه عدد صحيح بلا كسور.',
    }, { integer: true });
    if (!focusFirstError(form)) return;

    const data = { name, category, price, qty, minQty };
    if (editingProductId) Object.assign(productById(editingProductId), data);
    else db.products.push({ id: uid(), ...data });
    tidyCart();
    save('products', 'cart');
    closeDialog($('#product-dialog'));
    toast(editingProductId ? 'تم حفظ التعديلات' : 'تمت إضافة الصنف');
    render();
  }

  async function deleteProduct(id) {
    const p = productById(id);
    if (!p) return;
    const ok = await confirmAction({
      title: 'حذف الصنف؟',
      text: `سيُحذف «${p.name}» من المخزون نهائياً. الفواتير السابقة التي تتضمنه تبقى كما هي.`,
      okLabel: 'حذف الصنف',
    });
    if (!ok) return;
    db.products = db.products.filter((x) => x.id !== id);
    tidyCart();
    save('products', 'cart');
    toast('تم حذف الصنف');
    render();
  }

  function openRestock(id) {
    const p = productById(id);
    if (!p) return;
    restockId = id;
    const form = $('#restock-form');
    form.reset();
    clearErrors(form);
    $('#restock-name').textContent = p.name;
    $('#restock-current').textContent = `الرصيد الحالي: ${count(p.qty, WORDS.piece)}، وحد التنبيه ${int(p.minQty)}.`;
    updateRestockPreview();
    openDialog($('#restock-dialog'));
    form.elements.amount.focus();
  }
  function updateRestockPreview() {
    const p = productById(restockId);
    const n = parseNumber($('#restock-qty').value);
    const valid = Number.isInteger(n) && n > 0;
    $('#restock-after').textContent = p && valid ? `الرصيد بعد التزويد: ${int(p.qty + n)}` : '';
  }
  function submitRestock(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const p = productById(restockId);
    const amount = numberField(form.elements.amount, {
      empty: 'أدخل الكمية الواردة.', invalid: 'اكتب الكمية بالأرقام، مثل 24.',
      negative: 'لا يمكن أن تكون الكمية الواردة سالبة.', zero: 'يجب أن تكون الكمية الواردة أكبر من صفر.',
      integer: 'الكمية عدد صحيح بلا كسور.',
    }, { integer: true, positive: true });
    if (!p || !focusFirstError(form)) return;
    p.qty += amount;
    save('products');
    closeDialog($('#restock-dialog'));
    toast(`أُضيفت ${count(amount, WORDS.piece)} إلى «${p.name}»`);
    render();
  }

  /* ---------- 8) نقطة البيع ---------- */
  const pos = { query: '', category: '' };

  /* يحذف من السلة ما حُذف من المخزون، ويقصّ الكمية على المتوفر */
  function tidyCart() {
    db.cart.items = db.cart.items
      .map((line) => { const p = productById(line.productId); return p ? { productId: p.id, qty: Math.min(line.qty, p.qty) } : null; })
      .filter((line) => line && line.qty > 0);
    if (!db.contacts.some((c) => c.id === db.cart.customerId && c.type === 'customer')) db.cart.customerId = '';
  }
  const cartLines = () => db.cart.items.map((line) => {
    const product = productById(line.productId);
    return { product, qty: line.qty, total: round2(product.price * line.qty) };
  });
  const cartQty = (id) => db.cart.items.find((line) => line.productId === id)?.qty || 0;

  /* المجموع والخصم والإجمالي، مع رسالة إن كان الخصم غير صالح */
  function cartTotals() {
    const lines = cartLines();
    const subtotal = round2(sum(lines, (line) => line.total));
    const raw = db.cart.discount.trim();
    let discount = 0;
    let error = '';
    if (raw && lines.length) {
      const n = parseNumber(raw);
      if (Number.isNaN(n)) error = 'اكتب الخصم بالأرقام، مثل 1.50.';
      else if (n < 0) error = 'لا يمكن أن يكون الخصم سالباً.';
      else if (n > subtotal) error = 'الخصم أكبر من مجموع الفاتورة.';
      else discount = round2(n);
    }
    return { lines, subtotal, discount, total: round2(subtotal - discount), error };
  }

  function setCartQty(id, qty) {
    const p = productById(id);
    if (!p) return;
    let wanted = Math.floor(qty);
    if (wanted > p.qty) {
      wanted = p.qty;
      toast(`المتوفر من «${p.name}» ${count(p.qty, WORDS.piece)} فقط.`, true);
    }
    const line = db.cart.items.find((x) => x.productId === id);
    if (wanted <= 0) db.cart.items = db.cart.items.filter((x) => x.productId !== id);
    else if (line) line.qty = wanted;
    else db.cart.items.push({ productId: id, qty: wanted });
    save('cart');
    render();
  }

  function visibleProducts() {
    const q = normalize(pos.query);
    return db.products
      .filter((p) => !pos.category || p.category === pos.category)
      .filter((p) => !q || normalize(`${p.name} ${p.category}`).includes(q))
      .sort(byName);
  }

  function renderPOS() {
    const todaySales = db.sales.filter((s) => dayKey(s.at) === dayKey(new Date()));
    $('#pos-summary').innerHTML = todaySales.length
      ? `بيعت اليوم ${esc(count(todaySales.length, WORDS.invoice))} بمجموع <span class="num">${money(round2(sum(todaySales, (s) => s.total)))}</span> ${currency()}.`
      : 'لا مبيعات اليوم بعد.';

    const cats = categories();
    if (!cats.includes(pos.category)) pos.category = '';
    $('#pos-categories').innerHTML = ['', ...cats].map((c) => (
      `<button type="button" class="chip" data-category="${esc(c)}" data-key="chip:${esc(c)}" aria-pressed="${c === pos.category}">${c ? esc(c) : 'الكل'}</button>`
    )).join('');

    const list = visibleProducts();
    $('#pos-grid').innerHTML = list.map((p) => {
      const inCart = cartQty(p.id);
      const left = p.qty - inCart;
      const stock = p.qty === 0 ? '<span class="pill neg">نفد</span>'
        : left === 0 ? '<span class="tile-stock">كل المتوفر في الفاتورة</span>'
        : `<span class="tile-stock">متوفر <span class="num">${int(left)}</span></span>`;
      return `<button type="button" class="tile${inCart ? ' is-in-cart' : ''}" data-action="add-to-cart" data-id="${p.id}" data-key="tile:${p.id}"${left <= 0 ? ' disabled' : ''}>
        <span class="tile-top"><span class="tile-name">${esc(p.name)}</span>${inCart ? `<span class="pill">× <span class="num">${int(inCart)}</span></span>` : ''}</span>
        <span class="tile-foot"><span class="tile-price"><span class="num">${money(p.price)}</span> <span class="unit">${currency()}</span></span>${stock}</span>
      </button>`;
    }).join('') || (db.products.length
      ? emptyBox('لا صنف يطابق البحث.', '<button type="button" class="btn" data-action="pos-reset">مسح البحث</button>')
      : emptyBox('لا أصناف للبيع بعد.', '<a class="btn" href="#inventory">الذهاب إلى المخزون</a>'));

    renderCart();
  }

  function renderCart() {
    const { lines, subtotal, discount, total, error } = cartTotals();
    $('#cart-no').innerHTML = `فاتورة رقم <span class="num">${int(db.settings.nextInvoiceNo)}</span>`;
    $('#cart-date').textContent = dateFormat.format(new Date());

    $('#cart-lines').innerHTML = lines.map(({ product: p, qty, total: lineTotal }) => `<li class="cart-line">
      <span class="cart-line-name">${esc(p.name)}</span>
      <span class="cart-line-total num">${money(lineTotal)}</span>
      <span class="cart-line-controls">
        <span class="stepper">
          <button type="button" data-action="cart-dec" data-id="${p.id}" data-key="dec:${p.id}" aria-label="إنقاص كمية ${esc(p.name)}"${qty <= 1 ? ' disabled' : ''}>${icon('minus')}</button>
          <input class="num" type="text" inputmode="numeric" value="${qty}" data-cart-qty="${p.id}" data-key="qty:${p.id}" aria-label="كمية ${esc(p.name)}">
          <button type="button" data-action="cart-inc" data-id="${p.id}" data-key="inc:${p.id}" aria-label="زيادة كمية ${esc(p.name)}"${qty >= p.qty ? ' disabled' : ''}>${icon('plus')}</button>
        </span>
        <span>× <span class="num">${money(p.price)}</span></span>
      </span>
      <button type="button" class="icon-btn danger" data-action="cart-remove" data-id="${p.id}" aria-label="حذف ${esc(p.name)} من الفاتورة" title="حذف من الفاتورة">${icon('trash')}</button>
    </li>`).join('') || '<li class="cart-empty">الفاتورة فارغة. اختر صنفاً من القائمة لإضافته.</li>';

    const customers = db.contacts.filter((c) => c.type === 'customer').sort(byName);
    $('#cart-customer').innerHTML = `<option value="">بيع نقدي بلا عميل</option>${customers.map((c) => `<option value="${c.id}"${c.id === db.cart.customerId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}`;

    const discountInput = $('#cart-discount');
    if (document.activeElement !== discountInput) discountInput.value = db.cart.discount;
    setError(discountInput, error);

    $('#cart-subtotal').textContent = money(subtotal);
    $('#cart-discount-row').hidden = discount === 0;
    $('#cart-discount-value').innerHTML = `<span class="ltr">−${money(discount)}</span>`;
    $('#cart-total').textContent = money(total);
    $('#checkout').disabled = lines.length === 0 || Boolean(error);
    $('#cart-clear').hidden = lines.length === 0;

    $('#cart-bar').hidden = lines.length === 0;
    $('#cart-bar-count').textContent = count(sum(lines, (line) => line.qty), WORDS.piece);
    $('#cart-bar-total').textContent = money(total);
  }

  function checkout() {
    tidyCart();
    const { lines, subtotal, discount, total, error } = cartTotals();
    if (!lines.length) { toast('الفاتورة فارغة. أضف صنفاً أولاً.', true); render(); return; }
    if (error) { $('#cart-discount').focus(); return; }

    const customer = db.contacts.find((c) => c.id === db.cart.customerId);
    const sale = {
      id: uid(), no: db.settings.nextInvoiceNo, at: new Date().toISOString(),
      customerId: customer ? customer.id : '', customerName: customer ? customer.name : '',
      // نحفظ الاسم والسعر في الفاتورة نفسها كي لا تتغيّر إن عُدّل الصنف لاحقاً
      items: lines.map(({ product, qty }) => ({ productId: product.id, name: product.name, price: product.price, qty })),
      subtotal, discount, total,
    };
    lines.forEach(({ product, qty }) => { product.qty -= qty; });   // خصم الكميات من المخزون
    db.sales.push(sale);
    db.settings.nextInvoiceNo += 1;
    db.cart = emptyCart();
    $('#cart-discount').value = '';
    save('products', 'sales', 'settings', 'cart');
    render();
    showInvoice(sale.id, true);
  }

  /* ---------- 9) الفواتير ---------- */
  const salesView = { query: '', period: 'all' };
  let openInvoiceId = null;

  /* محتوى الإيصال: يُستعمل في النافذة وفي الطباعة وفي الملف المنزَّل */
  function invoiceHtml(sale) {
    const { storeName, address, phone } = db.settings;
    const contact = [address && esc(address), phone && `هاتف <span class="ltr num">${esc(phone)}</span>`].filter(Boolean).join('، ');
    return `<header class="receipt-head">
        <strong>${esc(storeName)}</strong>
        ${contact ? `<p class="receipt-contact">${contact}</p>` : ''}
      </header>
      <p class="receipt-meta receipt-customer"><span>فاتورة رقم <b class="num">${int(sale.no)}</b></span><span>${esc(dateFormat.format(new Date(sale.at)))}، ${esc(timeFormat.format(new Date(sale.at)))}</span></p>
      ${sale.customerName ? `<p class="receipt-customer">العميل: <b>${esc(sale.customerName)}</b></p>` : ''}
      <table class="invoice-items">
        <thead><tr><th scope="col">الصنف</th><th scope="col" class="num">الكمية</th><th scope="col" class="num">السعر</th><th scope="col" class="num">الإجمالي</th></tr></thead>
        <tbody>${sale.items.map((it) => `<tr><td>${esc(it.name)}</td><td class="num">${int(it.qty)}</td><td class="num">${money(it.price)}</td><td class="num">${money(round2(it.price * it.qty))}</td></tr>`).join('')}</tbody>
      </table>
      <dl class="totals">
        ${sale.discount ? `<div class="total-row"><dt>المجموع</dt><dd class="num">${money(sale.subtotal)}</dd></div>
        <div class="total-row"><dt>الخصم</dt><dd class="num"><span class="ltr">−${money(sale.discount)}</span></dd></div>` : ''}
        <div class="total-row total-grand"><dt>الإجمالي</dt><dd><span class="num">${money(sale.total)}</span> <span class="unit">${currency()}</span></dd></div>
      </dl>
      <p class="receipt-thanks">شكراً لتعاملكم معنا</p>`;
  }

  function showInvoice(id, justSold = false) {
    const sale = saleById(id);
    if (!sale) return;
    openInvoiceId = id;
    $('#invoice-dialog-title').textContent = justSold ? `تم البيع: فاتورة رقم ${int(sale.no)}` : `فاتورة رقم ${int(sale.no)}`;
    $('#invoice-receipt').innerHTML = invoiceHtml(sale);
    openDialog($('#invoice-dialog'));
  }

  function printInvoice() {
    const sale = saleById(openInvoiceId);
    if (!sale) return;
    $('#print-area').innerHTML = `<div class="receipt">${invoiceHtml(sale)}</div>`;
    window.print();
  }

  /* ملف HTML مستقل للفاتورة: يُفتح في أي متصفح ويُطبع أو يُحفظ PDF */
  const INVOICE_CSS = `body{margin:0;padding:24px;background:#f2f4f7;color:#0a0a0a;font:15px/1.6 "Cairo","Segoe UI",Tahoma,sans-serif}
.receipt{max-width:420px;margin:0 auto;padding:24px;background:#fff;border:1px solid #e1e4e8;border-radius:8px}
.receipt-head{padding-bottom:12px;border-bottom:1px solid #ddd;text-align:center}.receipt-head strong{display:block;font-size:18px}
p{margin:0}.receipt-meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 12px}
.receipt-contact,.receipt-customer,.receipt-thanks,th,dt,.unit{color:#5f6368;font-size:13px}.receipt-customer{padding-top:10px}.receipt-customer b{color:#0a0a0a}
table{width:100%;border-collapse:collapse;margin-top:10px}th,td{padding:7px 0 7px 10px;border-bottom:1px solid #e5e5e5;text-align:start;font-weight:400}
.num{font-variant-numeric:tabular-nums}th.num,td.num{text-align:right;white-space:nowrap}.ltr{direction:ltr;unicode-bidi:isolate;display:inline-block}
dl{margin:12px 0}dd{margin:0}.total-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.total-grand dt{color:#0a0a0a;font-size:15px;font-weight:700}.total-grand dd{font-size:26px;font-weight:700}
.receipt-thanks{padding-top:12px;border-top:1px solid #ddd;text-align:center}
@media print{body{padding:0;background:#fff}.receipt{padding:0;border:0}}`;

  function downloadInvoice() {
    const sale = saleById(openInvoiceId);
    if (!sale) return;
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>فاتورة رقم ${sale.no} - ${esc(db.settings.storeName)}</title>
<style>${INVOICE_CSS}</style>
</head>
<body><div class="receipt">${invoiceHtml(sale)}</div></body>
</html>`;
    download(`invoice-${String(sale.no).padStart(4, '0')}.html`, html, 'text/html;charset=utf-8');
    toast('تم تنزيل الفاتورة');
  }

  async function voidInvoice(id) {
    const sale = saleById(id);
    if (!sale) return;
    const ok = await confirmAction({
      title: `إلغاء الفاتورة رقم ${int(sale.no)}؟`,
      text: `سيُحذف سجل الفاتورة، وتعود كمياتها (${count(pieces(sale), WORDS.piece)}) إلى المخزون للأصناف التي ما زالت موجودة.`,
      okLabel: 'إلغاء الفاتورة',
    });
    if (!ok) return;
    sale.items.forEach((it) => { const p = productById(it.productId); if (p) p.qty += it.qty; });
    db.sales = db.sales.filter((s) => s.id !== id);
    save('products', 'sales');
    toast(`أُلغيت الفاتورة رقم ${int(sale.no)}`);
    render();
  }

  function renderInvoices() {
    const today = startOfDay();
    const from = { today, week: addDays(today, -6), month: new Date(today.getFullYear(), today.getMonth(), 1), all: new Date(0) }[salesView.period];
    const q = normalize(salesView.query);
    const rows = db.sales
      .filter((s) => new Date(s.at) >= from)
      .filter((s) => !q || normalize(`${s.no} ${s.customerName} ${s.items.map((it) => it.name).join(' ')}`).includes(q))
      .reverse();

    $$('[data-period]').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.period === salesView.period)));
    $('#sales-summary').innerHTML = rows.length
      ? `${esc(count(rows.length, WORDS.invoice))} بمجموع <span class="num">${money(round2(sum(rows, (s) => s.total)))}</span> ${currency()}.`
      : 'لا فواتير في هذه الفترة.';
    $('#sales-shown').textContent = rows.length === db.sales.length ? '' : `${int(rows.length)} من ${int(db.sales.length)}`;

    $('#sales-body').innerHTML = rows.map((s) => `<tr>
      <td class="c-main"><button type="button" class="cell-link" data-action="view-invoice" data-id="${s.id}" data-key="view:${s.id}">رقم <span class="num">${int(s.no)}</span></button>
        <span class="sub sub-narrow">${esc(formatWhen(s.at))}${s.customerName ? `، ${esc(s.customerName)}` : ''}</span></td>
      <td class="c-extra">${esc(formatWhen(s.at))}</td>
      <td class="c-extra">${s.customerName ? `<span class="cell-clip">${esc(s.customerName)}</span>` : '<span class="meta">—</span>'}</td>
      <td class="c-extra c-md-hide num">${int(pieces(s))}</td>
      <td class="c-key num">${money(s.total)}</td>
      <td class="c-actions"><span class="row-actions">
        <button type="button" class="icon-btn" data-action="view-invoice" data-id="${s.id}" title="عرض وطباعة" aria-label="عرض الفاتورة رقم ${int(s.no)}">${icon('print')}</button>
        <button type="button" class="icon-btn danger" data-action="void-invoice" data-id="${s.id}" title="إلغاء الفاتورة وإرجاع الكميات" aria-label="إلغاء الفاتورة رقم ${int(s.no)}">${icon('undo')}</button>
      </span></td>
    </tr>`).join('');
    $('#sales-table').hidden = rows.length === 0;
    $('#sales-empty').innerHTML = rows.length ? '' : (db.sales.length
      ? emptyBox('لا فاتورة تطابق البحث أو الفترة المختارة.', '<button type="button" class="btn" data-action="sales-reset">عرض كل الفواتير</button>')
      : emptyBox('لم تُسجَّل أي فاتورة بعد.', '<a class="btn primary" href="#pos">بيع جديد</a>'));
  }

  /* ---------- 10) العملاء والموردون ---------- */
  const contactsView = { tab: 'customer', query: '' };
  let editingContactId = null;
  const TYPE = {
    customer: { one: 'عميل', add: 'إضافة عميل', submit: 'إضافة العميل', edit: 'تعديل بيانات العميل', added: 'تمت إضافة العميل', deleted: 'تم حذف العميل', none: 'لا عملاء مسجّلون بعد.' },
    supplier: { one: 'مورد', add: 'إضافة مورد', submit: 'إضافة المورد', edit: 'تعديل بيانات المورد', added: 'تمت إضافة المورد', deleted: 'تم حذف المورد', none: 'لا موردون مسجّلون بعد.' },
  };

  function renderContacts() {
    const isCustomers = contactsView.tab === 'customer';
    const words = TYPE[contactsView.tab];
    const customers = db.contacts.filter((c) => c.type === 'customer');
    const suppliers = db.contacts.filter((c) => c.type === 'supplier');
    $('#contacts-summary').textContent = `${count(customers.length, WORDS.customer)}، و${count(suppliers.length, WORDS.supplier)}.`;
    $('#count-customer').textContent = int(customers.length);
    $('#count-supplier').textContent = int(suppliers.length);
    $$('[data-contact-tab]').forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.contactTab === contactsView.tab)));
    $('#add-contact-label').textContent = words.add;
    $('#contacts-purchases-head').hidden = !isCustomers;

    const all = isCustomers ? customers : suppliers;
    const q = normalize(contactsView.query);
    const rows = all.filter((c) => !q || normalize(`${c.name} ${c.phone} ${c.address}`).includes(q)).sort(byName);
    const dash = '<span class="meta">—</span>';
    const phoneCell = (c) => (c.phone ? `<span class="ltr num">${esc(c.phone)}</span>` : dash);

    $('#contacts-body').innerHTML = rows.map((c) => {
      const spent = round2(sum(db.sales.filter((s) => s.customerId === c.id), (s) => s.total));
      return `<tr>
        <td class="c-main"><span class="cell-title">${esc(c.name)}</span>
          ${c.notes ? `<span class="sub sub-md">${esc(c.notes)}</span>` : ''}
          ${c.address || c.notes ? `<span class="sub sub-narrow">${esc([c.address, c.notes].filter(Boolean).join('، '))}</span>` : ''}</td>
        <td class="c-key">${phoneCell(c)}</td>
        <td class="c-extra">${c.address ? esc(c.address) : dash}</td>
        <td class="c-extra c-md-hide">${c.notes ? `<span class="cell-clip">${esc(c.notes)}</span>` : dash}</td>
        ${isCustomers ? `<td class="c-extra num">${money(spent)}</td>` : ''}
        <td class="c-actions"><span class="row-actions">
          <button type="button" class="icon-btn" data-action="edit-contact" data-id="${c.id}" data-key="editc:${c.id}" title="تعديل" aria-label="تعديل ${esc(c.name)}">${icon('edit')}</button>
          <button type="button" class="icon-btn danger" data-action="delete-contact" data-id="${c.id}" title="حذف" aria-label="حذف ${esc(c.name)}">${icon('trash')}</button>
        </span></td>
      </tr>`;
    }).join('');
    $('#contacts-table').hidden = rows.length === 0;
    $('#contacts-shown').textContent = rows.length === all.length ? '' : `${int(rows.length)} من ${int(all.length)}`;
    $('#contacts-empty').innerHTML = rows.length ? '' : (all.length
      ? emptyBox('لا اسم يطابق البحث.', '<button type="button" class="btn" data-action="contacts-reset">مسح البحث</button>')
      : emptyBox(words.none, `<button type="button" class="btn primary" data-action="add-contact">${icon('plus')}${words.add}</button>`));
  }

  function syncContactForm() {
    const form = $('#contact-form');
    const words = TYPE[form.elements.type.value];
    $('#contact-dialog-title').textContent = editingContactId ? words.edit : words.add;
    $('#contact-submit').textContent = editingContactId ? 'حفظ التعديلات' : words.submit;
  }
  function openContactForm(id = null) {
    const form = $('#contact-form');
    const c = id ? db.contacts.find((x) => x.id === id) : null;
    editingContactId = c ? c.id : null;
    form.reset();
    clearErrors(form);
    form.elements.type.value = c ? c.type : contactsView.tab;
    form.elements.name.value = c ? c.name : '';
    form.elements.phone.value = c ? c.phone : '';
    form.elements.address.value = c ? c.address : '';
    form.elements.notes.value = c ? c.notes : '';
    syncContactForm();
    openDialog($('#contact-dialog'));
    form.elements.name.focus();
  }
  function submitContact(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const type = form.elements.type.value;
    const name = form.elements.name.value.trim();
    const phone = toLatinDigits(form.elements.phone.value).trim();
    const duplicate = db.contacts.some((c) => c.id !== editingContactId && c.type === type && normalize(c.name) === normalize(name));
    setError(form.elements.name, !name ? 'اكتب الاسم.' : duplicate ? `يوجد ${TYPE[type].one} آخر بهذا الاسم.` : '');
    setError(form.elements.phone, phone && !validPhone(phone) ? 'اكتب رقم الهاتف بالأرقام فقط، من 6 إلى 15 رقماً.' : '');
    if (!focusFirstError(form)) return;

    const data = { type, name, phone, address: form.elements.address.value.trim(), notes: form.elements.notes.value.trim() };
    if (editingContactId) Object.assign(db.contacts.find((c) => c.id === editingContactId), data);
    else db.contacts.push({ id: uid(), ...data });
    contactsView.tab = type;
    tidyCart();
    save('contacts', 'cart');
    closeDialog($('#contact-dialog'));
    toast(editingContactId ? 'تم حفظ التعديلات' : TYPE[type].added);
    render();
  }
  async function deleteContact(id) {
    const c = db.contacts.find((x) => x.id === id);
    if (!c) return;
    const ok = await confirmAction({
      title: `حذف ${TYPE[c.type].one}؟`,
      text: `سيُحذف «${c.name}» من القائمة نهائياً.${c.type === 'customer' ? ' فواتيره السابقة تبقى باسمه.' : ''}`,
      okLabel: 'حذف',
    });
    if (!ok) return;
    db.contacts = db.contacts.filter((x) => x.id !== id);
    tidyCart();
    save('contacts', 'cart');
    toast(TYPE[c.type].deleted);
    render();
  }

  /* ---------- 11) الإعدادات والنسخ الاحتياطي ---------- */
  function renderSettings() {
    const form = $('#store-form');
    if (!form.contains(document.activeElement)) {
      form.elements.storeName.value = db.settings.storeName;
      form.elements.phone.value = db.settings.phone;
      form.elements.currency.value = db.settings.currency;
      form.elements.address.value = db.settings.address;
    }
    renderStorePreview();
    $('#settings-summary').textContent = storageWorks
      ? 'كل ما تسجّله يُحفظ تلقائياً في هذا المتصفح.'
      : 'هذا المتصفح يمنع الحفظ المحلي، فستبقى البيانات حتى إغلاق الصفحة فقط.';
    const bytes = new Blob([JSON.stringify({ p: db.products, s: db.sales, c: db.contacts, t: db.settings })]).size;
    $('#storage-facts').innerHTML = `
      <div><dt>الأصناف</dt><dd class="num">${int(db.products.length)}</dd></div>
      <div><dt>الفواتير</dt><dd class="num">${int(db.sales.length)}</dd></div>
      <div><dt>العملاء والموردون</dt><dd class="num">${int(db.contacts.length)}</dd></div>
      <div><dt>حجم البيانات</dt><dd><span class="num">${(bytes / 1024).toFixed(1)}</span> <span class="unit">ك.ب</span></dd></div>`;
  }
  /* معاينة رأس الفاتورة تتحدّث أثناء الكتابة */
  function renderStorePreview() {
    const form = $('#store-form');
    $('#preview-name').textContent = form.elements.storeName.value.trim() || DEFAULT_SETTINGS.storeName;
    $('#preview-contact').textContent = [form.elements.address.value.trim(), form.elements.phone.value.trim()].filter(Boolean).join('، ');
    $('#preview-currency').textContent = form.elements.currency.value.trim() || DEFAULT_SETTINGS.currency;
  }
  function submitStore(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const storeName = form.elements.storeName.value.trim();
    const phone = toLatinDigits(form.elements.phone.value).trim();
    const currencyCode = form.elements.currency.value.trim();
    setError(form.elements.storeName, storeName ? '' : 'اكتب اسم المحل.');
    setError(form.elements.phone, phone && !validPhone(phone) ? 'اكتب رقم الهاتف بالأرقام فقط، من 6 إلى 15 رقماً.' : '');
    setError(form.elements.currency, currencyCode ? '' : 'اكتب رمز العملة، مثل د.ل.');
    if (!focusFirstError(form)) return;
    Object.assign(db.settings, { storeName, phone, currency: currencyCode, address: form.elements.address.value.trim() });
    save('settings');
    toast('تم حفظ بيانات المحل');
    render();
  }

  function exportBackup() {
    const backup = { app: 'qartasia', version: 1, exportedAt: new Date().toISOString(), settings: db.settings, products: db.products, sales: db.sales, contacts: db.contacts };
    download(`qartasia-backup-${dayKey(new Date())}.json`, JSON.stringify(backup, null, 2), 'application/json');
    toast('تم تنزيل النسخة الاحتياطية');
  }
  async function importBackup(file) {
    const errorBox = $('#import-error');
    errorBox.hidden = true;
    let data = null;
    try { data = JSON.parse(await file.text()); } catch { data = null; }
    if (!data || typeof data !== 'object' || !Array.isArray(data.products) || !Array.isArray(data.sales)) {
      errorBox.textContent = 'تعذّر الاسترجاع: الملف ليس نسخة احتياطية من هذه المنظومة.';
      errorBox.hidden = false;
      return;
    }
    const ok = await confirmAction({
      title: 'استرجاع النسخة الاحتياطية؟',
      text: `ستُستبدل كل البيانات الحالية بما في الملف: ${count(data.products.length, WORDS.item)}، و${count(data.sales.length, WORDS.invoice)}.`,
      okLabel: 'استرجاع النسخة',
    });
    if (!ok) return;
    setData({ ...data, settings: { ...data.settings, demo: false }, cart: emptyCart() });
    save('products', 'sales', 'contacts', 'settings', 'cart');
    toast('تم استرجاع النسخة الاحتياطية');
    render();
  }
  async function resetData(mode) {
    const demo = mode === 'demo';
    const ok = await confirmAction(demo
      ? { title: 'استعادة البيانات التجريبية؟', text: 'ستُستبدل كل البيانات الحالية بأصناف وفواتير تجريبية.', okLabel: 'استعادة البيانات التجريبية' }
      : { title: 'مسح كل البيانات؟', text: `ستُحذف نهائياً ${count(db.products.length, WORDS.item)}، و${count(db.sales.length, WORDS.invoice)}، وكل العملاء والموردين. بيانات المحل تبقى كما هي.`, okLabel: 'مسح كل البيانات' });
    if (!ok) return;
    const keep = { storeName: db.settings.storeName, phone: db.settings.phone, address: db.settings.address, currency: db.settings.currency };
    if (demo) { const data = demoData(); setData({ ...data, settings: { ...data.settings, ...keep } }); }
    else setData({ products: [], sales: [], contacts: [], settings: { ...keep, nextInvoiceNo: 1, demo: false }, cart: emptyCart() });
    save('products', 'sales', 'contacts', 'settings', 'cart');
    toast(demo ? 'تمت استعادة البيانات التجريبية' : 'تم مسح كل البيانات');
    render();
  }

  /* ---------- 12) التنقل وربط الأحداث ---------- */
  const VIEWS = {
    dashboard: { title: 'لوحة المؤشرات', render: renderDashboard },
    inventory: { title: 'المخزون', render: renderInventory },
    pos:       { title: 'نقطة البيع', render: renderPOS },
    invoices:  { title: 'الفواتير', render: renderInvoices },
    contacts:  { title: 'العملاء والموردون', render: renderContacts },
    settings:  { title: 'الإعدادات', render: renderSettings },
  };
  let currentView = 'dashboard';

  function renderSaveState() {
    const el = $('#save-state');
    el.textContent = storageWorks ? 'البيانات محفوظة في هذا المتصفح' : 'المتصفح يمنع الحفظ المحلي';
    el.classList.toggle('is-off', !storageWorks);
  }

  /* يعيد رسم القسم الظاهر ويحافظ على موضع التركيز (لمستعملي لوحة المفاتيح) */
  function render() {
    const active = document.activeElement;
    const key = active && active.dataset ? active.dataset.key : '';
    $$('[data-store-name]').forEach((el) => { el.textContent = db.settings.storeName; });
    $$('[data-currency]').forEach((el) => { el.textContent = db.settings.currency; });
    document.title = `${VIEWS[currentView].title} - ${db.settings.storeName}`;
    renderSaveState();
    VIEWS[currentView].render();
    if (key) {
      const again = $$('[data-key]').find((el) => el.dataset.key === key);
      if (again && !again.disabled) again.focus({ preventScroll: true });
    }
  }

  function route() {
    const name = location.hash.slice(1);
    currentView = name in VIEWS ? name : 'dashboard';
    $$('.view').forEach((view) => { view.hidden = view.id !== `view-${currentView}`; });
    $$('[data-view]').forEach((link) => {
      if (link.dataset.view === currentView) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    render();
    window.scrollTo(0, 0);
  }

  /* كل زر يحمل data-action يُعالَج هنا (تفويض الأحداث: مستمع واحد للصفحة كلها) */
  const ACTIONS = {
    'add-product': () => openProductForm(),
    'edit-product': (id) => openProductForm(id),
    'delete-product': (id) => deleteProduct(id),
    'restock': (id) => openRestock(id),
    'inv-more': () => { inv.limit += 100; render(); },
    'inv-reset': () => { inv.query = ''; inv.category = ''; $('#inv-search').value = ''; render(); },
    'show-low': () => { inv.tab = 'low'; inv.query = ''; inv.category = ''; $('#inv-search').value = ''; },
    'add-to-cart': (id) => setCartQty(id, cartQty(id) + 1),
    'cart-inc': (id) => setCartQty(id, cartQty(id) + 1),
    'cart-dec': (id) => setCartQty(id, cartQty(id) - 1),
    'cart-remove': (id) => setCartQty(id, 0),
    'clear-cart': () => { db.cart = emptyCart(); $('#cart-discount').value = ''; save('cart'); render(); },
    'pos-reset': () => { pos.query = ''; pos.category = ''; $('#pos-search').value = ''; render(); },
    'scroll-receipt': (id, event) => { event.preventDefault(); $('#receipt').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    'checkout': () => checkout(),
    'view-invoice': (id) => showInvoice(id),
    'void-invoice': (id) => voidInvoice(id),
    'print-invoice': () => printInvoice(),
    'download-invoice': () => downloadInvoice(),
    'sales-reset': () => { salesView.query = ''; salesView.period = 'all'; $('#sales-search').value = ''; render(); },
    'add-contact': () => openContactForm(),
    'edit-contact': (id) => openContactForm(id),
    'delete-contact': (id) => deleteContact(id),
    'contacts-reset': () => { contactsView.query = ''; $('#contacts-search').value = ''; render(); },
    'export': () => exportBackup(),
    'import': () => $('#import-file').click(),
    'load-demo': () => resetData('demo'),
    'clear-all': () => resetData('empty'),
    'hide-demo-notice': () => { db.settings.demo = false; save('settings'); render(); },
  };

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const closer = event.target.closest('[data-close]');
      if (closer) { closeDialog(closer.closest('dialog')); return; }
      if (event.target.matches('dialog')) { closeDialog(event.target); return; }   // نقرة على الخلفية المعتمة

      const actor = event.target.closest('[data-action]');
      if (actor && ACTIONS[actor.dataset.action]) { ACTIONS[actor.dataset.action](actor.dataset.id, event); return; }

      const metricTab = event.target.closest('.kpi-tab');
      if (metricTab) { chartMetric = metricTab.dataset.metric; render(); return; }
      const invTab = event.target.closest('[data-inv-tab]');
      if (invTab) { inv.tab = invTab.dataset.invTab; inv.limit = 100; render(); return; }
      const sortBtn = event.target.closest('.sort-btn');
      if (sortBtn) {
        inv.sortDir = inv.sortKey === sortBtn.dataset.sort ? -inv.sortDir : 1;
        inv.sortKey = sortBtn.dataset.sort;
        render();
        return;
      }
      const chip = event.target.closest('.chip');
      if (chip) { pos.category = chip.dataset.category; render(); return; }
      const period = event.target.closest('[data-period]');
      if (period) { salesView.period = period.dataset.period; render(); return; }
      const contactTab = event.target.closest('[data-contact-tab]');
      if (contactTab) { contactsView.tab = contactTab.dataset.contactTab; contactsView.query = ''; $('#contacts-search').value = ''; render(); }
    });

    // التنقل بين تبويبات المؤشرات بالأسهم
    $('.kpi-tabs').addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const tabs = $$('.kpi-tab');
      const step = event.key === 'ArrowLeft' ? 1 : -1;          // في الواجهة العربية: اليسار هو «التالي»
      const next = tabs[(tabs.indexOf(document.activeElement) + step + tabs.length) % tabs.length];
      chartMetric = next.dataset.metric;
      render();
      next.focus();
    });

    // البحث والتصفية: التحديث فوري مع كل حرف
    $('#inv-search').addEventListener('input', (e) => { inv.query = e.target.value; inv.limit = 100; renderInventory(); });
    $('#inv-category').addEventListener('change', (e) => { inv.category = e.target.value; inv.limit = 100; renderInventory(); });
    $('#pos-search').addEventListener('input', (e) => { pos.query = e.target.value; renderPOS(); });
    $('#pos-search').addEventListener('keydown', (e) => {       // Enter يضيف أول صنف متوفر في النتائج
      if (e.key !== 'Enter') return;
      const first = visibleProducts().find((p) => p.qty - cartQty(p.id) > 0);
      if (first && pos.query.trim()) { setCartQty(first.id, cartQty(first.id) + 1); e.target.select(); }
    });
    $('#sales-search').addEventListener('input', (e) => { salesView.query = e.target.value; renderInvoices(); });
    $('#contacts-search').addEventListener('input', (e) => { contactsView.query = e.target.value; renderContacts(); });

    // الفاتورة الجارية
    $('#cart-lines').addEventListener('change', (e) => {
      const id = e.target.dataset.cartQty;
      if (!id) return;
      const n = parseNumber(e.target.value);
      if (!Number.isInteger(n) || n < 1) { toast('اكتب الكمية عدداً صحيحاً أكبر من صفر.', true); render(); return; }
      setCartQty(id, n);
    });
    $('#cart-discount').addEventListener('input', (e) => { db.cart.discount = e.target.value; save('cart'); renderCart(); });
    $('#cart-customer').addEventListener('change', (e) => { db.cart.customerId = e.target.value; save('cart'); });

    // النماذج
    $('#product-form').addEventListener('submit', submitProduct);
    $('#restock-form').addEventListener('submit', submitRestock);
    $('#restock-qty').addEventListener('input', updateRestockPreview);
    $('#contact-form').addEventListener('submit', submitContact);
    $('#contact-form').addEventListener('change', (e) => { if (e.target.name === 'type') syncContactForm(); });
    $('#store-form').addEventListener('submit', submitStore);
    $('#store-form').addEventListener('input', renderStorePreview);
    document.addEventListener('input', (e) => {                 // الخطأ يختفي حين يبدأ المستخدم التصحيح
      if (e.target.matches('form .input[aria-invalid="true"]')) setError(e.target, '');
    });
    $('#import-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (file) importBackup(file);
    });

    window.addEventListener('afterprint', () => { $('#print-area').innerHTML = ''; });
    window.addEventListener('hashchange', route);
    // إن تغيّرت البيانات من تبويب آخر للمتصفح نعيد قراءتها حتى لا يكتب أحدهما فوق الآخر
    window.addEventListener('storage', (e) => { if (e.key === null || e.key.startsWith(PREFIX)) { loadAll(); render(); } });
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (currentView === 'dashboard') renderChart(lastWeek()); }, 150);
    });
  }

  /* ---------- التشغيل ---------- */
  loadAll();
  bindEvents();
  route();
})();
