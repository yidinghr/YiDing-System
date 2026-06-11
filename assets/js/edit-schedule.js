(function () {
  const i18n = window.YiDingI18n || null;
  const employeesDataApi = window.YiDingEmployeesData || null;
  const STORAGE_KEY = "yiding_schedule_module_v3";
  const LEGEND_REMARKS_KEY = "yiding_schedule_legend_remarks_v1";
  const LEGEND_CODE_LABELS_KEY = "yiding_schedule_legend_code_labels_v1";
  const EMPLOYEES_KEY = employeesDataApi && employeesDataApi.STORAGE_KEY
    ? employeesDataApi.STORAGE_KEY
    : "yiding_employees_module_state_v3_airtable_import";
  const WORKBOOK_DEFAULT_YEAR = 2026;
  const WORKBOOK_DEFAULT_MONTH = 7;
  const ZOOM_MIN = 0.65;
  const ZOOM_MAX = 1.35;
  const ZOOM_STEP = 0.05;
  const LEGACY_DEFAULT_COLUMN_WIDTHS = Object.freeze({
    id: 96,
    dept: 96,
    vie: 146,
    eng: 132,
    position: 104,
    day: 42
  });
  const META_COLUMNS = [
    { key: "ydiId", widthKey: "id" },
    { key: "department", widthKey: "dept" },
    { key: "vieName", widthKey: "vie" },
    { key: "engName", widthKey: "eng" },
    { key: "position", widthKey: "position" }
  ];
  const DEFAULT_COLUMN_WIDTHS = Object.freeze({
    id: 86,
    dept: 88,
    vie: 128,
    eng: 118,
    position: 92,
    day: 38,
    summary: 58
  });
  const WEEKDAY_LABELS = {
    "zh-Hant": ["日", "一", "二", "三", "四", "五", "六"],
    vi: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"],
    en: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
  };
  const SUMMARY_FIELDS = [
    { id: "workedDays", labels: { "zh-Hant": "出勤天", vi: "Ngày công", en: "Days" } },
    { id: "overtimeCount", labels: { "zh-Hant": "加班天", vi: "Ngày OT", en: "OT Days" } },
    { id: "otHours", labels: { "zh-Hant": "加班时", vi: "Giờ OT", en: "OT Hrs" } },
    { id: "otNightHours", labels: { "zh-Hant": "夜OT", vi: "OT đêm", en: "OT Night" } },
    { id: "otHolidayHours", labels: { "zh-Hant": "节OT", vi: "OT lễ", en: "OT Hol" } },
    { id: "nightHours", labels: { "zh-Hant": "夜班(时)", vi: "Giờ đêm", en: "Night" } },
    { id: "totalPaidHours", labels: { "zh-Hant": "实际时数", vi: "Tổng giờ", en: "Total Hrs" } }
  ];
  const META_HEADERS = {
    "zh-Hant": ["工號", "部門", "越名字", "英名字", "职位"],
    vi: ["Mã YDI", "Bộ phận", "Tên Việt", "Tên Anh", "Chức vụ"],
    en: ["YDI ID", "Department", "Vietnamese Name", "English Name", "Position"]
  };
  const SHIFT_CODE_DEFINITIONS = Object.freeze([
    { code: "A", checkIn: "7", checkOut: "15", hoursPay: 8, nightHours: 0, remark: "早班 (07:00-15:00)" },
    { code: "A1", checkIn: "8", checkOut: "16", hoursPay: 8, nightHours: 0, remark: "" },
    { code: "A2", checkIn: "9", checkOut: "17", hoursPay: 8, nightHours: 0, remark: "" },
    { code: "A3", checkIn: "10", checkOut: "18", hoursPay: 8, nightHours: 0, remark: "" },
    { code: "A4", checkIn: "11", checkOut: "19", hoursPay: 8, nightHours: 0, remark: "" },
    { code: "A5", checkIn: "12", checkOut: "20", hoursPay: 8, nightHours: 0, remark: "" },
    { code: "A6", checkIn: "13", checkOut: "21", hoursPay: 8, nightHours: 0, remark: "" },
    { code: "A7", checkIn: "14", checkOut: "22", hoursPay: 8, nightHours: 0, remark: "中班（15:00-23:00)" },
    { code: "B", checkIn: "15", checkOut: "23", hoursPay: 8, nightHours: 1, remark: "" },
    { code: "B1", checkIn: "16", checkOut: "0", hoursPay: 8, nightHours: 2, remark: "" },
    { code: "B2", checkIn: "17", checkOut: "1", hoursPay: 8, nightHours: 3, remark: "" },
    { code: "B3", checkIn: "18", checkOut: "2", hoursPay: 8, nightHours: 4, remark: "" },
    { code: "B4", checkIn: "19", checkOut: "3", hoursPay: 8, nightHours: 5, remark: "" },
    { code: "B5", checkIn: "20", checkOut: "4", hoursPay: 8, nightHours: 6, remark: "" },
    { code: "B6", checkIn: "21", checkOut: "5", hoursPay: 8, nightHours: 7, remark: "" },
    { code: "B7", checkIn: "22", checkOut: "6", hoursPay: 8, nightHours: 8, remark: "" },
    { code: "C", checkIn: "23", checkOut: "7", hoursPay: 8, nightHours: 7, remark: "夜班（23:00-07:00)" },
    { code: "C1", checkIn: "0", checkOut: "8", hoursPay: 8, nightHours: 6, remark: "" },
    { code: "C2", checkIn: "1", checkOut: "9", hoursPay: 8, nightHours: 5, remark: "" },
    { code: "C3", checkIn: "2", checkOut: "10", hoursPay: 8, nightHours: 4, remark: "" },
    { code: "C4", checkIn: "3", checkOut: "11", hoursPay: 8, nightHours: 3, remark: "" },
    { code: "C5", checkIn: "4", checkOut: "12", hoursPay: 8, nightHours: 2, remark: "" },
    { code: "C6", checkIn: "5", checkOut: "13", hoursPay: 8, nightHours: 1, remark: "" },
    { code: "C7", checkIn: "6", checkOut: "14", hoursPay: 8, nightHours: 0, remark: "" },
    { code: "NPL", checkIn: "NO PAY LEAVE", checkOut: "NO WORK", hoursPay: 0, nightHours: 0, remark: "" },
    { code: "OFF", checkIn: "1 OFF/WEEK", checkOut: "NO WORK", hoursPay: 0, nightHours: 0, remark: "" },
    { code: "SL", checkIn: "SICK LEAVE", checkOut: "NO WORK", hoursPay: 8, nightHours: 0, remark: "" },
    { code: "PH", checkIn: "PUBLIC HOLIDAY", checkOut: "NO WORK", hoursPay: 8, nightHours: 0, remark: "" },
    { code: "TL", checkIn: "TIME IN LIEU", checkOut: "NO WORK", hoursPay: 8, nightHours: 0, remark: "" },
    { code: "AL", checkIn: "ANNUAL LEAVE", checkOut: "NO WORK", hoursPay: 8, nightHours: 0, remark: "" },
    { code: "BL", checkIn: "BIRTHDATE LEAVE", checkOut: "NO WORK", hoursPay: 8, nightHours: 0, remark: "" }
  ]);
  const SHIFT_CODE_MAP = SHIFT_CODE_DEFINITIONS.reduce(function (result, item) {
    result[item.code] = item;
    return result;
  }, {});
  const VALID_SHIFT_CODES = SHIFT_CODE_DEFINITIONS.map(function (item) { return item.code; });
  const MAJOR_SHIFT_CODES = VALID_SHIFT_CODES.slice(0, 24);
  // Overtime (tăng ca) is a SEPARATE data branch layered on top of shift codes.
  // It never overwrites the shift cell. Pay multipliers locked by business rules:
  //   normal/night = x1 (paid like a regular working hour)
  //   holiday/holidayNight = x3 (300%, paid in full, no time-off-in-lieu)
  const OVERTIME_TYPES = Object.freeze(["normal", "night", "holiday", "holidayNight"]);
  const OVERTIME_PAY_MULTIPLIER = Object.freeze({
    normal: 1,
    night: 1,
    holiday: 3,
    holidayNight: 3
  });
  // Per-code colours mirroring the real Excel workbook (A=gold, B=pink->red, C=lavender->purple,
  // leave=white/red, off/npl=red). Single source of truth shared by the grid and Excel export.
  const SHIFT_CODE_COLORS = Object.freeze({
    A:  { bg: "#FFF9C4", fg: "#7A5800" },
    A1: { bg: "#FFF176", fg: "#7A5800" },
    A2: { bg: "#FFE34D", fg: "#6B4C00" },
    A3: { bg: "#FFD21A", fg: "#5C4000" },
    A4: { bg: "#FFC107", fg: "#523800" },
    A5: { bg: "#FFA000", fg: "#4A2D00" },
    A6: { bg: "#FF8F00", fg: "#3A2200" },
    A7: { bg: "#EF6C00", fg: "#FFFFFF" },
    B:  { bg: "#F9CDD3", fg: "#5C0F1A" },
    B1: { bg: "#F2A9B4", fg: "#5C0F1A" },
    B2: { bg: "#EB8593", fg: "#4B0C15" },
    B3: { bg: "#E36172", fg: "#FFFFFF" },
    B4: { bg: "#D94353", fg: "#FFFFFF" },
    B5: { bg: "#C62F3E", fg: "#FFFFFF" },
    B6: { bg: "#A82532", fg: "#FFFFFF" },
    B7: { bg: "#8B1E2A", fg: "#FFFFFF" },
    C:  { bg: "#EFE3F7", fg: "#3D1566" },
    C1: { bg: "#DCC5EE", fg: "#3D1566" },
    C2: { bg: "#C5A3E2", fg: "#2E0E52" },
    C3: { bg: "#AC80D4", fg: "#FFFFFF" },
    C4: { bg: "#9260C4", fg: "#FFFFFF" },
    C5: { bg: "#7A45B0", fg: "#FFFFFF" },
    C6: { bg: "#63309B", fg: "#FFFFFF" },
    C7: { bg: "#4C1F82", fg: "#FFFFFF" },
    NPL: { bg: "#E53935", fg: "#FFFFFF" },
    OFF: { bg: "#E53935", fg: "#FFFFFF" },
    SL: { bg: "#F7F2F2", fg: "#C62828" },
    PH: { bg: "#F7F2F2", fg: "#C62828" },
    TL: { bg: "#F7F2F2", fg: "#C62828" },
    AL: { bg: "#F7F2F2", fg: "#C62828" },
    BL: { bg: "#F7F2F2", fg: "#C62828" }
  });

  function getCodeCellStyle(code) {
    const color = SHIFT_CODE_COLORS[code];
    if (!color) {
      return "";
    }
    // Inline !important is required to beat the legacy per-group !important rules
    // in edit-schedule.css (theme blocks) without ripping them out.
    return "background:" + color.bg + " !important;color:" + color.fg + " !important;";
  }

  function formatOtHours(hours) {
    return String(Number(hours) || 0);
  }

  // OT badge text: hours + suffix (N night, L holiday, LN holiday-night).
  function getOtBadgeLabel(entry) {
    if (!entry) {
      return "";
    }
    let suffix = "";
    if (entry.type === "night") {
      suffix = "N";
    } else if (entry.type === "holiday") {
      suffix = "L";
    } else if (entry.type === "holidayNight") {
      suffix = "LN";
    }
    return "OT" + formatOtHours(entry.hours) + suffix;
  }
  const dom = {
    app: document.getElementById("scheduleApp"),
    workspace: document.querySelector(".schedule-workspace"),
    header: document.querySelector(".schedule-header"),
    periodBar: document.querySelector(".schedule-period-bar"),
    periodGrid: document.querySelector(".schedule-period-grid"),
    frozenLayer: document.getElementById("scheduleFrozenLayer"),
    frozenScroll: document.getElementById("scheduleFrozenScroll"),
    frozenZoom: document.getElementById("scheduleFrozenZoom"),
    headerTitle: document.getElementById("scheduleHeaderTitle"),
    yearLabel: document.getElementById("scheduleYearLabel"),
    monthLabel: document.getElementById("scheduleMonthLabel"),
    codeLabel: document.getElementById("scheduleCodeLabel"),
    addRowsLabel: document.getElementById("scheduleAddRowsLabel"),
    addRowsCount: document.getElementById("scheduleAddRowsCount"),
    addRowsButton: document.getElementById("scheduleAddRowsButton"),
    deleteRowsButton: document.getElementById("scheduleDeleteRowsButton"),
    yearSelect: document.getElementById("scheduleYear"),
    monthSelect: document.getElementById("scheduleMonth"),
    sheetScroll: document.getElementById("scheduleSheetScroll"),
    sheetZoom: document.getElementById("scheduleSheetZoom"),
    selectionMeta: document.getElementById("scheduleSelectionMeta"),
    selectionInput: document.getElementById("scheduleSelectionInput"),
    codeDropdown: document.getElementById("scheduleCodeDropdown"),
    feedback: document.getElementById("scheduleFeedback"),
    localeMount: document.getElementById("scheduleLocaleMount"),
    legendToggle: document.getElementById("scheduleLegendToggle"),
    legendPanel: document.getElementById("scheduleLegendPanel"),
    legendContent: document.getElementById("scheduleLegendContent"),
    legendBody: document.getElementById("scheduleLegendBody"),
    legendTable: document.getElementById("scheduleLegendTable"),
    sheetFrame: document.querySelector(".schedule-sheet-frame"),
    shiftCodeList: document.getElementById("scheduleShiftCodeList"),
    table: document.getElementById("scheduleTable"),
    tableHead: document.getElementById("scheduleTableHead"),
    frozenTableHead: document.getElementById("scheduleFrozenTableHead"),
    tableBody: document.getElementById("scheduleTableBody"),
    summaryTable: document.getElementById("scheduleSummaryTable"),
    summaryHead: document.getElementById("scheduleSummaryHead"),
    frozenSummaryHead: document.getElementById("scheduleFrozenSummaryHead"),
    summaryBody: document.getElementById("scheduleSummaryBody"),
    dailyTable: document.getElementById("dailySummaryTable"),
    dailySection: document.getElementById("dailySummarySection"),
    dailyHead: document.getElementById("dailySummaryHead"),
    dailyBody: document.getElementById("dailySummaryBody"),
    dailySpacerTable: document.getElementById("dailySummarySpacerTable"),
    dailySpacerHead: document.getElementById("dailySummarySpacerHead"),
    dailySpacerBody: document.getElementById("dailySummarySpacerBody"),
    editButton: document.getElementById("scheduleEditButton"),
    saveButton: document.getElementById("scheduleSaveButton"),
    exportButton: document.getElementById("scheduleExportButton"),
    legendTitle: document.querySelector(".schedule-legend__title"),
    legendListToggle: document.getElementById("scheduleLegendListToggle"),
    calendarToggle: document.getElementById("scheduleCalendarToggle"),
    calendarContent: document.getElementById("scheduleCalendarContent"),
    calYear: document.getElementById("scheduleCalYear"),
    calMonth: document.getElementById("scheduleCalMonth"),
    calGrid: document.getElementById("scheduleCalGrid"),
    calSave: document.getElementById("scheduleCalSave"),
    modeShift: document.getElementById("scheduleModeShift"),
    modeOt: document.getElementById("scheduleModeOt")
  };

  if (!i18n || !dom.app || !dom.yearSelect || !dom.monthSelect || !dom.tableHead || !dom.tableBody) {
    return;
  }

  const uiState = {
    selection: null,
    anchor: null,
    isSelecting: false,
    history: [],
    feedbackTimer: 0,
    localeMenuOpen: false,
    dragRowId: "",
    dragOverId: "",
    columnResize: null,
    copiedText: "",
    frozenSyncFrame: 0,
    codeDropdownOpen: false,
    codeDropdownIndex: -1,
    legendCodesEditable: false,
    legendListOpen: false,
    scheduleLocked: true,
    exportReady: true,
    hasSavedSchedule: true,
    lockedScrollY: null,
    stickyMetricsObserver: null,
    calendarOpen: false,
    calHighlightedDays: [],
    inputMode: "shift",
    otPopover: null,
    dailyOtOpen: true
  };
  const state = loadState();
  let legendRemarks = loadLegendRemarks();
  let legendCodeLabels = loadLegendCodeLabels();

  buildShiftCodeDatalist();
  populatePeriodOptions();
  bindEvents();
  initCalendar();
  observeStickyMetrics();
  ensureCurrentMonthState();
  renderStaticText();
  renderLocaleControl();
  buildLegendTable();
  renderAll();
  const unsubscribeI18n = i18n.subscribe(function () {
    renderStaticText();
    renderLocaleControl();
    buildLegendTable();
    renderAll();
  });

  window.addEventListener("beforeunload", function () {
    unsubscribeI18n();
  });

  function createInitialState() {
    return {
      selectedYear: WORKBOOK_DEFAULT_YEAR,
      selectedMonth: WORKBOOK_DEFAULT_MONTH,
      legendOpen: false,
      zoomLevel: 1,
      columnWidths: Object.assign({}, DEFAULT_COLUMN_WIDTHS),
      months: {}
    };
  }

  function createEmployeeSnapshot(employee) {
    const basic = employee && employee.basic ? employee.basic : {};
    const work = employee && employee.work ? employee.work : {};
    const department = work.department && typeof work.department === "object"
      ? (work.department.other || work.department.preset || "")
      : (work.department || "");

    return {
      employeeId: String(employee && employee.id ? employee.id : basic.ydiId || ""),
      ydiId: String(basic.ydiId || ""),
      department: String(department || ""),
      vieName: String(basic.vieName || ""),
      engName: String(basic.engName || ""),
      position: String(work.position || "")
    };
  }

  function createRowFromEmployee(employee) {
    const snapshot = createEmployeeSnapshot(employee);
    return {
      id: "schedule-row-" + snapshot.employeeId,
      sourceType: "employee",
      employeeId: snapshot.employeeId,
      employeeSnapshot: snapshot,
      shifts: {},
      overtime: {}
    };
  }

  function createManualRow() {
    return {
      id: "schedule-row-manual-" + Date.now() + "-" + Math.random().toString(16).slice(2, 8),
      sourceType: "manual",
      employeeId: "",
      employeeSnapshot: {
        employeeId: "",
        ydiId: "",
        department: "",
        vieName: "",
        engName: "",
        position: ""
      },
      shifts: {},
      overtime: {}
    };
  }

  function normalizeCellValue(value) {
    return String(value || "").trim().toUpperCase();
  }

  function normalizeShifts(value) {
    const result = {};
    if (!value || typeof value !== "object") {
      return result;
    }
    Object.keys(value).forEach(function (key) {
      if (!/^\d+$/.test(key)) {
        return;
      }
      const nextValue = normalizeCellValue(value[key]);
      if (nextValue) {
        result[String(Number(key))] = nextValue;
      }
    });
    return result;
  }

  function sanitizeOvertimeHours(value) {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours <= 0) {
      return 0;
    }
    return Math.min(8, Math.max(0.5, Math.round(hours * 2) / 2));
  }

  function normalizeOvertime(value) {
    const result = {};
    if (!value || typeof value !== "object") {
      return result;
    }
    Object.keys(value).forEach(function (key) {
      if (!/^\d+$/.test(key)) {
        return;
      }
      const entry = value[key];
      if (!entry || typeof entry !== "object") {
        return;
      }
      const hours = sanitizeOvertimeHours(entry.hours);
      if (!hours) {
        return;
      }
      result[String(Number(key))] = {
        hours: hours,
        type: OVERTIME_TYPES.indexOf(entry.type) >= 0 ? entry.type : "normal",
        note: String(entry.note || ""),
        approvedBy: String(entry.approvedBy || "")
      };
    });
    return result;
  }

  function normalizeHolidays(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    const seen = {};
    const result = [];
    value.forEach(function (day) {
      const num = Number(day);
      if (Number.isInteger(num) && num >= 1 && num <= 31 && !seen[num]) {
        seen[num] = true;
        result.push(num);
      }
    });
    return result.sort(function (a, b) { return a - b; });
  }

  function normalizeRow(row) {
    const snapshot = row && row.employeeSnapshot ? row.employeeSnapshot : {};
    return {
      id: String(row && row.id ? row.id : "schedule-row-" + (row && row.employeeId ? row.employeeId : Date.now())),
      sourceType: row && row.sourceType === "manual" ? "manual" : "employee",
      employeeId: String(row && row.employeeId ? row.employeeId : ""),
      employeeSnapshot: {
        employeeId: String(snapshot.employeeId || row && row.employeeId || ""),
        ydiId: String(snapshot.ydiId || ""),
        department: String(snapshot.department || ""),
        vieName: String(snapshot.vieName || ""),
        engName: String(snapshot.engName || ""),
        position: String(snapshot.position || "")
      },
      shifts: normalizeShifts(row && row.shifts),
      overtime: normalizeOvertime(row && row.overtime)
    };
  }

  function sanitizeYear(value) {
    const year = Number(value);
    return Number.isFinite(year) && year >= 2020 && year <= 2100 ? Math.round(year) : WORKBOOK_DEFAULT_YEAR;
  }

  function sanitizeMonth(value) {
    const month = Number(value);
    return Number.isFinite(month) && month >= 1 && month <= 12 ? Math.round(month) : WORKBOOK_DEFAULT_MONTH;
  }

  function sanitizeZoom(value) {
    const zoom = Number(value);
    if (!Number.isFinite(zoom)) {
      return 1;
    }
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoom * 100) / 100));
  }

  function sanitizeColumnWidths(value) {
    const nextWidths = Object.assign({}, DEFAULT_COLUMN_WIDTHS);
    if (!value || typeof value !== "object") {
      return nextWidths;
    }
    const matchesLegacyDefaults = Object.keys(LEGACY_DEFAULT_COLUMN_WIDTHS).every(function (key) {
      return Number(value[key]) === LEGACY_DEFAULT_COLUMN_WIDTHS[key];
    });
    if (matchesLegacyDefaults) {
      return nextWidths;
    }
    Object.keys(nextWidths).forEach(function (key) {
      const width = Number(value[key]);
      if (Number.isFinite(width)) {
        if (key === "summary") {
          nextWidths[key] = Math.max(54, Math.round(width));
          return;
        }
        nextWidths[key] = Math.max(key === "day" ? 36 : 64, Math.round(width));
      }
    });
    return nextWidths;
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") {
        return createInitialState();
      }
      return {
        selectedYear: sanitizeYear(parsed.selectedYear),
        selectedMonth: sanitizeMonth(parsed.selectedMonth),
        legendOpen: false,
        zoomLevel: sanitizeZoom(parsed.zoomLevel),
        columnWidths: sanitizeColumnWidths(parsed.columnWidths),
        months: parsed.months && typeof parsed.months === "object" ? parsed.months : {}
      };
    } catch (error) {
      return createInitialState();
    }
  }

  function loadLegendRemarks() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LEGEND_REMARKS_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveLegendRemarks() {
    localStorage.setItem(LEGEND_REMARKS_KEY, JSON.stringify(legendRemarks));
  }

  function loadLegendCodeLabels() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LEGEND_CODE_LABELS_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveLegendCodeLabels() {
    localStorage.setItem(LEGEND_CODE_LABELS_KEY, JSON.stringify(legendCodeLabels));
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getCurrentMonthKey() {
    return String(state.selectedYear) + "-" + String(state.selectedMonth).padStart(2, "0");
  }

  function getMonthState() {
    return state.months[getCurrentMonthKey()];
  }

  function getEmployeesState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(EMPLOYEES_KEY) || "null");
      if (parsed && Array.isArray(parsed.employees)) {
        return employeesDataApi && employeesDataApi.mergeStateWithSeedData
          ? employeesDataApi.mergeStateWithSeedData(parsed)
          : parsed;
      }
    } catch (error) {}
    return { employees: employeesDataApi && Array.isArray(employeesDataApi.SEED_EMPLOYEES) ? employeesDataApi.SEED_EMPLOYEES : [] };
  }

  function getActiveEmployees() {
    const employees = getEmployeesState().employees || [];
    return employees.filter(function (employee) {
      return employee && employee.work && employee.work.status === "在職";
    });
  }

  function ensureCurrentMonthState() {
    return ensureMonthStateFor(state.selectedYear, state.selectedMonth);
  }

  function getMonthKeyFor(year, month) {
    return String(year) + "-" + String(month).padStart(2, "0");
  }

  function ensureMonthStateFor(year, month) {
    const key = getMonthKeyFor(year, month);
    const monthState = state.months[key] && typeof state.months[key] === "object" ? state.months[key] : { rows: [] };
    monthState.rows = Array.isArray(monthState.rows) ? monthState.rows.map(normalizeRow) : [];
    monthState.holidays = normalizeHolidays(monthState.holidays);
    state.months[key] = monthState;
    saveState();
    return monthState;
  }

  function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function getWeekdayLabel(year, month, day) {
    const locale = i18n.getLocale();
    return (WEEKDAY_LABELS[locale] || WEEKDAY_LABELS["zh-Hant"])[new Date(year, month - 1, day).getDay()];
  }

  function getFixedFieldLabel(field) {
    const locale = i18n.getLocale();
    return field.labels[locale] || field.labels["zh-Hant"];
  }

  function renderColumnResizer(key) {
    return '<button type="button" class="schedule-column-resizer" data-resize-key="' + key + '" aria-label="Resize column"></button>';
  }

  function applyColumnWidths() {
    const target = dom.workspace || dom.app;
    Object.keys(DEFAULT_COLUMN_WIDTHS).forEach(function (key) {
      target.style.setProperty("--col-" + key, String(state.columnWidths[key]) + "px");
    });
    target.style.setProperty("--summary-col", String(state.columnWidths.summary) + "px");
  }

  function getVisibleColumnCount() {
    return META_COLUMNS.length + getDaysInMonth(state.selectedYear, state.selectedMonth);
  }

  function getColumnInfo(colIndex) {
    if (colIndex < META_COLUMNS.length) {
      return {
        type: "meta",
        meta: META_COLUMNS[colIndex]
      };
    }

    return {
      type: "schedule",
      day: colIndex - META_COLUMNS.length + 1
    };
  }

  function getGridValue(row, colIndex) {
    const column = getColumnInfo(colIndex);
    if (column.type === "meta") {
      return String(row.employeeSnapshot[column.meta.key] || "");
    }
    return normalizeCellValue(row.shifts[String(column.day)]);
  }

  function setGridValue(row, colIndex, rawValue) {
    const column = getColumnInfo(colIndex);
    if (column.type === "meta") {
      row.sourceType = "manual";
      row.employeeId = "";
      row.employeeSnapshot[column.meta.key] = String(rawValue || "");
      return { previous: null, next: String(rawValue || ""), metaKey: column.meta.key };
    }

    const dayKey = String(column.day);
    const nextValue = normalizeCellValue(rawValue);
    const previous = normalizeCellValue(row.shifts[dayKey]);
    if (nextValue) {
      row.shifts[dayKey] = nextValue;
    } else {
      delete row.shifts[dayKey];
    }
    return { previous: previous, next: nextValue, day: dayKey };
  }

  function renderStaticText() {
    document.title = i18n.t("schedule.pageTitle");
    dom.app.classList.toggle("schedule-app--legend-open", Boolean(state.legendOpen));
    applyLegendScrollLock();
    dom.headerTitle.textContent = i18n.t("home.menu.schedule");
    dom.yearLabel.textContent = i18n.getLocale() === "zh-Hant" ? "年" : i18n.t("schedule.year");
    dom.monthLabel.textContent = i18n.getLocale() === "zh-Hant" ? "月" : i18n.t("schedule.month");
    if (dom.codeLabel) {
      dom.codeLabel.textContent = i18n.getLocale() === "zh-Hant" ? "班碼" : (i18n.getLocale() === "vi" ? "Mã ca" : "Code");
    }
    if (dom.selectionInput) {
      dom.selectionInput.setAttribute("aria-label", i18n.getLocale() === "zh-Hant" ? "輸入班碼" : (i18n.getLocale() === "vi" ? "Nhập mã ca" : "Enter shift code"));
      dom.selectionInput.setAttribute("placeholder", i18n.getLocale() === "zh-Hant" ? "班碼" : (i18n.getLocale() === "vi" ? "Mã ca" : "Code"));
    }
    if (dom.addRowsLabel) {
      dom.addRowsLabel.textContent = i18n.getLocale() === "zh-Hant" ? "新增行" : (i18n.getLocale() === "vi" ? "Thêm hàng" : "Add Rows");
    }
    if (dom.addRowsCount) {
      dom.addRowsCount.setAttribute("aria-label", i18n.getLocale() === "zh-Hant" ? "新增行數" : (i18n.getLocale() === "vi" ? "Số hàng thêm" : "Rows to Add"));
    }
    if (dom.addRowsButton) {
      dom.addRowsButton.setAttribute("aria-label", i18n.getLocale() === "zh-Hant" ? "新增員工列" : (i18n.getLocale() === "vi" ? "Thêm hàng nhân viên" : "Add Employee Rows"));
    }
    if (dom.deleteRowsButton) {
      dom.deleteRowsButton.setAttribute("aria-label", i18n.getLocale() === "zh-Hant" ? "刪除員工列" : (i18n.getLocale() === "vi" ? "Xóa bớt hàng nhân viên" : "Delete Employee Rows"));
    }
    dom.yearSelect.setAttribute("aria-label", i18n.t("schedule.year"));
    dom.monthSelect.setAttribute("aria-label", i18n.t("schedule.month"));
    dom.legendToggle.setAttribute("aria-label", i18n.t("schedule.legend"));
    dom.legendToggle.setAttribute("aria-expanded", String(Boolean(state.legendOpen)));
    dom.legendToggle.textContent = state.legendOpen ? ">>" : "<<";
    dom.legendPanel.setAttribute("aria-label", i18n.t("schedule.legendPanelAria"));
    if (dom.legendTitle) {
      dom.legendTitle.textContent = i18n.t("schedule.legend");
    }
    renderLegendCodeEditToggle();
    renderCornerActions();
    renderModeToggle();
    renderCodeDropdown();
  }

  function renderLocaleControl() {
    if (!dom.localeMount) {
      return;
    }
    const options = i18n.getLocaleOptions().map(function (option) {
      const activeClass = option.value === i18n.getLocale() ? " is-active" : "";
      return [
        '<button type="button" class="yd-locale-option' + activeClass + '" data-locale-value="' + option.value + '">',
        "<span>" + escapeHtml(option.label) + "</span>",
        '<span class="yd-locale-option__check" aria-hidden="true">●</span>',
        "</button>"
      ].join("");
    }).join("");

    dom.localeMount.innerHTML = [
      '<div class="yd-locale-control">',
      '<button type="button" class="yd-locale-button" data-locale-toggle="true" aria-label="' + escapeHtml(i18n.t("common.settings")) + '" aria-expanded="' + String(uiState.localeMenuOpen) + '">',
      '<span class="yd-locale-button__icon" aria-hidden="true">⚙</span>',
      "</button>",
      '<div class="yd-locale-popover"' + (uiState.localeMenuOpen ? "" : " hidden") + ">",
      '<p class="yd-locale-popover__title">' + escapeHtml(i18n.t("common.language")) + "</p>",
      options,
      "</div>",
      "</div>"
    ].join("");
  }

  function populatePeriodOptions() {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let year = WORKBOOK_DEFAULT_YEAR - 2; year <= currentYear + 4; year += 1) {
      years.push('<option value="' + year + '">' + year + "</option>");
    }
    dom.yearSelect.innerHTML = years.join("");

    const months = [];
    for (let month = 1; month <= 12; month += 1) {
      months.push('<option value="' + month + '">' + String(month).padStart(2, "0") + "</option>");
    }
    dom.monthSelect.innerHTML = months.join("");
  }

  function buildShiftCodeDatalist() {
    if (!dom.shiftCodeList) {
      return;
    }
    dom.shiftCodeList.innerHTML = VALID_SHIFT_CODES.map(function (code) {
      return '<option value="' + escapeHtml(code) + '"></option>';
    }).join("");
  }

  function getLegendRemark(code) {
    if (Object.prototype.hasOwnProperty.call(legendRemarks, code)) {
      return String(legendRemarks[code] || "");
    }
    const definition = SHIFT_CODE_MAP[code];
    return definition ? String(definition.remark || "") : "";
  }

  function getLegendCodeLabel(code) {
    if (Object.prototype.hasOwnProperty.call(legendCodeLabels, code)) {
      return String(legendCodeLabels[code] || code);
    }
    return code;
  }

  function refreshScheduleCodeLabels() {
    const monthState = ensureCurrentMonthState();
    renderTableBody(monthState);
    renderDailySummary(monthState);
    renderSelectionState();
    requestFrozenHeaderSync();
  }

  function getLegendCodeEditLabel() {
    if (i18n.getLocale() === "zh-Hant") {
      return uiState.legendCodesEditable ? "鎖定班碼" : "編輯班碼";
    }
    if (i18n.getLocale() === "vi") {
      return uiState.legendCodesEditable ? "Khóa mã" : "Sửa mã";
    }
    return uiState.legendCodesEditable ? "Lock codes" : "Edit codes";
  }

  function renderLegendCodeEditToggle() {
    if (!dom.legendPanel || !dom.legendTitle || !dom.legendTitle.parentElement) {
      return;
    }
    let button = dom.legendPanel.querySelector("[data-legend-code-edit-toggle]");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "schedule-legend__code-edit-toggle";
      button.setAttribute("data-legend-code-edit-toggle", "true");
      dom.legendTitle.parentElement.appendChild(button);
    }
    button.hidden = !uiState.legendListOpen;
    const label = getLegendCodeEditLabel();
    button.textContent = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(Boolean(uiState.legendCodesEditable)));
    dom.legendPanel.classList.toggle("is-code-editing", Boolean(uiState.legendCodesEditable));
  }

  function renderLegendListState() {
    if (!dom.legendContent || !dom.legendListToggle) { return; }
    dom.legendContent.hidden = !uiState.legendListOpen;
    dom.legendListToggle.textContent = uiState.legendListOpen ? "▲" : "▼";
    dom.legendListToggle.setAttribute("aria-expanded", String(Boolean(uiState.legendListOpen)));
    renderLegendCodeEditToggle();
  }

  function renderCalendarState() {
    if (!dom.calendarToggle || !dom.calendarContent) { return; }
    dom.calendarContent.hidden = !uiState.calendarOpen;
    dom.calendarToggle.textContent = uiState.calendarOpen ? "▲" : "▼";
    dom.calendarToggle.setAttribute("aria-expanded", String(Boolean(uiState.calendarOpen)));
    if (uiState.calendarOpen) {
      // Default the calendar to the month currently open on the sheet so marking
      // holidays lines up with what anh đang xem.
      if (dom.calYear) { dom.calYear.value = String(state.selectedYear); }
      if (dom.calMonth) { dom.calMonth.value = String(state.selectedMonth); }
      loadCalHolidaysFromState();
      buildCalendarGrid();
    }
  }

  function loadCalHolidaysFromState() {
    if (!dom.calYear || !dom.calMonth) {
      uiState.calHighlightedDays = [];
      return;
    }
    const year = Number(dom.calYear.value);
    const month = Number(dom.calMonth.value);
    const key = getMonthKeyFor(year, month);
    const raw = state.months[key];
    uiState.calHighlightedDays = normalizeHolidays(raw && raw.holidays).slice();
  }

  function saveCalendarHolidays() {
    if (!dom.calYear || !dom.calMonth) { return; }
    const year = sanitizeYear(dom.calYear.value);
    const month = sanitizeMonth(dom.calMonth.value);
    const monthState = ensureMonthStateFor(year, month);
    monthState.holidays = normalizeHolidays(uiState.calHighlightedDays);
    saveState();
    // If the saved month is the one on screen, refresh holiday markers + OT type hints.
    if (year === state.selectedYear && month === state.selectedMonth) {
      renderAll();
    }
    const count = monthState.holidays.length;
    showFeedback(i18n.getLocale() === "vi"
      ? "Đã lưu " + count + " ngày lễ cho tháng " + month + "/" + year + "."
      : (i18n.getLocale() === "zh-Hant" ? "已儲存 " + count + " 個假日。" : "Saved " + count + " holiday(s)."), "success");
  }

  function buildCalendarGrid() {
    if (!dom.calGrid || !dom.calYear || !dom.calMonth) { return; }
    const year = Number(dom.calYear.value);
    const month = Number(dom.calMonth.value);
    const days = getDaysInMonth(year, month);
    const firstDay = new Date(year, month - 1, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const weekdayLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
    let html = '<div class="schedule-cal__weekdays">';
    weekdayLabels.forEach(function (label) {
      html += '<span class="schedule-cal__weekday-label">' + escapeHtml(label) + '</span>';
    });
    html += '</div><div class="schedule-cal__days">';
    for (let i = 0; i < startOffset; i += 1) {
      html += '<span class="schedule-cal__day schedule-cal__day--empty"></span>';
    }
    for (let day = 1; day <= days; day += 1) {
      const isSelected = uiState.calHighlightedDays.indexOf(day) !== -1;
      html += '<button type="button" class="schedule-cal__day' + (isSelected ? ' is-selected' : '') + '" data-cal-day="' + day + '">' + day + '</button>';
    }
    html += '</div>';
    dom.calGrid.innerHTML = html;
  }

  function initCalendar() {
    if (!dom.calYear || !dom.calMonth) { return; }
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    for (let y = currentYear - 2; y <= currentYear + 3; y += 1) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      if (y === currentYear) { opt.selected = true; }
      dom.calYear.appendChild(opt);
    }
    for (let m = 1; m <= 12; m += 1) {
      const opt = document.createElement("option");
      opt.value = String(m);
      opt.textContent = String(m);
      if (m === currentMonth) { opt.selected = true; }
      dom.calMonth.appendChild(opt);
    }
  }

  function renderCornerActions() {
    dom.app.classList.toggle("schedule-app--schedule-locked", Boolean(uiState.scheduleLocked));
    if (dom.editButton) {
      dom.editButton.textContent = "EDIT";
      dom.editButton.setAttribute("aria-label", "EDIT");
      dom.editButton.hidden = false;
      dom.editButton.disabled = !uiState.scheduleLocked;
      dom.editButton.classList.toggle("is-active", !uiState.scheduleLocked && uiState.hasSavedSchedule);
    }
    if (dom.saveButton) {
      dom.saveButton.textContent = "SAVE";
      dom.saveButton.setAttribute("aria-label", "SAVE");
      dom.saveButton.disabled = Boolean(uiState.scheduleLocked);
      dom.saveButton.classList.toggle("is-locked", Boolean(uiState.scheduleLocked));
    }
    if (dom.exportButton) {
      dom.exportButton.textContent = "EXCEL";
      dom.exportButton.setAttribute("aria-label", "Export Excel");
      dom.exportButton.hidden = !uiState.exportReady;
    }
    if (dom.selectionInput) {
      dom.selectionInput.disabled = Boolean(uiState.scheduleLocked);
    }
    if (dom.addRowsButton) {
      dom.addRowsButton.disabled = Boolean(uiState.scheduleLocked);
    }
    if (dom.deleteRowsButton) {
      dom.deleteRowsButton.disabled = Boolean(uiState.scheduleLocked);
    }
    if (dom.addRowsCount) {
      dom.addRowsCount.disabled = Boolean(uiState.scheduleLocked);
    }
  }

  function buildLegendTable() {
    if (!dom.legendTable || !dom.legendBody) {
      return;
    }
    const headLabels = [
      i18n.t("schedule.legend.shiftCode"),
      i18n.t("schedule.legend.checkIn"),
      i18n.t("schedule.legend.checkOut"),
      i18n.t("schedule.legend.hoursPay"),
      i18n.t("schedule.legend.nightHours"),
      i18n.t("schedule.legend.remark")
    ];
    const headCells = dom.legendTable.querySelectorAll(".schedule-legend-table__label-row th");
    headLabels.forEach(function (label, index) {
      if (headCells[index]) {
        headCells[index].textContent = label;
      }
    });
    dom.legendBody.innerHTML = SHIFT_CODE_DEFINITIONS.map(function (item) {
      const label = getLegendCodeLabel(item.code);
      const codeMarkup = uiState.legendCodesEditable
        ? '<input class="schedule-legend-table__code-input" data-legend-code-label="' + escapeHtml(item.code) + '" type="text" value="' + escapeHtml(label) + '" aria-label="' + escapeHtml(i18n.t("schedule.legend.shiftCode") + " " + item.code) + '">'
        : escapeHtml(label);
      return [
        "<tr>",
        '<td class="schedule-legend-table__cell schedule-legend-table__cell--code" data-code-group="' + getCodeGroup(item.code) + '" title="' + escapeHtml(item.code) + '">' + codeMarkup + "</td>",
        '<td class="schedule-legend-table__cell schedule-legend-table__cell--in" title="' + escapeHtml(item.checkIn) + '">' + escapeHtml(item.checkIn) + "</td>",
        '<td class="schedule-legend-table__cell schedule-legend-table__cell--out" title="' + escapeHtml(item.checkOut) + '">' + escapeHtml(item.checkOut) + "</td>",
        '<td class="schedule-legend-table__cell schedule-legend-table__cell--pay" title="' + escapeHtml(item.hoursPay) + '">' + escapeHtml(item.hoursPay) + "</td>",
        '<td class="schedule-legend-table__cell schedule-legend-table__cell--night" title="' + escapeHtml(item.nightHours) + '">' + escapeHtml(item.nightHours) + "</td>",
        '<td class="schedule-legend-table__remark-cell"><input class="schedule-legend-table__remark-input" data-legend-remark="' + escapeHtml(item.code) + '" type="text" value="' + escapeHtml(getLegendRemark(item.code)) + '" placeholder="" aria-label="' + escapeHtml(i18n.t("schedule.legend.remark") + " " + item.code) + '"></td>',
        "</tr>"
      ].join("");
    }).join("");
  }

  function renderAll() {
    const monthState = ensureCurrentMonthState();
    applyColumnWidths();
    dom.yearSelect.value = String(state.selectedYear);
    dom.monthSelect.value = String(state.selectedMonth);
    renderZoom();
    renderTableHead();
    renderTableBody(monthState);
    renderSummary(monthState);
    renderDailySummary(monthState);
    syncSummarySpacerWidth();
    updateStickyMetrics();
    updateSheetOverflowState();
    requestFrozenHeaderSync();
    renderSelectionState();
    renderSelectionMeta();
    renderLegendListState();
  }

  function renderTableHead() {
    const labels = META_HEADERS[i18n.getLocale()] || META_HEADERS["zh-Hant"];
    const days = getDaysInMonth(state.selectedYear, state.selectedMonth);
    const holidaySet = getMonthHolidaySet(getMonthState());
    let dayRow = "<tr>";
    dayRow += '<th class="schedule-table__meta-head schedule-table__meta--id schedule-table__sticky schedule-table__sticky--id">' + escapeHtml(labels[0]) + renderColumnResizer("id") + "</th>";
    dayRow += '<th class="schedule-table__meta-head schedule-table__meta--department schedule-table__sticky schedule-table__sticky--department">' + escapeHtml(labels[1]) + renderColumnResizer("dept") + "</th>";
    dayRow += '<th class="schedule-table__meta-head schedule-table__meta--vie schedule-table__sticky schedule-table__sticky--vie">' + escapeHtml(labels[2]) + renderColumnResizer("vie") + "</th>";
    dayRow += '<th class="schedule-table__meta-head schedule-table__meta--eng schedule-table__sticky schedule-table__sticky--eng">' + escapeHtml(labels[3]) + renderColumnResizer("eng") + "</th>";
    dayRow += '<th class="schedule-table__meta-head schedule-table__meta--position schedule-table__sticky schedule-table__sticky--position">' + escapeHtml(labels[4]) + renderColumnResizer("position") + "</th>";

    let weekdayRow = "<tr>";
    weekdayRow += '<th class="schedule-table__meta-subhead schedule-table__meta--id schedule-table__sticky schedule-table__sticky--id"></th>';
    weekdayRow += '<th class="schedule-table__meta-subhead schedule-table__meta--department schedule-table__sticky schedule-table__sticky--department"></th>';
    weekdayRow += '<th class="schedule-table__meta-subhead schedule-table__meta--vie schedule-table__sticky schedule-table__sticky--vie"></th>';
    weekdayRow += '<th class="schedule-table__meta-subhead schedule-table__meta--eng schedule-table__sticky schedule-table__sticky--eng"></th>';
    weekdayRow += '<th class="schedule-table__meta-subhead schedule-table__meta--position schedule-table__sticky schedule-table__sticky--position"></th>';
    for (let day = 1; day <= days; day += 1) {
      const holidayClass = holidaySet[day] ? " is-holiday-day" : "";
      dayRow += '<th class="schedule-table__day-head' + holidayClass + '" data-day-head="' + day + '">' + day + renderColumnResizer("day") + "</th>";
      weekdayRow += '<th class="schedule-table__weekday-head' + holidayClass + '">' + escapeHtml(getWeekdayLabel(state.selectedYear, state.selectedMonth, day)) + "</th>";
    }
    const headMarkup = dayRow + "</tr>" + weekdayRow + "</tr>";
    dom.tableHead.innerHTML = headMarkup;
    if (dom.frozenTableHead) {
      dom.frozenTableHead.innerHTML = headMarkup;
    }
  }

  function renderTableBody(monthState) {
    const days = getDaysInMonth(state.selectedYear, state.selectedMonth);
    const holidaySet = getMonthHolidaySet(monthState);
    const bodyRows = monthState.rows.map(function (row, rowIndex) {
      const snapshot = row.employeeSnapshot;
      let html = '<tr class="schedule-table__body-row" data-row-id="' + escapeHtml(row.id) + '" data-row-index="' + rowIndex + '">';
      html += '<td class="schedule-table__meta schedule-table__sticky schedule-table__sticky--id"><div class="schedule-meta-wrap schedule-meta-wrap--id"><button type="button" class="schedule-row-handle" data-row-handle="' + escapeHtml(row.id) + '" draggable="true" aria-label="Reorder">•••</button><button type="button" class="schedule-meta-cell" data-grid-cell="true" data-row-index="' + rowIndex + '" data-col-index="0">' + escapeHtml(snapshot.ydiId) + '</button></div></td>';
      html += '<td class="schedule-table__meta schedule-table__sticky schedule-table__sticky--department"><div class="schedule-meta-wrap"><button type="button" class="schedule-meta-cell" data-grid-cell="true" data-row-index="' + rowIndex + '" data-col-index="1">' + escapeHtml(snapshot.department) + '</button></div></td>';
      html += '<td class="schedule-table__meta schedule-table__sticky schedule-table__sticky--vie"><div class="schedule-meta-wrap"><button type="button" class="schedule-meta-cell" data-grid-cell="true" data-row-index="' + rowIndex + '" data-col-index="2">' + escapeHtml(snapshot.vieName) + '</button></div></td>';
      html += '<td class="schedule-table__meta schedule-table__sticky schedule-table__sticky--eng"><div class="schedule-meta-wrap"><button type="button" class="schedule-meta-cell" data-grid-cell="true" data-row-index="' + rowIndex + '" data-col-index="3">' + escapeHtml(snapshot.engName) + '</button></div></td>';
      html += '<td class="schedule-table__meta schedule-table__sticky schedule-table__sticky--position"><div class="schedule-meta-wrap"><button type="button" class="schedule-meta-cell" data-grid-cell="true" data-row-index="' + rowIndex + '" data-col-index="4">' + escapeHtml(snapshot.position) + '</button></div></td>';
      for (let day = 1; day <= days; day += 1) {
        const code = normalizeCellValue(row.shifts[String(day)]);
        const otEntry = getOvertimeEntry(row, day);
        const codeStyle = getCodeCellStyle(code);
        const styleAttr = codeStyle ? ' style="' + codeStyle + '"' : "";
        const holidayClass = holidaySet[day] ? " is-holiday-cell" : "";
        const otBadge = otEntry
          ? '<span class="schedule-cell__ot-badge" data-ot-type="' + escapeHtml(otEntry.type) + '">' + escapeHtml(getOtBadgeLabel(otEntry)) + '</span>'
          : "";
        html += '<td class="schedule-table__cell"><button type="button" class="schedule-cell' + holidayClass + '" data-grid-cell="true" data-schedule-cell="true" data-row-index="' + rowIndex + '" data-col-index="' + (META_COLUMNS.length + day - 1) + '" data-day="' + day + '" data-code="' + escapeHtml(code) + '" data-code-group="' + escapeHtml(getCodeGroup(code)) + '"' + styleAttr + '>' + renderCellValue(code) + otBadge + '</button></td>';
      }
      return html + '</tr>';
    }).join("");

    dom.tableBody.innerHTML = bodyRows;
  }

  function renderSummary(monthState) {
    const headMarkup = [
      '<tr class="schedule-summary-table__spacer"><th class="schedule-summary-table__blank" colspan="' + SUMMARY_FIELDS.length + '"></th></tr>',
      '<tr class="schedule-summary-table__labels">',
      SUMMARY_FIELDS.map(function (field) {
        return "<th>" + escapeHtml(getFixedFieldLabel(field)) + "</th>";
      }).join(""),
      "</tr>"
    ].join("");

    dom.summaryHead.innerHTML = headMarkup;
    if (dom.frozenSummaryHead) {
      dom.frozenSummaryHead.innerHTML = headMarkup;
    }

    const summaryRows = monthState.rows.map(function (row, rowIndex) {
      const summary = getRowSummary(row);
      return [
        '<tr data-summary-row-index="' + rowIndex + '">',
        SUMMARY_FIELDS.map(function (field) {
          const value = summary[field.id];
          const display = Number(value) ? formatOtHours(value) : "";
          const otClass = field.id.indexOf("ot") === 0 ? " schedule-summary-table__ot-cell" : "";
          return '<td class="' + otClass.trim() + '" data-summary-row-index="' + rowIndex + '" data-summary-field="' + field.id + '">' + escapeHtml(display) + "</td>";
        }).join(""),
        "</tr>"
      ].join("");
    }).join("");

    dom.summaryBody.innerHTML = summaryRows;
  }

  function renderDailySummary(monthState) {
    const days = getDaysInMonth(state.selectedYear, state.selectedMonth);
    const activeCodes = MAJOR_SHIFT_CODES.filter(function (code) {
      return monthState.rows.some(function (row) {
        return Object.keys(row.shifts).some(function (day) {
          return normalizeCellValue(row.shifts[day]) === code;
        });
      });
    });

    if (!activeCodes.length) {
      dom.dailySection.hidden = true;
      dom.dailyHead.innerHTML = "";
      dom.dailyBody.innerHTML = "";
      if (dom.dailySpacerHead) {
        dom.dailySpacerHead.innerHTML = "";
      }
      if (dom.dailySpacerBody) {
        dom.dailySpacerBody.innerHTML = "";
      }
      return;
    }

    dom.dailySection.hidden = false;
    let head = "<tr>";
    head += '<th class="schedule-daily-table__blank schedule-daily-table__spacer--id schedule-daily-table__sticky schedule-daily-table__sticky--id"></th>';
    head += '<th class="schedule-daily-table__blank schedule-daily-table__spacer--department schedule-daily-table__sticky schedule-daily-table__sticky--department"></th>';
    head += '<th class="schedule-daily-table__blank schedule-daily-table__spacer--vie schedule-daily-table__sticky schedule-daily-table__sticky--vie"></th>';
    head += '<th class="schedule-daily-table__blank schedule-daily-table__spacer--eng schedule-daily-table__sticky schedule-daily-table__sticky--eng"></th>';
    head += '<th class="schedule-daily-table__spacer--position schedule-daily-table__sticky schedule-daily-table__sticky--position">' + escapeHtml(i18n.t("schedule.dailyCode")) + "</th>";
    for (let day = 1; day <= days; day += 1) {
      head += '<th data-daily-day-head="' + day + '">' + day + "</th>";
    }
    dom.dailyHead.innerHTML = head + "</tr>";
    if (dom.dailySpacerHead) {
      dom.dailySpacerHead.innerHTML = "<tr>" + SUMMARY_FIELDS.map(function () {
        return '<th class="schedule-daily-spacer-table__blank"></th>';
      }).join("") + "</tr>";
    }

    function dailyMetaPrefix(positionMarkup, trAttrs) {
      let prefix = "<tr" + (trAttrs ? " " + trAttrs : "") + ">";
      prefix += '<td class="schedule-daily-table__blank schedule-daily-table__spacer--id schedule-daily-table__sticky schedule-daily-table__sticky--id"></td>';
      prefix += '<td class="schedule-daily-table__blank schedule-daily-table__spacer--department schedule-daily-table__sticky schedule-daily-table__sticky--department"></td>';
      prefix += '<td class="schedule-daily-table__blank schedule-daily-table__spacer--vie schedule-daily-table__sticky schedule-daily-table__sticky--vie"></td>';
      prefix += '<td class="schedule-daily-table__blank schedule-daily-table__spacer--eng schedule-daily-table__sticky schedule-daily-table__sticky--eng"></td>';
      prefix += '<td class="schedule-daily-table__spacer--position schedule-daily-table__sticky schedule-daily-table__sticky--position">' + positionMarkup + "</td>";
      return prefix;
    }

    const bodyRowsHtml = [];

    activeCodes.forEach(function (code) {
      let row = dailyMetaPrefix(escapeHtml(getLegendCodeLabel(code)), 'data-daily-code-row="' + escapeHtml(code) + '"');
      for (let day = 1; day <= days; day += 1) {
        row += '<td data-daily-code="' + escapeHtml(code) + '" data-daily-day="' + day + '">' + getDailyCount(monthState.rows, code, day) + "</td>";
      }
      bodyRowsHtml.push(row + "</tr>");
    });

    // --- OT daily rows (collapsible) ---
    const otToggleLabel = "Σ OT " + '<span class="schedule-daily-ot-caret">' + (uiState.dailyOtOpen ? "▾" : "▸") + "</span>";
    let otHeaderRow = dailyMetaPrefix('<button type="button" class="schedule-daily-ot-toggle" data-daily-ot-toggle="true">' + otToggleLabel + "</button>", 'class="schedule-daily-ot-row schedule-daily-ot-row--header"');
    for (let day = 1; day <= days; day += 1) {
      const dh = getDailyOtHours(monthState.rows, day);
      otHeaderRow += '<td data-daily-ot-day="' + day + '">' + (dh ? formatOtHours(dh) : "") + "</td>";
    }
    bodyRowsHtml.push(otHeaderRow + "</tr>");

    const otDetailRows = [];
    if (uiState.dailyOtOpen) {
      let peopleRow = dailyMetaPrefix(escapeHtml(otLabel("OT người", "OT people", "OT人數")), 'class="schedule-daily-ot-row"');
      let nightRow = dailyMetaPrefix(escapeHtml(otLabel("OT đêm", "OT night", "夜OT")), 'class="schedule-daily-ot-row"');
      let holidayRow = dailyMetaPrefix(escapeHtml(otLabel("OT lễ", "OT holiday", "節OT")), 'class="schedule-daily-ot-row"');
      for (let day = 1; day <= days; day += 1) {
        const tallies = getDailyOtTallies(monthState.rows, day);
        peopleRow += '<td>' + (tallies.people ? tallies.people : "") + "</td>";
        nightRow += '<td>' + (tallies.night ? formatOtHours(tallies.night) : "") + "</td>";
        holidayRow += '<td>' + (tallies.holiday ? formatOtHours(tallies.holiday) : "") + "</td>";
      }
      otDetailRows.push(peopleRow + "</tr>", nightRow + "</tr>", holidayRow + "</tr>");
    }
    otDetailRows.forEach(function (r) { bodyRowsHtml.push(r); });

    dom.dailyBody.innerHTML = bodyRowsHtml.join("");
    if (dom.dailySpacerBody) {
      dom.dailySpacerBody.innerHTML = bodyRowsHtml.map(function () {
        return "<tr>" + SUMMARY_FIELDS.map(function () {
          return '<td class="schedule-daily-spacer-table__blank"></td>';
        }).join("") + "</tr>";
      }).join("");
    }
  }

  function getDailyCount(rows, code, day) {
    const dayKey = String(day);
    return rows.reduce(function (total, row) {
      return total + (normalizeCellValue(row.shifts[dayKey]) === code ? 1 : 0);
    }, 0);
  }

  function getDailyOtHours(rows, day) {
    const dayKey = String(day);
    let total = 0;
    rows.forEach(function (row) {
      const entry = row.overtime && row.overtime[dayKey];
      if (entry && Number(entry.hours)) {
        total += Number(entry.hours);
      }
    });
    return Math.round(total * 2) / 2;
  }

  function getDailyOtTallies(rows, day) {
    const dayKey = String(day);
    const tallies = { people: 0, night: 0, holiday: 0 };
    rows.forEach(function (row) {
      const entry = row.overtime && row.overtime[dayKey];
      const hours = entry && Number(entry.hours) ? Number(entry.hours) : 0;
      if (!hours) {
        return;
      }
      tallies.people += 1;
      if (entry.type === "night" || entry.type === "holidayNight") {
        tallies.night += hours;
      }
      if (entry.type === "holiday" || entry.type === "holidayNight") {
        tallies.holiday += hours;
      }
    });
    tallies.night = Math.round(tallies.night * 2) / 2;
    tallies.holiday = Math.round(tallies.holiday * 2) / 2;
    return tallies;
  }

  function getRowSummary(row) {
    const dayCount = getDaysInMonth(state.selectedYear, state.selectedMonth);
    const summary = {
      workedDays: 0,
      overtimeCount: 0,
      requiredHours: Math.max(0, (dayCount - 4) * 8),
      actualHours: 0,
      nightHours: 0,
      otHours: 0,
      otNightHours: 0,
      otHolidayHours: 0,
      otPaidHours: 0,
      totalPaidHours: 0
    };
    const shifts = row && row.shifts ? row.shifts : {};
    Object.keys(shifts).forEach(function (day) {
      const code = normalizeCellValue(shifts[day]);
      if (!code) {
        return;
      }
      summary.workedDays += 1;
      const definition = SHIFT_CODE_MAP[code];
      if (definition) {
        summary.actualHours += Number(definition.hoursPay || 0);
        summary.nightHours += Number(definition.nightHours || 0);
      }
    });
    const overtime = row && row.overtime ? row.overtime : {};
    Object.keys(overtime).forEach(function (day) {
      const entry = overtime[day];
      const hours = entry && Number(entry.hours) ? Number(entry.hours) : 0;
      if (!hours) {
        return;
      }
      summary.overtimeCount += 1;
      summary.otHours += hours;
      if (entry.type === "night" || entry.type === "holidayNight") {
        summary.otNightHours += hours;
      }
      if (entry.type === "holiday" || entry.type === "holidayNight") {
        summary.otHolidayHours += hours;
      }
      summary.otPaidHours += hours * (OVERTIME_PAY_MULTIPLIER[entry.type] || 1);
    });
    summary.otHours = Math.round(summary.otHours * 2) / 2;
    summary.otNightHours = Math.round(summary.otNightHours * 2) / 2;
    summary.otHolidayHours = Math.round(summary.otHolidayHours * 2) / 2;
    summary.otPaidHours = Math.round(summary.otPaidHours * 2) / 2;
    summary.totalPaidHours = Math.round((summary.actualHours + summary.otPaidHours) * 2) / 2;
    return summary;
  }

  function getOvertimeEntry(row, day) {
    if (!row || !row.overtime) {
      return null;
    }
    const entry = row.overtime[String(day)];
    return entry && Number(entry.hours) > 0 ? entry : null;
  }

  function getMonthHolidaySet(monthState) {
    const set = {};
    const holidays = monthState && Array.isArray(monthState.holidays) ? monthState.holidays : [];
    holidays.forEach(function (day) { set[Number(day)] = true; });
    return set;
  }

  function bindEvents() {
    dom.yearSelect.addEventListener("change", function () {
      handlePeriodChange(sanitizeYear(dom.yearSelect.value), sanitizeMonth(dom.monthSelect.value));
    });
    dom.monthSelect.addEventListener("change", function () {
      handlePeriodChange(sanitizeYear(dom.yearSelect.value), sanitizeMonth(dom.monthSelect.value));
    });
    if (dom.addRowsButton) {
      dom.addRowsButton.addEventListener("click", handleAddRows);
    }
    if (dom.deleteRowsButton) {
      dom.deleteRowsButton.addEventListener("click", handleDeleteRows);
    }
    if (dom.editButton) {
      dom.editButton.addEventListener("click", handleEditSchedule);
    }
    if (dom.saveButton) {
      dom.saveButton.addEventListener("click", handleManualSave);
    }
    if (dom.exportButton) {
      dom.exportButton.addEventListener("click", exportCurrentMonthExcel);
    }
    if (dom.modeShift) {
      dom.modeShift.addEventListener("click", function () { setInputMode("shift"); });
    }
    if (dom.modeOt) {
      dom.modeOt.addEventListener("click", function () { setInputMode("overtime"); });
    }
    if (dom.addRowsCount) {
      dom.addRowsCount.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          handleAddRows();
        }
      });
    }
    dom.legendToggle.addEventListener("click", function () {
      state.legendOpen = !state.legendOpen;
      saveState();
      renderStaticText();
      window.requestAnimationFrame(function () {
        updateStickyMetrics();
        updateSheetOverflowState();
      });
      window.setTimeout(function () {
        updateStickyMetrics();
        updateSheetOverflowState();
      }, 220);
    });
    const legendListHead = dom.legendListToggle ? dom.legendListToggle.closest(".schedule-legend__head") : null;
    if (legendListHead) {
      legendListHead.addEventListener("click", function (event) {
        if (event.target.closest("[data-legend-code-edit-toggle]")) { return; }
        uiState.legendListOpen = !uiState.legendListOpen;
        renderLegendListState();
      });
    }
    const calendarHead = dom.calendarToggle ? dom.calendarToggle.closest(".schedule-legend__head") : null;
    if (calendarHead) {
      calendarHead.addEventListener("click", function () {
        uiState.calendarOpen = !uiState.calendarOpen;
        renderCalendarState();
      });
    }
    if (dom.calYear) {
      dom.calYear.addEventListener("change", function () {
        loadCalHolidaysFromState();
        buildCalendarGrid();
      });
    }
    if (dom.calMonth) {
      dom.calMonth.addEventListener("change", function () {
        loadCalHolidaysFromState();
        buildCalendarGrid();
      });
    }
    if (dom.calGrid) {
      dom.calGrid.addEventListener("click", function (event) {
        const dayBtn = event.target.closest("[data-cal-day]");
        if (!dayBtn) { return; }
        const day = Number(dayBtn.getAttribute("data-cal-day"));
        if (!day) { return; }
        const idx = uiState.calHighlightedDays.indexOf(day);
        if (idx === -1) {
          uiState.calHighlightedDays.push(day);
        } else {
          uiState.calHighlightedDays.splice(idx, 1);
        }
        buildCalendarGrid();
      });
    }
    if (dom.calSave) {
      dom.calSave.addEventListener("click", saveCalendarHolidays);
    }
    if (dom.legendBody) {
      dom.legendBody.addEventListener("change", function (event) {
        const codeInput = event.target.closest("[data-legend-code-label]");
        if (codeInput) {
          const code = codeInput.getAttribute("data-legend-code-label");
          const value = String(codeInput.value || "").trim();
          
          // Duplicate check
          if (value) {
            const isDuplicate = VALID_SHIFT_CODES.some(function(c) {
              return c !== code && (legendCodeLabels[c] === value || (c === value && !legendCodeLabels[c]));
            });
            
            if (isDuplicate) {
              const prevValue = legendCodeLabels[code] || code;
              codeInput.value = prevValue;
              showFeedback(i18n.getLocale() === "vi" ? "Mã ca này đã tồn tại, vui lòng nhập mã khác." : "This shift code already exists.", "error");
              return;
            }
          }

          if (value && value !== code) {
            legendCodeLabels[code] = value;
          } else {
            delete legendCodeLabels[code];
            codeInput.value = code; // restore default
          }
          saveLegendCodeLabels();
          refreshScheduleCodeLabels();
          return;
        }
      });
      dom.legendBody.addEventListener("input", function (event) {
        const input = event.target.closest("[data-legend-remark]");
        if (!input) {
          return;
        }
        legendRemarks[input.getAttribute("data-legend-remark")] = input.value;
        saveLegendRemarks();
      });
    }
    if (dom.legendPanel) {
      dom.legendPanel.addEventListener("click", function (event) {
        const toggle = event.target.closest("[data-legend-code-edit-toggle]");
        if (!toggle) {
          return;
        }
        event.preventDefault();
        uiState.legendCodesEditable = !uiState.legendCodesEditable;
        renderLegendCodeEditToggle();
        buildLegendTable();
      });
    }
    dom.localeMount.addEventListener("click", function (event) {
      const toggle = event.target.closest("[data-locale-toggle]");
      const option = event.target.closest("[data-locale-value]");
      if (toggle) {
        event.stopPropagation();
        uiState.localeMenuOpen = !uiState.localeMenuOpen;
        renderLocaleControl();
        return;
      }
      if (!option) {
        return;
      }
      event.stopPropagation();
      uiState.localeMenuOpen = false;
      i18n.setLocale(option.getAttribute("data-locale-value"));
      renderStaticText();
      renderLocaleControl();
      buildLegendTable();
      renderAll();
    });
    document.addEventListener("click", function (event) {
      if (uiState.localeMenuOpen && dom.localeMount && !dom.localeMount.contains(event.target)) {
        uiState.localeMenuOpen = false;
        renderLocaleControl();
      }
      if (uiState.codeDropdownOpen && dom.codeDropdown && !dom.codeDropdown.contains(event.target) && event.target !== dom.selectionInput) {
        hideCodeDropdown();
      }
      if (otDraft && otPopoverEl && !otPopoverEl.contains(event.target) && !event.target.closest("[data-schedule-cell]")) {
        closeOvertimePopover();
      }
      if (state.legendOpen && dom.legendPanel && !dom.legendPanel.contains(event.target) && !dom.legendToggle.contains(event.target)) {
        state.legendOpen = false;
        saveState();
        renderStaticText();
        window.requestAnimationFrame(function () {
          updateStickyMetrics();
          updateSheetOverflowState();
        });
      }
    });
    dom.selectionInput.addEventListener("input", function () {
      dom.selectionInput.value = normalizeCellValue(dom.selectionInput.value);
      uiState.codeDropdownOpen = true;
      uiState.codeDropdownIndex = -1;
      renderCodeDropdown();
    });
    dom.selectionInput.addEventListener("keydown", function (event) {
      if (handleCodeDropdownKeydown(event)) {
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        hideCodeDropdown();
        applySelectionInput();
      }
    });
    dom.selectionInput.addEventListener("click", function () {
      uiState.codeDropdownOpen = true;
      uiState.codeDropdownIndex = -1;
      renderCodeDropdown();
    });
    dom.selectionInput.addEventListener("blur", function () {
      window.setTimeout(hideCodeDropdown, 120);
    });
    if (dom.codeDropdown) {
      dom.codeDropdown.addEventListener("mousedown", function (event) {
        event.preventDefault();
      });
      dom.codeDropdown.addEventListener("click", function (event) {
        const option = event.target.closest("[data-shift-suggestion]");
        if (!option) {
          return;
        }
        dom.selectionInput.value = option.getAttribute("data-shift-suggestion") || "";
        uiState.codeDropdownIndex = -1;
        hideCodeDropdown();
        focusSelectionInput();
      });
    }
    if (dom.legendPanel && dom.legendContent) {
      dom.legendPanel.addEventListener("wheel", function (event) {
        if (!state.legendOpen) {
          return;
        }

        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        dom.legendContent.scrollTop += event.deltaY;
      }, { passive: false });
    }
    dom.sheetScroll.addEventListener("wheel", function (event) {
      if (!event.ctrlKey) {
        if (state.legendOpen) {
          event.preventDefault();
          return;
        }
        return;
      }
      event.preventDefault();
      adjustZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
    }, { passive: false });
    [dom.header, dom.periodBar, dom.frozenLayer].forEach(function (surface) {
      if (!surface) {
        return;
      }
      surface.addEventListener("wheel", handleLockedSurfaceWheel, { passive: false });
    });
    dom.tableBody.addEventListener("mousedown", handleCellPointerStart);
    dom.tableBody.addEventListener("mouseover", handleCellPointerMove);
    dom.tableBody.addEventListener("dblclick", handleCellDoubleClick);
    if (dom.dailyBody) {
      dom.dailyBody.addEventListener("click", function (event) {
        if (event.target.closest("[data-daily-ot-toggle]")) {
          uiState.dailyOtOpen = !uiState.dailyOtOpen;
          renderDailySummary(ensureCurrentMonthState());
          syncSummarySpacerWidth();
          requestFrozenHeaderSync();
        }
      });
    }
    dom.tableHead.addEventListener("mousedown", handleResizePointerStart);
    dom.tableHead.addEventListener("dblclick", handleResizeAutoFit);
    if (dom.frozenTableHead) {
      dom.frozenTableHead.addEventListener("mousedown", handleResizePointerStart);
      dom.frozenTableHead.addEventListener("dblclick", handleResizeAutoFit);
    }
    document.addEventListener("mousemove", handleResizePointerMove);
    document.addEventListener("mouseup", function () {
      uiState.isSelecting = false;
      if (uiState.columnResize) {
        saveState();
        updateSheetOverflowState();
      }
      uiState.columnResize = null;
    });
    dom.tableBody.addEventListener("dragstart", handleDragStart);
    dom.tableBody.addEventListener("dragover", handleDragOver);
    dom.tableBody.addEventListener("drop", handleDrop);
    dom.tableBody.addEventListener("dragend", clearDragState);
    dom.sheetScroll.addEventListener("scroll", requestFrozenHeaderSync, { passive: true });
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    window.addEventListener("keydown", handleGlobalKeydown);
    window.addEventListener("resize", updateStickyMetrics, { passive: true });
    window.addEventListener("resize", updateSheetOverflowState, { passive: true });
  }

  function observeStickyMetrics() {
    if (typeof ResizeObserver === "function" && !uiState.stickyMetricsObserver) {
      uiState.stickyMetricsObserver = new ResizeObserver(function () {
        updateStickyMetrics();
        updateSheetOverflowState();
      });
      [
        dom.header,
        dom.periodBar,
        dom.sheetFrame,
        dom.tableHead,
        dom.summaryHead
      ].forEach(function (target) {
        if (target) {
          uiState.stickyMetricsObserver.observe(target);
        }
      });
    }

    if (document.fonts && typeof document.fonts.ready?.then === "function") {
      document.fonts.ready.then(function () {
        window.requestAnimationFrame(function () {
          updateStickyMetrics();
          updateSheetOverflowState();
        });
      }).catch(function () {
        updateStickyMetrics();
      });
    }

    if (document.fonts && typeof document.fonts.addEventListener === "function") {
      const refreshStickyMetrics = function () {
        window.requestAnimationFrame(function () {
          updateStickyMetrics();
          updateSheetOverflowState();
        });
      };
      document.fonts.addEventListener("loadingdone", refreshStickyMetrics);
      document.fonts.addEventListener("loadingerror", refreshStickyMetrics);
    }
  }

  function handlePeriodChange(year, month) {
    closeOvertimePopover();
    const previousKey = getCurrentMonthKey();
    state.selectedYear = year;
    state.selectedMonth = month;
    ensureCurrentMonthState();
    saveState();
    if (uiState.history.length && previousKey !== getCurrentMonthKey()) {
      uiState.history = [];
      showFeedback(i18n.t("schedule.feedback.undoMonthChanged"), "success");
    }
    clearSelection(false);
    renderAll();
  }

  function getLockedFeedback() {
    if (i18n.getLocale() === "vi") {
      return "Bang lich dang khoa.";
    }
    if (i18n.getLocale() === "zh-Hant") {
      return "Schedule locked.";
    }
    return "Schedule locked.";
  }

  function lockScheduleAfterSave() {
    uiState.scheduleLocked = true;
    uiState.hasSavedSchedule = true;
    uiState.exportReady = true;
    renderCornerActions();
    clearSelection(true);
  }

  function handleEditSchedule() {
    uiState.scheduleLocked = false;
    uiState.exportReady = false;
    renderCornerActions();
    showFeedback("Edit mode enabled.", "success");
  }

  function handleManualSave() {
    if (uiState.scheduleLocked) {
      return;
    }
    saveState();
    saveLegendRemarks();
    saveLegendCodeLabels();
    lockScheduleAfterSave();
    showFeedback("Saved. Schedule is locked.", "success");
  }

  function exportCurrentMonthExcel() {
    if (!uiState.exportReady) {
      return;
    }
    const workbookXml = buildCurrentMonthExcelWorkbookXml();
    const blob = new Blob(["\ufeff", workbookXml], { type: "application/vnd.ms-excel;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "schedule_" + state.selectedYear + "_" + String(state.selectedMonth).padStart(2, "0") + ".xls";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
    showFeedback("Excel file exported.", "success");
  }

  function buildCurrentMonthExcelWorkbookXml() {
    const monthState = ensureCurrentMonthState();
    const scheduleLastRow = Math.max(60, 4 + monthState.rows.length);
    const bottomStartRow = scheduleLastRow + 2;
    const bottomLastRow = bottomStartRow + SHIFT_CODE_DEFINITIONS.length - 1;
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<?mso-application progid="Excel.Sheet"?>',
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ',
      'xmlns:o="urn:schemas-microsoft-com:office:office" ',
      'xmlns:x="urn:schemas-microsoft-com:office:excel" ',
      'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" ',
      'xmlns:html="http://www.w3.org/TR/REC-html40">',
      '<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Author>YiDing</Author></DocumentProperties>',
      buildExcelXmlStyles(),
      buildScheduleWorksheetXml(monthState.rows, scheduleLastRow, bottomStartRow, bottomLastRow),
      buildShiftDefinitionsWorksheetXml(),
      '</Workbook>'
    ].join("");
  }

  function buildExcelXmlStyles() {
    return [
      '<Styles>',
      '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style>',
      buildExcelXmlStyle("sGrid", null, null),
      buildExcelXmlStyle("sLabel", "#DDEBF7", null),
      buildExcelXmlStyle("sTitle", "#FFF2CC", null),
      buildExcelXmlStyle("sDay", "#9FD0FF", 'd'),
      buildExcelXmlStyle("sWeekend", "#FF1F1F", 'd'),
      buildExcelXmlStyle("sWeekday", "#9FD0FF", null),
      buildExcelXmlStyle("sWeekendText", "#FF1F1F", null),
      buildExcelXmlStyle("sCodeA", "#FFF36D", null),
      buildExcelXmlStyle("sCodeB", "#F4B6CB", null),
      buildExcelXmlStyle("sCodeC", "#C9B6E8", null),
      buildExcelXmlStyle("sCodeLeave", "#FF5A5A", null),
      buildExcelXmlStyle("sCodeOff", "#FF1F1F", null),
      buildExcelXmlStyle("sCodeOther", "#F7D7A7", null),
      buildExcelXmlStyle("sSummary", null, null),
      buildExcelXmlStyle("sDaily", "#93D18B", null),
      buildExcelXmlStyle("sHidden", null, null),
      '</Styles>'
    ].join("");
  }

  function buildExcelXmlStyle(id, fillColor, numberFormat) {
    return [
      '<Style ss:ID="' + id + '">',
      '<Alignment ss:Horizontal="Center" ss:Vertical="Center"/>',
      '<Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/>',
      '<Borders>',
      '<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>',
      '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>',
      '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>',
      '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>',
      '</Borders>',
      fillColor ? '<Interior ss:Color="' + fillColor + '" ss:Pattern="Solid"/>' : '',
      numberFormat ? '<NumberFormat ss:Format="' + numberFormat + '"/>' : '',
      '</Style>'
    ].join("");
  }

  function buildScheduleWorksheetXml(rows, scheduleLastRow, bottomStartRow, bottomLastRow) {
    const rowXml = [];
    for (let rowIndex = 1; rowIndex <= bottomLastRow; rowIndex += 1) {
      const cells = buildScheduleWorksheetRowCells(rowIndex, rows, scheduleLastRow, bottomStartRow);
      if (cells.length) {
        rowXml.push(excelXmlRow(rowIndex, cells));
      }
    }
    return [
      '<Worksheet ss:Name="Sheet1">',
      '<Table ss:ExpandedColumnCount="84" ss:ExpandedRowCount="' + bottomLastRow + '" x:FullColumns="1" x:FullRows="1">',
      buildScheduleWorksheetColumnsXml(),
      rowXml.join(""),
      '</Table>',
      buildScheduleWorksheetOptionsXml(),
      '</Worksheet>'
    ].join("");
  }

  function buildScheduleWorksheetColumnsXml() {
    return [
      '<Column ss:AutoFitWidth="0" ss:Width="73"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="180"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="218"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="94"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="113"/>',
      '<Column ss:Index="6" ss:AutoFitWidth="0" ss:Span="30" ss:Width="41"/>',
      '<Column ss:Index="37" ss:AutoFitWidth="0" ss:Width="42"/>',
      '<Column ss:Index="38" ss:AutoFitWidth="0" ss:Span="8" ss:Width="41"/>',
      '<Column ss:Index="47" ss:AutoFitWidth="0" ss:Span="4" ss:Width="41"/>',
      '<Column ss:Index="52" ss:AutoFitWidth="0" ss:Width="42"/>',
      '<Column ss:Index="53" ss:AutoFitWidth="0" ss:Width="70"/>',
      '<Column ss:Index="54" ss:AutoFitWidth="0" ss:Width="70"/>',
      '<Column ss:Index="55" ss:AutoFitWidth="0" ss:Width="90"/>',
      '<Column ss:Index="56" ss:AutoFitWidth="0" ss:Width="80"/>',
      '<Column ss:Index="57" ss:AutoFitWidth="0" ss:Width="90"/>',
      '<Column ss:Index="74" ss:Hidden="1" ss:AutoFitWidth="0" ss:Span="10" ss:Width="0"/>'
    ].join("");
  }

  function buildScheduleWorksheetOptionsXml() {
    return [
      '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">',
      '<FreezePanes/>',
      '<FrozenNoSplit/>',
      '<SplitHorizontal>3</SplitHorizontal>',
      '<TopRowBottomPane>3</TopRowBottomPane>',
      '<SplitVertical>5</SplitVertical>',
      '<LeftColumnRightPane>5</LeftColumnRightPane>',
      '<ActivePane>0</ActivePane>',
      '<ProtectObjects>False</ProtectObjects>',
      '<ProtectScenarios>False</ProtectScenarios>',
      '</WorksheetOptions>'
    ].join("");
  }

  function buildScheduleWorksheetRowCells(rowIndex, rows, scheduleLastRow, bottomStartRow) {
    const cells = [];
    const days = getDaysInMonth(state.selectedYear, state.selectedMonth);
    const summaryColumns = getExcelSummaryColumns(rows);
    if (rowIndex === 1) {
      cells.push(excelXmlCell(2, "\u5e74", "sLabel"));
      cells.push(excelXmlCell(3, state.selectedYear, "sTitle", "Number"));
      cells.push(excelXmlCell(4, "\u6708", "sLabel"));
      cells.push(excelXmlCell(5, state.selectedMonth, "sTitle", "Number"));
      cells.push(excelXmlCell(84, days, "sHidden", "Number", '=DAY(EOMONTH(DATE($C$1,$E$1,1),0))'));
    }
    if (rowIndex === 3) {
      for (let colIndex = 6; colIndex <= 36; colIndex += 1) {
        const day = colIndex - 5;
        const style = isExcelWeekendColumn(colIndex) ? "sWeekend" : "sDay";
        const value = day <= days ? excelXmlDateValue(state.selectedYear, state.selectedMonth, day) : "";
        cells.push(excelXmlCell(colIndex, value, style, "DateTime", '=IF(COLUMN()-COLUMN($F$3)+1<=$CF$1,DATE($C$1,$E$1,COLUMN()-COLUMN($F$3)+1),"")'));
      }
      addFixedSummaryTimeCells(cells);
    }
    if (rowIndex === 4) {
      const metaLabels = META_HEADERS[i18n.getLocale()] || META_HEADERS.en;
      metaLabels.forEach(function (label, index) {
        cells.push(excelXmlCell(index + 1, label, "sGrid"));
      });
      for (let colIndex = 6; colIndex <= 36; colIndex += 1) {
        const day = colIndex - 5;
        const style = isExcelWeekendColumn(colIndex) ? "sWeekendText" : "sWeekday";
        const value = day <= days ? getExcelWeekdayLabel(day) : "";
        cells.push(excelXmlCell(colIndex, value, style, "String"));
      }
      addFixedSummaryHeaderCells(cells);
    }
    if (rowIndex === bottomStartRow - 1) {
      cells.push(excelXmlCell(5, i18n.t("schedule.dailyCode"), "sGrid"));
      for (let colIndex = 6; colIndex <= 36; colIndex += 1) {
        const day = colIndex - 5;
        if (day <= days) {
          const style = isExcelWeekendColumn(colIndex) ? "sWeekend" : "sDay";
          cells.push(excelXmlCell(colIndex, day, style, "Number"));
        }
      }
    }
    if (rowIndex >= 5 && rowIndex <= scheduleLastRow) {
      addScheduleDataCells(cells, rows[rowIndex - 5], rowIndex, days);
      addFixedSummaryFormulaCells(cells, rows[rowIndex - 5], rowIndex);
    }
    if (rowIndex >= bottomStartRow && rowIndex < bottomStartRow + SHIFT_CODE_DEFINITIONS.length) {
      addDailySummaryFormulaCells(cells, rows, rowIndex, scheduleLastRow, bottomStartRow);
    }
    addShiftOrderHelperCells(cells, rows, rowIndex, scheduleLastRow);
    return cells.sort(function (a, b) {
      return a.index - b.index;
    });
  }

  function addScheduleDataCells(cells, row, rowIndex, days) {
    META_COLUMNS.forEach(function (column, index) {
      const value = row && row.employeeSnapshot ? row.employeeSnapshot[column.key] : "";
      cells.push(excelXmlCell(index + 1, value || "", "sGrid"));
    });
    for (let day = 1; day <= 31; day += 1) {
      const colIndex = day + 5;
      const code = row && day <= days ? normalizeCellValue(row.shifts[String(day)]) : "";
      cells.push(excelXmlCell(colIndex, code, getExcelXmlCodeStyle(code)));
    }
  }

  // Fixed summary columns matching real Excel (col 37-57)
  var FIXED_SUMMARY_COLS = [
    { col: 37, code: "_TOTAL",      label: "TL",              time: null },
    { col: 38, code: "A",           label: "A",               time: "7-15" },
    { col: 39, code: "B",           label: "B",               time: "15-23" },
    { col: 40, code: "C",           label: "C",               time: "23-7" },
    { col: 41, code: "A3",          label: "A3",              time: "10-18" },
    { col: 42, code: "A4",          label: "A4",              time: "11-19" },
    { col: 43, code: "A5",          label: "A5",              time: "12-20" },
    { col: 44, code: "B2",          label: "B2",              time: "17-1" },
    { col: 45, code: "B4",          label: "B4",              time: "19-3" },
    { col: 46, code: "B6",          label: "B6",              time: "21-5" },
    { col: 47, code: "OFF",         label: "OFF",             time: null },
    { col: 48, code: "PH",          label: "PH",              time: null },
    { col: 49, code: "TL",          label: "TL",              time: null },
    { col: 50, code: "AL",          label: "AL",              time: null },
    { col: 51, code: "BL",          label: "BL",              time: null },
    { col: 52, code: "_OT",         label: "\u52a0\u73ed",              time: null },
    { col: 53, code: "_REQ",        label: "\u5e94\u4e0a\u65f6\u6570",       time: null },
    { col: 54, code: "_ACT",        label: "\u5b9e\u9645\u65f6\u6570",       time: null },
    { col: 55, code: "_NIGHT",      label: "\u591c\u73ed\u8865\u8d34(\u65f6\u6570)", time: null },
    { col: 56, code: "_NIGHTOT",    label: "\u591c\u73edOT\u8865\u8d34",     time: null },
    { col: 57, code: "_NIGHTTOTAL", label: "\u591c\u73ed\u8865\u8d34\u5408\u8ba1",   time: null }
  ];

  function addFixedSummaryTimeCells(cells) {
    FIXED_SUMMARY_COLS.forEach(function (col) {
      if (col.time) {
        cells.push(excelXmlCell(col.col, col.time, "sSummary", "String"));
      }
    });
  }

  function addFixedSummaryHeaderCells(cells) {
    FIXED_SUMMARY_COLS.forEach(function (col) {
      cells.push(excelXmlCell(col.col, col.label, "sSummary", "String"));
    });
  }

  function addFixedSummaryFormulaCells(cells, row, rowIndex) {
    var rowRange = '$F' + rowIndex + ':INDEX($F' + rowIndex + ':$AJ' + rowIndex + ',$CF$1)';
    var summary = getExcelRowSummaryValue(row);
    FIXED_SUMMARY_COLS.forEach(function (col) {
      var formula, value;
      if (col.code === "_TOTAL") {
        value = (row && hasExcelShiftValue(row)) ? getExcelRowTotalCount(row) : "";
        formula = '=IF(COUNTA(' + rowRange + ')=0,"",COUNTA(' + rowRange + '))';
      } else if (col.code === "_OT") {
        value = summary.overtimeCount;
        formula = '=IF(COUNTA(' + rowRange + ')=0,"",COUNTIF(' + rowRange + ',"\u52a0"))';
      } else if (col.code === "_REQ") {
        value = summary.requiredHours;
        formula = '=IF(COUNTA(' + rowRange + ')=0,"",($CF$1-4)*8)';
      } else if (col.code === "_ACT") {
        value = summary.actualHours;
        formula = '=IF(COUNTA(' + rowRange + ')=0,"",SUMPRODUCT(COUNTIF(' + rowRange + ',Sheet2!$A$2:$A$32),Sheet2!$D$2:$D$32))';
      } else if (col.code === "_NIGHT") {
        value = summary.nightHours;
        formula = '=IF(COUNTA(' + rowRange + ')=0,"",SUMPRODUCT(COUNTIF(' + rowRange + ',Sheet2!$A$2:$A$32),Sheet2!$E$2:$E$32))';
      } else if (col.code === "_NIGHTOT") {
        value = "";
        formula = '=IF(COUNTA(' + rowRange + ')=0,"",0)';
      } else if (col.code === "_NIGHTTOTAL") {
        value = summary.nightHours;
        var nightCol = excelColName(55);
        var nightOtCol = excelColName(56);
        formula = '=IF(COUNTA(' + rowRange + ')=0,"",' + nightCol + rowIndex + '+' + nightOtCol + rowIndex + ')';
      } else {
        // Regular shift code COUNTIF
        value = (row && hasExcelShiftValue(row)) ? getExcelRowShiftCount(row, col.code) : "";
        formula = '=IF(COUNTA(' + rowRange + ')=0,"",COUNTIF(' + rowRange + ',"' + col.code + '"))';
      }
      cells.push(excelXmlCell(col.col, value, "sSummary", typeof value === "number" ? "Number" : "String", formula));
    });
  }

  function addDailySummaryFormulaCells(cells, rows, rowIndex, scheduleLastRow, bottomStartRow) {
    const activeCodes = getExcelActiveSummaryCodes(rows);
    const code = activeCodes[rowIndex - bottomStartRow] || "";
    cells.push(excelXmlCell(5, code, "sSummary", "String"));
    for (let colIndex = 6; colIndex <= 36; colIndex += 1) {
      const day = colIndex - 5;
      const colName = excelColName(colIndex);
      const value = code && day <= getDaysInMonth(state.selectedYear, state.selectedMonth)
        ? getDailyCount(rows, code, day)
        : "";
      cells.push(excelXmlCell(colIndex, value, "sDaily", "Number", '=IF(OR($E' + rowIndex + '="",' + colName + '$3=""),"",COUNTIF(' + colName + '$5:' + colName + '$' + scheduleLastRow + ',$E' + rowIndex + '))'));
    }
  }

  function addShiftOrderHelperCells(cells, rows, rowIndex, scheduleLastRow) {
    if (rowIndex < 2 || rowIndex > 32) {
      return;
    }
    const sheet2Row = getExcelShiftOrderSheet2Row(rowIndex);
    const code = getExcelShiftCodeBySheet2Row(sheet2Row);
    const count = getExcelShiftCount(rows, code);
    const rank = count > 0 ? getExcelPositiveShiftRank(rows, rowIndex) : "";
    cells.push(excelXmlCell(74, code, "sHidden", "String", '=Sheet2!A' + sheet2Row));
    cells.push(excelXmlCell(75, count, "sHidden", "Number", '=COUNTIF($F$5:INDEX($F$5:$AJ$' + scheduleLastRow + ',ROWS($F$5:$AJ$' + scheduleLastRow + '),$CF$1),BV' + rowIndex + ')'));
    cells.push(excelXmlCell(76, rank, "sHidden", "Number", '=IF(BW' + rowIndex + '>0,COUNTIF($BW$2:BW' + rowIndex + ',">0"),"")'));
    cells.push(excelXmlCell(77, code, "sHidden", "String", '=Sheet2!A' + sheet2Row));
    cells.push(excelXmlCell(78, count, "sHidden", "Number", '=COUNTIF($F$5:INDEX($F$5:$AJ$' + scheduleLastRow + ',ROWS($F$5:$AJ$' + scheduleLastRow + '),$CF$1),BY' + rowIndex + ')'));
    cells.push(excelXmlCell(79, rank, "sHidden", "Number", '=IF(BZ' + rowIndex + '>0,COUNTIF($BZ$2:BZ' + rowIndex + ',">0"),"")'));
  }

  function getExcelShiftOrderSheet2Row(rowIndex) {
    const order = [2, 10, 18, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
    return order[rowIndex - 2] || rowIndex;
  }

  function getExcelShiftCodeBySheet2Row(sheet2Row) {
    const definition = SHIFT_CODE_DEFINITIONS[sheet2Row - 2];
    return definition ? definition.code : "";
  }

  function getExcelShiftOrderCodes() {
    const codes = [];
    for (let rowIndex = 2; rowIndex <= 32; rowIndex += 1) {
      const code = getExcelShiftCodeBySheet2Row(getExcelShiftOrderSheet2Row(rowIndex));
      if (code) {
        codes.push(code);
      }
    }
    return codes;
  }

  function getExcelActiveSummaryCodes(rows) {
    return getExcelShiftOrderCodes().filter(function (code) {
      return getExcelShiftCount(rows, code) > 0;
    });
  }

  function getExcelSummaryColumns(rows) {
    return getExcelActiveSummaryCodes(rows).concat([
      "\u52a0\u73ed",
      "\u5e94\u4e0a\u65f6\u6570",
      "\u5b9e\u9645\u65f6\u6570",
      "\u591c\u73ed\u8865\u8d34(\u65f6\u6570)"
    ]);
  }

  function getExcelShiftCount(rows, code) {
    if (!code) {
      return 0;
    }
    const days = getDaysInMonth(state.selectedYear, state.selectedMonth);
    return rows.reduce(function (total, row) {
      for (let day = 1; day <= days; day += 1) {
        if (normalizeCellValue(row.shifts[String(day)]) === code) {
          total += 1;
        }
      }
      return total;
    }, 0);
  }

  function getExcelPositiveShiftRank(rows, rowIndex) {
    let rank = 0;
    for (let currentRowIndex = 2; currentRowIndex <= rowIndex; currentRowIndex += 1) {
      const code = getExcelShiftCodeBySheet2Row(getExcelShiftOrderSheet2Row(currentRowIndex));
      if (getExcelShiftCount(rows, code) > 0) {
        rank += 1;
      }
    }
    return rank;
  }

  function getExcelSummaryTimeValue(label) {
    const definition = SHIFT_CODE_MAP[label];
    if (!definition || !isFinite(Number(definition.checkIn)) || !isFinite(Number(definition.checkOut))) {
      return "";
    }
    return String(definition.checkIn) + "-" + String(definition.checkOut);
  }

  function getExcelSummaryCellValue(row, label, rowSummary) {
    if (!row || !label || !hasExcelShiftValue(row)) {
      return "";
    }
    if (label === "\u52a0\u73ed") {
      return rowSummary.overtimeCount;
    }
    if (label === "\u5e94\u4e0a\u65f6\u6570") {
      return rowSummary.requiredHours;
    }
    if (label === "\u5b9e\u9645\u65f6\u6570") {
      return rowSummary.actualHours;
    }
    if (label === "\u591c\u73ed\u8865\u8d34(\u65f6\u6570)") {
      return rowSummary.nightHours;
    }
    return getExcelRowShiftCount(row, label);
  }

  function getExcelRowSummaryValue(row) {
    if (!row || !hasExcelShiftValue(row)) {
      return {
        overtimeCount: "",
        requiredHours: "",
        actualHours: "",
        nightHours: ""
      };
    }
    return getRowSummary(row);
  }

  function getExcelRowShiftCount(row, code) {
    const days = getDaysInMonth(state.selectedYear, state.selectedMonth);
    let count = 0;
    for (let day = 1; day <= days; day += 1) {
      if (normalizeCellValue(row.shifts[String(day)]) === code) {
        count += 1;
      }
    }
    return count;
  }

  function hasExcelShiftValue(row) {
    if (!row || !row.shifts) {
      return false;
    }
    const days = getDaysInMonth(state.selectedYear, state.selectedMonth);
    for (let day = 1; day <= days; day += 1) {
      if (normalizeCellValue(row.shifts[String(day)])) {
        return true;
      }
    }
    return false;
  }

  function getExcelRowTotalCount(row) {
    if (!row || !row.shifts) { return ""; }
    const days = getDaysInMonth(state.selectedYear, state.selectedMonth);
    let count = 0;
    for (let day = 1; day <= days; day += 1) {
      if (normalizeCellValue(row.shifts[String(day)])) { count += 1; }
    }
    return count || "";
  }

  function getExcelWeekdayLabel(day) {
    return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date(state.selectedYear, state.selectedMonth - 1, day).getDay()];
  }

  function excelXmlDateValue(year, month, day) {
    return String(year) + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0") + "T00:00:00.000";
  }

  function buildShiftDefinitionsWorksheetXml() {
    const rows = [
      excelXmlRow(1, [
        excelXmlCell(1, "SHIFT CODE", "sLabel"),
        excelXmlCell(2, "CHECK IN TIME", "sLabel"),
        excelXmlCell(3, "CHECK OUT TIME", "sLabel"),
        excelXmlCell(4, "PAY HOURS", "sLabel"),
        excelXmlCell(5, "NIGHT SHIFT HOURS", "sLabel"),
        excelXmlCell(6, "REMARK", "sLabel")
      ])
    ];
    SHIFT_CODE_DEFINITIONS.forEach(function (item, index) {
      rows.push(excelXmlRow(index + 2, [
        excelXmlCell(1, item.code, "sGrid"),
        excelXmlCell(2, item.checkIn, "sGrid", getExcelXmlCellType(item.checkIn)),
        excelXmlCell(3, item.checkOut, "sGrid", getExcelXmlCellType(item.checkOut)),
        excelXmlCell(4, item.hoursPay, "sGrid", "Number"),
        excelXmlCell(5, item.nightHours, "sGrid", "Number"),
        excelXmlCell(6, getLegendRemark(item.code), "sGrid")
      ]));
    });
    return [
      '<Worksheet ss:Name="Sheet2">',
      '<Table ss:ExpandedColumnCount="6" ss:ExpandedRowCount="' + (SHIFT_CODE_DEFINITIONS.length + 1) + '" x:FullColumns="1" x:FullRows="1">',
      '<Column ss:AutoFitWidth="0" ss:Width="90"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="110"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="120"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="90"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="130"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="220"/>',
      rows.join(""),
      '</Table>',
      '</Worksheet>'
    ].join("");
  }

  function buildWeekdayFormula(colName) {
    return '=IF(' + colName + '$3="","",CHOOSE(WEEKDAY(' + colName + '$3),"SUN","MON","TUE","WED","THU","FRI","SAT"))';
  }

  function isExcelWeekendColumn(colIndex) {
    const day = colIndex - 5;
    const weekday = new Date(state.selectedYear, state.selectedMonth - 1, day).getDay();
    return weekday === 0 || weekday === 6;
  }

  function getExcelXmlCodeStyle(code) {
    if (!code) {
      return "sGrid";
    }
    const group = getCodeGroup(code);
    if (group === "A") {
      return "sCodeA";
    }
    if (group === "B") {
      return "sCodeB";
    }
    if (group === "C") {
      return "sCodeC";
    }
    if (group === "leave") {
      return "sCodeLeave";
    }
    if (group === "off") {
      return "sCodeOff";
    }
    return "sCodeOther";
  }

  function excelXmlRow(index, cells) {
    return '<Row ss:Index="' + index + '" ss:AutoFitHeight="0" ss:Height="18">' + cells.map(function (cell) {
      return cell.xml;
    }).join("") + '</Row>';
  }

  function excelXmlCell(index, value, styleId, type, formula) {
    const cellType = type || getExcelXmlCellType(value);
    const attributes = [
      'ss:Index="' + index + '"',
      styleId ? 'ss:StyleID="' + styleId + '"' : '',
      formula ? 'ss:Formula="' + escapeXml(formula) + '"' : ''
    ].filter(Boolean).join(" ");
    const data = value !== "" && value !== undefined && value !== null
      ? '<Data ss:Type="' + cellType + '">' + escapeXml(value === undefined || value === null ? "" : value) + '</Data>'
      : '';
    return {
      index: index,
      xml: '<Cell ' + attributes + '>' + data + '</Cell>'
    };
  }

  function getExcelXmlCellType(value) {
    if (typeof value === "number") {
      return "Number";
    }
    if (typeof value === "string" && value !== "" && /^-?\d+(?:\.\d+)?$/.test(value)) {
      return "Number";
    }
    return "String";
  }

  function excelColName(index) {
    let colName = "";
    let value = index;
    while (value > 0) {
      const remainder = (value - 1) % 26;
      colName = String.fromCharCode(65 + remainder) + colName;
      value = Math.floor((value - 1) / 26);
    }
    return colName;
  }

  function handleCellPointerStart(event) {
    if (uiState.scheduleLocked) {
      event.preventDefault();
      showFeedback(getLockedFeedback(), "error");
      return;
    }
    if (event.target.closest("[data-row-handle]")) {
      return;
    }
    if (event.target.closest("[data-meta-edit]")) {
      return;
    }
    const cell = event.target.closest("[data-grid-cell]");
    if (!cell || event.button !== 0) {
      return;
    }
    const point = getCellPoint(cell);
    if (event.shiftKey && uiState.anchor) {
      setSelection(uiState.anchor, point, true);
      return;
    }
    const column = getColumnInfo(point.colIndex);
    if (column.type === "meta") {
      event.preventDefault();
      uiState.anchor = point;
      setSelection(point, point, false);
      beginMetaCellEdit(cell, point, column);
      return;
    }
    uiState.isSelecting = true;
    uiState.anchor = point;
    setSelection(point, point, true);
  }

  function beginMetaCellEdit(cell, point, column) {
    if (cell.querySelector("[data-meta-edit]")) {
      const existing = cell.querySelector("[data-meta-edit]");
      existing.focus();
      existing.select();
      return;
    }
    const monthState = ensureCurrentMonthState();
    const row = monthState.rows[point.rowIndex];
    if (!row) {
      return;
    }
    const currentValue = String(row.employeeSnapshot[column.meta.key] || "");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "schedule-meta-edit";
    input.value = currentValue;
    input.setAttribute("data-meta-edit", "true");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("spellcheck", "false");
    cell.textContent = "";
    cell.appendChild(input);
    requestAnimationFrame(function () {
      input.focus();
      input.select();
    });
    let committed = false;
    function commit() {
      if (committed) { return; }
      committed = true;
      const next = input.value;
      if (next !== currentValue) {
        row.sourceType = "manual";
        row.employeeId = "";
        row.employeeSnapshot[column.meta.key] = next;
        saveState();
      }
      renderAll();
    }
    function cancel() {
      if (committed) { return; }
      committed = true;
      renderAll();
    }
    input.addEventListener("keydown", function (event) {
      event.stopPropagation();
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      } else if (event.key === "Tab") {
        event.preventDefault();
        commit();
      }
    });
    input.addEventListener("blur", commit);
    input.addEventListener("mousedown", function (event) {
      event.stopPropagation();
    });
    input.addEventListener("click", function (event) {
      event.stopPropagation();
    });
  }

  function handleCellPointerMove(event) {
    if (uiState.scheduleLocked) {
      return;
    }
    if (!uiState.isSelecting || !uiState.anchor) {
      return;
    }
    const cell = event.target.closest("[data-grid-cell]");
    if (!cell) {
      return;
    }
    setSelection(uiState.anchor, getCellPoint(cell), false);
  }

  function handleGlobalKeydown(event) {
    const key = event.key;
    if (uiState.scheduleLocked) {
      const target = event.target;
      const isTypingField = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const isPeriodSelect = target === dom.yearSelect || target === dom.monthSelect;
      if (!isTypingField && !isPeriodSelect || target === dom.selectionInput) {
        if (["Escape", "Tab"].indexOf(key) < 0) {
          event.preventDefault();
        }
        if (target === dom.selectionInput) {
          dom.selectionInput.blur();
        }
        return;
      }
    }
    if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "z") {
      event.preventDefault();
      undoLatest();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && (key === "+" || key === "=")) {
      event.preventDefault();
      adjustZoom(ZOOM_STEP);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "-") {
      event.preventDefault();
      adjustZoom(-ZOOM_STEP);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === "0") {
      event.preventDefault();
      state.zoomLevel = 1;
      saveState();
      renderZoom();
      updateStickyMetrics();
      updateSheetOverflowState();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "c") {
      event.preventDefault();
      copySelectionToClipboard();
      return;
    }
    if (document.activeElement === dom.selectionInput && !event.ctrlKey && !event.metaKey) {
      if (key === "Escape") {
        event.preventDefault();
        clearSelection(true);
        return;
      }
      if (key === "Delete") {
        event.preventDefault();
        clearSelectedCells();
        return;
      }
      if (key === "Backspace" && !dom.selectionInput.value) {
        event.preventDefault();
        clearSelectedCells();
      }
      return;
    }
    if (!uiState.selection) {
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && key === "Backspace" && document.activeElement !== dom.selectionInput && dom.selectionInput.value) {
      event.preventDefault();
      dom.selectionInput.value = dom.selectionInput.value.slice(0, -1);
      uiState.codeDropdownOpen = true;
      uiState.codeDropdownIndex = -1;
      renderCodeDropdown();
      return;
    }
    if (key === "Delete" || key === "Backspace") {
      event.preventDefault();
      clearSelectedCells();
      return;
    }
    if (key === "Escape") {
      event.preventDefault();
      clearSelection(true);
      return;
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && key.length === 1 && document.activeElement !== dom.selectionInput) {
      event.preventDefault();
      dom.selectionInput.value = normalizeCellValue(dom.selectionInput.value + key);
      uiState.codeDropdownOpen = true;
      uiState.codeDropdownIndex = -1;
      renderCodeDropdown();
      return;
    }
    if (key === "Enter" && document.activeElement !== dom.selectionInput) {
      event.preventDefault();
      hideCodeDropdown();
      applySelectionInput();
    }
  }

  function handleDragStart(event) {
    if (uiState.scheduleLocked) {
      event.preventDefault();
      showFeedback(getLockedFeedback(), "error");
      return;
    }
    const handle = event.target.closest("[data-row-handle]");
    if (!handle) {
      return;
    }
    uiState.dragRowId = handle.getAttribute("data-row-handle") || "";
    const row = handle.closest(".schedule-table__body-row");
    if (row) {
      row.classList.add("is-dragging");
    }
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", uiState.dragRowId);
    }
  }

  function handleDragOver(event) {
    const row = event.target.closest(".schedule-table__body-row");
    if (!row || !uiState.dragRowId) {
      return;
    }
    event.preventDefault();
    clearDropTargets();
    uiState.dragOverId = row.getAttribute("data-row-id") || "";
    row.classList.add("is-drop-target");
  }

  function handleDrop(event) {
    const row = event.target.closest(".schedule-table__body-row");
    if (!row || !uiState.dragRowId) {
      return;
    }
    event.preventDefault();
    reorderRows(uiState.dragRowId, row.getAttribute("data-row-id") || "");
    clearDragState();
  }

  function clearDragState() {
    uiState.dragRowId = "";
    uiState.dragOverId = "";
    Array.prototype.forEach.call(dom.tableBody.querySelectorAll(".is-dragging, .is-drop-target"), function (node) {
      node.classList.remove("is-dragging", "is-drop-target");
    });
  }

  function clearDropTargets() {
    Array.prototype.forEach.call(dom.tableBody.querySelectorAll(".is-drop-target"), function (node) {
      node.classList.remove("is-drop-target");
    });
  }

  function reorderRows(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) {
      return;
    }
    const monthState = ensureCurrentMonthState();
    const sourceIndex = monthState.rows.findIndex(function (row) { return row.id === sourceId; });
    const targetIndex = monthState.rows.findIndex(function (row) { return row.id === targetId; });
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return;
    }
    const moved = monthState.rows.splice(sourceIndex, 1)[0];
    monthState.rows.splice(targetIndex, 0, moved);
    saveState();
    clearSelection(false);
    renderAll();
  }

  function setSelection(start, end, focusInput) {
    uiState.selection = {
      startRow: Math.min(start.rowIndex, end.rowIndex),
      endRow: Math.max(start.rowIndex, end.rowIndex),
      startCol: Math.min(start.colIndex, end.colIndex),
      endCol: Math.max(start.colIndex, end.colIndex)
    };
    renderSelectionState();
    renderSelectionMeta();
    if (focusInput) {
      focusSelectionInput();
    }
  }

  function clearSelection(clearInput) {
    uiState.selection = null;
    uiState.anchor = null;
    if (clearInput) {
      dom.selectionInput.value = "";
      hideCodeDropdown();
    }
    renderSelectionState();
    renderSelectionMeta();
  }

  function renderSelectionState() {
    Array.prototype.forEach.call(dom.tableBody.querySelectorAll("[data-grid-cell]"), function (cell) {
      const point = getCellPoint(cell);
      cell.classList.toggle("is-selected", isCellSelected(point.rowIndex, point.colIndex));
    });
  }

  function renderSelectionMeta() {
    dom.selectionMeta.textContent = uiState.selection
      ? i18n.t("schedule.selection.summary", getSelectionStats())
      : i18n.t("schedule.selection.none");
    if (dom.selectionInput) {
      dom.selectionInput.classList.toggle("is-active", Boolean(uiState.selection));
    }
  }

  function isCellSelected(rowIndex, day) {
    return Boolean(uiState.selection) &&
      rowIndex >= uiState.selection.startRow &&
      rowIndex <= uiState.selection.endRow &&
      day >= uiState.selection.startCol &&
      day <= uiState.selection.endCol;
  }

  function getSelectionStats() {
    const rows = uiState.selection.endRow - uiState.selection.startRow + 1;
    const cols = uiState.selection.endCol - uiState.selection.startCol + 1;
    return { rows: rows, days: cols, cells: rows * cols };
  }

  function getSelectedPoints() {
    const cells = [];
    if (!uiState.selection) {
      return cells;
    }
    for (let rowIndex = uiState.selection.startRow; rowIndex <= uiState.selection.endRow; rowIndex += 1) {
      for (let colIndex = uiState.selection.startCol; colIndex <= uiState.selection.endCol; colIndex += 1) {
        cells.push({ rowIndex: rowIndex, colIndex: colIndex });
      }
    }
    return cells;
  }

  function getSelectedSchedulePoints() {
    return getSelectedPoints().filter(function (point) {
      return getColumnInfo(point.colIndex).type === "schedule";
    });
  }

  function applySelectionInput() {
    if (uiState.scheduleLocked) {
      showFeedback(getLockedFeedback(), "error");
      return;
    }
    if (uiState.inputMode === "overtime") {
      applyOvertimeToSelection(dom.selectionInput.value);
      return;
    }
    applyCodeToSelection(normalizeCellValue(dom.selectionInput.value));
  }

  function setInputMode(mode) {
    const nextMode = mode === "overtime" ? "overtime" : "shift";
    uiState.inputMode = nextMode;
    if (uiState.codeDropdownOpen) {
      hideCodeDropdown();
    }
    renderModeToggle();
    focusSelectionInput();
  }

  function renderModeToggle() {
    const isOt = uiState.inputMode === "overtime";
    if (dom.app) {
      dom.app.classList.toggle("schedule-app--ot-mode", isOt);
    }
    if (dom.modeShift) {
      dom.modeShift.classList.toggle("is-active", !isOt);
      dom.modeShift.setAttribute("aria-pressed", String(!isOt));
    }
    if (dom.modeOt) {
      dom.modeOt.classList.toggle("is-active", isOt);
      dom.modeOt.setAttribute("aria-pressed", String(isOt));
    }
    if (dom.selectionInput) {
      const otLabel = i18n.getLocale() === "zh-Hant" ? "加班時數" : (i18n.getLocale() === "vi" ? "Giờ OT" : "OT hours");
      const codeLabel = i18n.getLocale() === "zh-Hant" ? "班碼" : (i18n.getLocale() === "vi" ? "Mã ca" : "Code");
      dom.selectionInput.setAttribute("placeholder", isOt ? otLabel : codeLabel);
      dom.selectionInput.setAttribute("inputmode", isOt ? "decimal" : "text");
    }
  }

  // Suggest an OT type from the day's holiday flag + the shift code's night profile.
  function suggestOvertimeType(row, day, holidaySet) {
    const isHoliday = Boolean(holidaySet[Number(day)]);
    const code = normalizeCellValue(row.shifts[String(day)]);
    const definition = SHIFT_CODE_MAP[code];
    const isNightShift = Boolean(definition && Number(definition.nightHours) > 0);
    if (isHoliday && isNightShift) {
      return "holidayNight";
    }
    if (isHoliday) {
      return "holiday";
    }
    return "normal";
  }

  function applyOvertimeToSelection(rawValue) {
    if (uiState.scheduleLocked) {
      showFeedback(getLockedFeedback(), "error");
      return;
    }
    if (!uiState.selection) {
      showFeedback(i18n.t("schedule.feedback.selectCell"), "error");
      return;
    }
    const schedulePoints = getSelectedSchedulePoints();
    if (!schedulePoints.length) {
      showFeedback(i18n.getLocale() === "vi" ? "Hãy chọn ô ca làm để ghi tăng ca." : "Select schedule cells to record overtime.", "error");
      return;
    }
    const trimmed = String(rawValue || "").trim();
    const clearing = trimmed === "" || Number(trimmed) === 0;
    const hours = clearing ? 0 : sanitizeOvertimeHours(trimmed);
    if (!clearing && !hours) {
      showFeedback(i18n.getLocale() === "vi" ? "Số giờ OT không hợp lệ (0.5 – 8)." : "Invalid OT hours (0.5 – 8).", "error");
      return;
    }
    const monthState = ensureCurrentMonthState();
    const holidaySet = getMonthHolidaySet(monthState);
    const changes = [];
    schedulePoints.forEach(function (point) {
      const row = monthState.rows[point.rowIndex];
      if (!row) {
        return;
      }
      if (!row.overtime) {
        row.overtime = {};
      }
      const dayKey = String(getColumnInfo(point.colIndex).day);
      const previous = row.overtime[dayKey] ? Object.assign({}, row.overtime[dayKey]) : null;
      if (clearing) {
        if (!previous) {
          return;
        }
        delete row.overtime[dayKey];
        changes.push({ rowId: row.id, kind: "overtime", day: dayKey, previous: previous });
        return;
      }
      const nextEntry = {
        hours: hours,
        type: previous && previous.type ? previous.type : suggestOvertimeType(row, dayKey, holidaySet),
        note: previous ? previous.note : "",
        approvedBy: previous ? previous.approvedBy : ""
      };
      row.overtime[dayKey] = nextEntry;
      changes.push({ rowId: row.id, kind: "overtime", day: dayKey, previous: previous });
    });
    if (!changes.length) {
      showFeedback(i18n.t("schedule.feedback.noChanges"), "error");
      return;
    }
    uiState.history.push({ monthKey: getCurrentMonthKey(), changes: changes });
    if (uiState.history.length > 120) {
      uiState.history.shift();
    }
    saveState();
    dom.selectionInput.value = "";
    renderAll();
    focusSelectionInput();
    showFeedback(clearing
      ? (i18n.getLocale() === "vi" ? "Đã xóa tăng ca." : "Overtime cleared.")
      : (i18n.getLocale() === "vi" ? "Đã ghi OT " + hours + "h." : "Overtime " + hours + "h applied."), "success");
  }

  // ----- Overtime detail popover (double-click a schedule cell) -----
  let otPopoverEl = null;
  let otDraft = null;

  function otLabel(vi, en, zh) {
    const locale = i18n.getLocale();
    if (locale === "vi") { return vi; }
    if (locale === "zh-Hant") { return zh || en; }
    return en;
  }

  function getOvertimeTypeLabel(type) {
    if (type === "night") { return otLabel("Đêm", "Night", "夜班"); }
    if (type === "holiday") { return otLabel("Lễ", "Holiday", "假日"); }
    if (type === "holidayNight") { return otLabel("Lễ+Đêm", "Holiday+Night", "假日夜班"); }
    return otLabel("Thường", "Normal", "一般");
  }

  function handleCellDoubleClick(event) {
    const cell = event.target.closest("[data-schedule-cell]");
    if (!cell) {
      return;
    }
    if (uiState.scheduleLocked) {
      showFeedback(getLockedFeedback(), "error");
      return;
    }
    const point = getCellPoint(cell);
    const column = getColumnInfo(point.colIndex);
    if (column.type !== "schedule") {
      return;
    }
    openOvertimePopover(point.rowIndex, column.day, cell);
  }

  function ensureOtPopoverEl() {
    if (otPopoverEl) {
      return otPopoverEl;
    }
    const el = document.createElement("div");
    el.className = "schedule-ot-popover";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Overtime");
    el.hidden = true;
    el.addEventListener("mousedown", function (event) { event.stopPropagation(); });
    el.addEventListener("click", handleOtPopoverClick);
    el.addEventListener("input", handleOtPopoverInput);
    el.addEventListener("keydown", function (event) {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        closeOvertimePopover();
      }
    });
    document.body.appendChild(el);
    otPopoverEl = el;
    return el;
  }

  function openOvertimePopover(rowIndex, day, anchorEl) {
    const monthState = ensureCurrentMonthState();
    const row = monthState.rows[rowIndex];
    if (!row) {
      return;
    }
    const dayKey = String(day);
    const existing = row.overtime && row.overtime[dayKey] ? row.overtime[dayKey] : null;
    const holidaySet = getMonthHolidaySet(monthState);
    otDraft = {
      rowId: row.id,
      day: dayKey,
      hours: existing ? existing.hours : 2,
      type: existing ? existing.type : suggestOvertimeType(row, dayKey, holidaySet),
      note: existing ? existing.note : "",
      approvedBy: existing ? existing.approvedBy : "",
      hadEntry: Boolean(existing),
      employeeName: row.employeeSnapshot.vieName || row.employeeSnapshot.engName || row.employeeSnapshot.ydiId || "—",
      shiftCode: normalizeCellValue(row.shifts[dayKey]),
      isHoliday: Boolean(holidaySet[Number(day)])
    };
    uiState.otPopover = { rowId: row.id, day: dayKey };
    renderOtPopover();
    positionOtPopover(anchorEl);
  }

  function renderOtPopover() {
    if (!otDraft) {
      return;
    }
    const el = ensureOtPopoverEl();
    const holidayTag = otDraft.isHoliday
      ? '<span class="schedule-ot-popover__tag">' + escapeHtml(otLabel("Ngày lễ", "Holiday", "假日")) + '</span>'
      : "";
    const shiftTag = otDraft.shiftCode
      ? '<span class="schedule-ot-popover__shift">' + escapeHtml(getLegendCodeLabel(otDraft.shiftCode)) + '</span>'
      : '<span class="schedule-ot-popover__shift schedule-ot-popover__shift--empty">' + escapeHtml(otLabel("Chưa có ca", "No shift", "無班")) + '</span>';
    const typeButtons = OVERTIME_TYPES.map(function (type) {
      const activeClass = type === otDraft.type ? " is-active" : "";
      return '<button type="button" class="schedule-ot-popover__type' + activeClass + '" data-ot-set-type="' + type + '">' + escapeHtml(getOvertimeTypeLabel(type)) + '</button>';
    }).join("");
    el.innerHTML = [
      '<div class="schedule-ot-popover__head">',
      '<span class="schedule-ot-popover__title">OT · ' + escapeHtml(otDraft.employeeName) + ' · ' + otLabel("ngày", "day", "日") + ' ' + escapeHtml(otDraft.day) + '</span>',
      shiftTag, holidayTag,
      '</div>',
      '<div class="schedule-ot-popover__row">',
      '<span class="schedule-ot-popover__label">' + escapeHtml(otLabel("Số giờ", "Hours", "時數")) + '</span>',
      '<div class="schedule-ot-popover__stepper">',
      '<button type="button" data-ot-step="-0.5" aria-label="-0.5">−</button>',
      '<span class="schedule-ot-popover__hours">' + escapeHtml(formatOtHours(otDraft.hours)) + '</span>',
      '<button type="button" data-ot-step="0.5" aria-label="+0.5">+</button>',
      '<span class="schedule-ot-popover__hint">' + escapeHtml(otLabel("0.5 – 8", "0.5 – 8", "0.5 – 8")) + '</span>',
      '</div>',
      '</div>',
      '<div class="schedule-ot-popover__row">',
      '<span class="schedule-ot-popover__label">' + escapeHtml(otLabel("Loại", "Type", "類型")) + '</span>',
      '<div class="schedule-ot-popover__types">' + typeButtons + '</div>',
      '</div>',
      '<div class="schedule-ot-popover__row">',
      '<span class="schedule-ot-popover__label">' + escapeHtml(otLabel("Ghi chú", "Note", "備註")) + '</span>',
      '<input type="text" class="schedule-ot-popover__input" data-ot-field="note" value="' + escapeHtml(otDraft.note) + '" autocomplete="off">',
      '</div>',
      '<div class="schedule-ot-popover__row">',
      '<span class="schedule-ot-popover__label">' + escapeHtml(otLabel("Người duyệt", "Approved by", "核准")) + '</span>',
      '<input type="text" class="schedule-ot-popover__input" data-ot-field="approvedBy" value="' + escapeHtml(otDraft.approvedBy) + '" autocomplete="off">',
      '</div>',
      '<div class="schedule-ot-popover__foot">',
      '<button type="button" class="schedule-ot-popover__btn schedule-ot-popover__btn--clear" data-ot-action="clear">' + escapeHtml(otLabel("Xóa OT", "Clear", "清除")) + '</button>',
      '<button type="button" class="schedule-ot-popover__btn schedule-ot-popover__btn--save" data-ot-action="save">' + escapeHtml(otLabel("Lưu", "Save", "儲存")) + '</button>',
      '</div>'
    ].join("");
    el.hidden = false;
  }

  function positionOtPopover(anchorEl) {
    const el = ensureOtPopoverEl();
    el.hidden = false;
    const rect = anchorEl ? anchorEl.getBoundingClientRect() : { left: 120, bottom: 120, top: 120, right: 160 };
    const width = el.offsetWidth || 260;
    const height = el.offsetHeight || 220;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }
    if (top + height > window.innerHeight - 12) {
      top = Math.max(12, rect.top - height - 6);
    }
    el.style.left = Math.round(left) + "px";
    el.style.top = Math.round(top) + "px";
  }

  function handleOtPopoverInput(event) {
    if (!otDraft) {
      return;
    }
    const field = event.target.closest("[data-ot-field]");
    if (!field) {
      return;
    }
    const key = field.getAttribute("data-ot-field");
    if (key === "note") {
      otDraft.note = field.value;
    } else if (key === "approvedBy") {
      otDraft.approvedBy = field.value;
    }
  }

  function handleOtPopoverClick(event) {
    // Stop the click from reaching the document-level "close on outside click"
    // handler — re-rendering the popover detaches event.target and would otherwise
    // be misread as an outside click.
    event.stopPropagation();
    if (!otDraft) {
      return;
    }
    const stepBtn = event.target.closest("[data-ot-step]");
    if (stepBtn) {
      const delta = Number(stepBtn.getAttribute("data-ot-step"));
      otDraft.hours = sanitizeOvertimeHours(otDraft.hours + delta) || 0.5;
      renderOtPopover();
      return;
    }
    const typeBtn = event.target.closest("[data-ot-set-type]");
    if (typeBtn) {
      otDraft.type = typeBtn.getAttribute("data-ot-set-type");
      renderOtPopover();
      return;
    }
    const actionBtn = event.target.closest("[data-ot-action]");
    if (actionBtn) {
      const action = actionBtn.getAttribute("data-ot-action");
      if (action === "save") {
        commitOvertimePopover();
      } else if (action === "clear") {
        commitOvertimePopover(true);
      }
    }
  }

  function commitOvertimePopover(clearing) {
    if (!otDraft || uiState.scheduleLocked) {
      closeOvertimePopover();
      return;
    }
    const monthState = ensureCurrentMonthState();
    const row = monthState.rows.find(function (item) { return item.id === otDraft.rowId; });
    if (!row) {
      closeOvertimePopover();
      return;
    }
    if (!row.overtime) {
      row.overtime = {};
    }
    const dayKey = otDraft.day;
    const previous = row.overtime[dayKey] ? Object.assign({}, row.overtime[dayKey]) : null;
    if (clearing) {
      if (previous) {
        delete row.overtime[dayKey];
        uiState.history.push({ monthKey: getCurrentMonthKey(), changes: [{ rowId: row.id, kind: "overtime", day: dayKey, previous: previous }] });
      }
    } else {
      const hours = sanitizeOvertimeHours(otDraft.hours);
      if (!hours) {
        showFeedback(i18n.getLocale() === "vi" ? "Số giờ OT không hợp lệ (0.5 – 8)." : "Invalid OT hours (0.5 – 8).", "error");
        return;
      }
      row.overtime[dayKey] = {
        hours: hours,
        type: OVERTIME_TYPES.indexOf(otDraft.type) >= 0 ? otDraft.type : "normal",
        note: String(otDraft.note || ""),
        approvedBy: String(otDraft.approvedBy || "")
      };
      uiState.history.push({ monthKey: getCurrentMonthKey(), changes: [{ rowId: row.id, kind: "overtime", day: dayKey, previous: previous }] });
    }
    if (uiState.history.length > 120) {
      uiState.history.shift();
    }
    saveState();
    closeOvertimePopover();
    renderAll();
    showFeedback(clearing
      ? (i18n.getLocale() === "vi" ? "Đã xóa tăng ca." : "Overtime cleared.")
      : (i18n.getLocale() === "vi" ? "Đã lưu tăng ca." : "Overtime saved."), "success");
  }

  function closeOvertimePopover() {
    otDraft = null;
    uiState.otPopover = null;
    if (otPopoverEl) {
      otPopoverEl.hidden = true;
      otPopoverEl.innerHTML = "";
    }
  }

  function clearSelectedCells() {
    if (uiState.scheduleLocked) {
      showFeedback(getLockedFeedback(), "error");
      return;
    }
    if (!uiState.selection) {
      showFeedback(i18n.t("schedule.feedback.selectClear"), "error");
      return;
    }
    applyPasteMatrix([[""]], true);
  }

  function applyCodeToSelection(code, clearing) {
    if (uiState.scheduleLocked) {
      showFeedback(getLockedFeedback(), "error");
      return;
    }
    if (!uiState.selection) {
      showFeedback(i18n.t(clearing ? "schedule.feedback.selectClear" : "schedule.feedback.selectCell"), "error");
      return;
    }
    if (!clearing && !code) {
      showFeedback(i18n.t("schedule.feedback.enterCode"), "error");
      return;
    }
    if (code && !SHIFT_CODE_MAP[code]) {
      showFeedback(i18n.t("schedule.feedback.invalidCode", { code: code }), "error");
      return;
    }
    if (!getSelectedSchedulePoints().length) {
      showFeedback(i18n.getLocale() === "zh-Hant" ? "目前選取的是員工資訊欄，請改用貼上或選取排班欄。" : (i18n.getLocale() === "vi" ? "Đang chọn cột thông tin nhân viên, hãy dùng dán hoặc chọn ô ca làm." : "The current selection is employee info. Paste there or select schedule cells."), "error");
      return;
    }
    const monthState = ensureCurrentMonthState();
    const changes = [];
    getSelectedSchedulePoints().forEach(function (point) {
      const row = monthState.rows[point.rowIndex];
      if (!row) {
        return;
      }
      const dayKey = String(getColumnInfo(point.colIndex).day);
      const previous = normalizeCellValue(row.shifts[dayKey]);
      if (previous === code) {
        return;
      }
      changes.push({ rowId: row.id, kind: "schedule", day: dayKey, previous: previous });
      if (code) {
        row.shifts[dayKey] = code;
      } else {
        delete row.shifts[dayKey];
      }
    });
    if (!changes.length) {
      showFeedback(i18n.t("schedule.feedback.noChanges"), "error");
      return;
    }
    uiState.history.push({ monthKey: getCurrentMonthKey(), changes: changes });
    if (uiState.history.length > 120) {
      uiState.history.shift();
    }
    saveState();
    dom.selectionInput.value = "";
    renderAll();
    focusSelectionInput();
    showFeedback(i18n.t(clearing ? "schedule.feedback.cleared" : "schedule.feedback.applied", { code: code }), "success");
  }

  function buildSelectionMatrix() {
    const monthState = ensureCurrentMonthState();
    const rows = [];
    if (!uiState.selection) {
      return rows;
    }
    for (let rowIndex = uiState.selection.startRow; rowIndex <= uiState.selection.endRow; rowIndex += 1) {
      const row = monthState.rows[rowIndex];
      const line = [];
      for (let colIndex = uiState.selection.startCol; colIndex <= uiState.selection.endCol; colIndex += 1) {
        line.push(row ? getGridValue(row, colIndex) : "");
      }
      rows.push(line);
    }
    return rows;
  }

  function copySelectionToClipboard() {
    if (!uiState.selection) {
      return;
    }
    const text = buildSelectionMatrix().map(function (line) {
      return line.join("\t");
    }).join("\n");
    if (!text) {
      return;
    }
    uiState.copiedText = text;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showFeedback(i18n.getLocale() === "zh-Hant" ? "已複製選取內容。" : (i18n.getLocale() === "vi" ? "Đã sao chép vùng chọn." : "Selection copied."), "success");
      }).catch(function () {
        showFeedback(i18n.getLocale() === "zh-Hant" ? "已複製選取內容。" : (i18n.getLocale() === "vi" ? "Đã sao chép vùng chọn." : "Selection copied."), "success");
      });
      return;
    }
    showFeedback(i18n.getLocale() === "zh-Hant" ? "已複製選取內容。" : (i18n.getLocale() === "vi" ? "Đã sao chép vùng chọn." : "Selection copied."), "success");
  }

  function handleCopy(event) {
    if (!uiState.selection) {
      return;
    }
    const target = event.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }
    const text = buildSelectionMatrix().map(function (line) {
      return line.join("\t");
    }).join("\n");
    if (!text) {
      return;
    }
    uiState.copiedText = text;
    event.preventDefault();
    event.clipboardData.setData("text/plain", text);
  }

  function handlePaste(event) {
    if (uiState.scheduleLocked) {
      return;
    }
    if (!uiState.selection) {
      return;
    }
    const target = event.target;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
      return;
    }
    const text = event.clipboardData ? event.clipboardData.getData("text/plain") : "";
    const fallbackText = !text && uiState.copiedText ? uiState.copiedText : "";
    const nextText = text || fallbackText;
    if (!nextText) {
      return;
    }
    event.preventDefault();
    applyPasteMatrix(parseClipboardMatrix(nextText));
  }

  function parseClipboardMatrix(text) {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .filter(function (line, index, list) {
        return line.length || index < list.length - 1;
      })
      .map(function (line) {
        return line.split("\t");
      });
  }

  function ensureRowsForPaste(requiredRowCount) {
    const monthState = ensureCurrentMonthState();
    while (monthState.rows.length < requiredRowCount) {
      monthState.rows.push(createManualRow());
    }
    return monthState;
  }

  function applyPasteMatrix(matrix, clearingOnly) {
    if (uiState.scheduleLocked) {
      showFeedback(getLockedFeedback(), "error");
      return;
    }
    if (!uiState.selection || !matrix.length || !matrix[0].length) {
      return;
    }
    const fillSelection = matrix.length === 1 && matrix[0].length === 1;
    const requiredRowCount = fillSelection
      ? uiState.selection.endRow + 1
      : Math.max(uiState.selection.endRow + 1, uiState.selection.startRow + matrix.length);
    const monthState = ensureRowsForPaste(requiredRowCount);
    const changes = [];
    const invalidCodes = [];

    const rowLimit = fillSelection ? uiState.selection.endRow : Math.min(monthState.rows.length - 1, uiState.selection.startRow + matrix.length - 1);
    const colLimit = fillSelection ? uiState.selection.endCol : Math.min(getVisibleColumnCount() - 1, uiState.selection.startCol + matrix[0].length - 1);

    for (let rowIndex = uiState.selection.startRow; rowIndex <= rowLimit; rowIndex += 1) {
      for (let colIndex = uiState.selection.startCol; colIndex <= colLimit; colIndex += 1) {
        const row = monthState.rows[rowIndex];
        const incoming = fillSelection ? matrix[0][0] : (matrix[rowIndex - uiState.selection.startRow][colIndex - uiState.selection.startCol] || "");
        const column = getColumnInfo(colIndex);
        const nextValue = column.type === "schedule" ? normalizeCellValue(incoming) : String(incoming || "").trim();

        if (column.type === "schedule" && nextValue && !SHIFT_CODE_MAP[nextValue]) {
          invalidCodes.push(nextValue);
          continue;
        }

        const previous = getGridValue(row, colIndex);
        if (previous === nextValue) {
          continue;
        }

        const change = { rowId: row.id, colIndex: colIndex, kind: column.type, previous: previous, next: nextValue };
        if (column.type === "schedule") {
          change.day = String(column.day);
        } else {
          change.metaKey = column.meta.key;
        }
        changes.push(change);
      }
    }

    if (invalidCodes.length) {
      showFeedback((i18n.getLocale() === "zh-Hant"
        ? "貼上的班碼含有未定義值: "
        : (i18n.getLocale() === "vi" ? "Có mã ca không hợp lệ trong nội dung dán: " : "Pasted data contains invalid shift codes: "))
        + invalidCodes.filter(uniqueOnly).join(", "), "error");
      return;
    }

    if (!changes.length) {
      showFeedback(i18n.t("schedule.feedback.noChanges"), "error");
      return;
    }

    changes.forEach(function (change) {
      const row = monthState.rows.find(function (item) { return item.id === change.rowId; });
      setGridValue(row, change.colIndex, change.next);
    });

    uiState.history.push({ monthKey: getCurrentMonthKey(), changes: changes });
    saveState();
    renderAll();
    showFeedback(clearingOnly
      ? i18n.t("schedule.feedback.cleared")
      : (i18n.getLocale() === "zh-Hant" ? "已貼上選取內容。" : (i18n.getLocale() === "vi" ? "Đã dán vào vùng chọn." : "Pasted into selection.")), "success");
  }

  function undoLatest() {
    const entry = uiState.history.pop();
    if (!entry) {
      showFeedback(i18n.t("schedule.feedback.undoEmpty"), "error");
      return;
    }
    if (entry.monthKey !== getCurrentMonthKey()) {
      uiState.history = [];
      showFeedback(i18n.t("schedule.feedback.undoMonthChanged"), "error");
      return;
    }
    const monthState = ensureCurrentMonthState();
    entry.changes.forEach(function (change) {
      const row = monthState.rows.find(function (item) { return item.id === change.rowId; });
      if (!row) {
        return;
      }
      if (change.kind === "meta") {
        row.employeeSnapshot[change.metaKey] = String(change.previous || "");
        return;
      }
      if (change.kind === "overtime") {
        if (!row.overtime) {
          row.overtime = {};
        }
        if (change.previous) {
          row.overtime[change.day] = change.previous;
        } else {
          delete row.overtime[change.day];
        }
        return;
      }
      if (change.previous) {
        row.shifts[change.day] = change.previous;
      } else {
        delete row.shifts[change.day];
      }
    });
    saveState();
    renderAll();
    showFeedback(i18n.t("schedule.feedback.undoDone"), "success");
  }

  let pendingZoomDelta = 0;
  let pendingZoomFrame = 0;

  function flushPendingZoom() {
    pendingZoomFrame = 0;
    if (pendingZoomDelta === 0) {
      return;
    }
    const delta = pendingZoomDelta;
    pendingZoomDelta = 0;
    const next = sanitizeZoom(state.zoomLevel + delta);
    if (next === state.zoomLevel) {
      return;
    }
    state.zoomLevel = next;
    saveState();
    renderZoom();
    updateStickyMetrics();
    updateSheetOverflowState();
  }

  function adjustZoom(delta) {
    pendingZoomDelta += delta;
    if (pendingZoomFrame) {
      return;
    }
    pendingZoomFrame = requestAnimationFrame(flushPendingZoom);
  }

  function renderZoom() {
    dom.sheetZoom.style.zoom = String(state.zoomLevel);
    if (dom.frozenZoom) {
      dom.frozenZoom.style.zoom = String(state.zoomLevel);
    }
  }

  function updateSheetOverflowState() {
    if (!dom.sheetScroll) {
      return;
    }
    const hasHorizontalOverflow = dom.sheetScroll.scrollWidth > dom.sheetScroll.clientWidth + 1;
    const isShiftedHorizontally = dom.sheetScroll.scrollLeft > 1;
    dom.sheetScroll.classList.toggle("schedule-sheet-scroll--fit", !hasHorizontalOverflow);
    [dom.workspace, dom.app].forEach(function (target) {
      if (!target) {
        return;
      }
      target.classList.toggle("schedule-sheet--x-shifted", isShiftedHorizontally);
    });
  }

  function handleLockedSurfaceWheel(event) {
    if (event.ctrlKey) {
      return;
    }
    event.preventDefault();
    if (state.legendOpen) {
      return;
    }
    if (!dom.sheetScroll) {
      return;
    }
    if (Math.abs(event.deltaY) >= Math.abs(event.deltaX)) {
      dom.sheetScroll.scrollTop += event.deltaY;
      return;
    }
    dom.sheetScroll.scrollLeft += event.deltaX;
  }

  function applyLegendScrollLock() {
    const body = document.body;
    if (!body) {
      return;
    }

    if (state.legendOpen) {
      if (uiState.lockedScrollY === null) {
        uiState.lockedScrollY = Math.round(window.scrollY || window.pageYOffset || 0);
      }
      body.classList.add("edit-page--legend-lock");
      body.style.top = "-" + String(uiState.lockedScrollY) + "px";
      return;
    }

    const shouldRestore = body.classList.contains("edit-page--legend-lock");
    const restoreY = uiState.lockedScrollY === null ? 0 : uiState.lockedScrollY;
    body.classList.remove("edit-page--legend-lock");
    body.style.removeProperty("top");
    uiState.lockedScrollY = null;
    if (shouldRestore) {
      window.scrollTo(0, restoreY);
    }
  }

  function measureHeaderRowHeights(head) {
    if (!head) {
      return [];
    }
    return Array.from(head.querySelectorAll("tr"))
      .map(function (row) {
        const nextHeight = Math.ceil(row.getBoundingClientRect().height || 0);
        return Math.min(48, Math.max(0, nextHeight));
      })
      .filter(function (value) {
        return value > 0;
      });
  }

  function withDefaultHeaderVars(measure) {
    const targets = [dom.workspace, dom.app].filter(Boolean);
    const previous = targets.map(function (target) {
      return {
        target: target,
        row: target.style.getPropertyValue("--schedule-table-head-row"),
        band: target.style.getPropertyValue("--schedule-frozen-band-height")
      };
    });

    targets.forEach(function (target) {
      target.style.removeProperty("--schedule-table-head-row");
      target.style.removeProperty("--schedule-frozen-band-height");
    });

    try {
      return measure();
    } finally {
      previous.forEach(function (entry) {
        if (entry.row) {
          entry.target.style.setProperty("--schedule-table-head-row", entry.row);
        } else {
          entry.target.style.removeProperty("--schedule-table-head-row");
        }

        if (entry.band) {
          entry.target.style.setProperty("--schedule-frozen-band-height", entry.band);
        } else {
          entry.target.style.removeProperty("--schedule-frozen-band-height");
        }
      });
    }
  }

  function updateStickyMetrics() {
      const headerHeight = dom.header ? Math.round(dom.header.getBoundingClientRect().height) : 56;
      const periodHeight = dom.periodBar ? Math.round(dom.periodBar.getBoundingClientRect().height) : 52;
      const naturalMetrics = withDefaultHeaderVars(function () {
        const tableRowHeights = measureHeaderRowHeights(dom.tableHead);
        const summaryRowHeights = measureHeaderRowHeights(dom.summaryHead);
        const rowCount = Math.max(2, tableRowHeights.length || 0, summaryRowHeights.length || 0);
        const tableRowsSum = tableRowHeights.reduce(function (sum, value) { return sum + value; }, 0);
        const summaryRowsSum = summaryRowHeights.reduce(function (sum, value) { return sum + value; }, 0);
        const rawTableHeadHeight = dom.tableHead ? Math.ceil(dom.tableHead.getBoundingClientRect().height || 0) : 0;
        const rawSummaryHeadHeight = dom.summaryHead ? Math.ceil(dom.summaryHead.getBoundingClientRect().height || 0) : 0;
        const measuredBandHeight = Math.max(
          rowCount * 24,
          Math.min(120, Math.max(0, rawTableHeadHeight)),
          Math.min(120, Math.max(0, rawSummaryHeadHeight)),
          tableRowsSum,
          summaryRowsSum
        );

        return {
          rowCount: rowCount,
          frozenBandHeight: measuredBandHeight,
          rowHeight: Math.max(24, Math.ceil(measuredBandHeight / rowCount))
        };
      });
      const rowHeight = naturalMetrics.rowHeight;
      const frozenBandHeight = naturalMetrics.frozenBandHeight;
      const tableRect = dom.table ? dom.table.getBoundingClientRect() : null;
      const frameRect = dom.sheetFrame ? dom.sheetFrame.getBoundingClientRect() : null;
      const frozenHeadRect = dom.frozenTableHead ? dom.frozenTableHead.getBoundingClientRect() : null;
      const frozenDayHeadRect = dom.frozenTableHead && dom.frozenTableHead.querySelector("[data-day-head]")
        ? dom.frozenTableHead.querySelector("[data-day-head]").getBoundingClientRect()
        : null;
      const periodGridRect = dom.periodGrid ? dom.periodGrid.getBoundingClientRect() : null;
      const minimumTop = headerHeight + periodHeight;
      const minimumLegendHeight = 320;
      const legendTop = frozenDayHeadRect && frozenDayHeadRect.height > 0
        ? Math.max(minimumTop, Math.round(frozenDayHeadRect.top))
        : frozenHeadRect && frozenHeadRect.height > 0
        ? Math.max(minimumTop, Math.round(frozenHeadRect.top))
        : frameRect
        ? Math.max(minimumTop, Math.round(frameRect.top))
        : tableRect
        ? Math.max(minimumTop, Math.round(tableRect.top))
        : minimumTop;
      const legendRight = frameRect
        ? Math.max(0, Math.round(window.innerWidth - frameRect.right))
        : 8;
      const computedLegendBottom = frameRect
        ? Math.max(0, Math.round(window.innerHeight - frameRect.bottom))
        : 8;
      const legendBottom = Math.min(
        computedLegendBottom,
        Math.max(8, window.innerHeight - legendTop - minimumLegendHeight)
      );
      const legendLeft = periodGridRect
        ? Math.max(16, Math.round(periodGridRect.right + 12))
        : Math.max(16, Math.round(window.innerWidth * 0.58));
      [dom.workspace, dom.app].forEach(function (target) {
        if (!target) {
          return;
        }
        target.style.setProperty("--schedule-header-height", String(headerHeight) + "px");
        target.style.setProperty("--schedule-period-height", String(periodHeight) + "px");
        target.style.setProperty("--schedule-sheet-sticky-top", String(headerHeight + periodHeight) + "px");
        target.style.setProperty("--schedule-table-head-row", String(rowHeight) + "px");
        target.style.setProperty("--schedule-frozen-band-height", String(frozenBandHeight) + "px");
        target.style.setProperty("--legend-panel-top", String(legendTop) + "px");
        target.style.setProperty("--legend-panel-left", String(legendLeft) + "px");
        target.style.setProperty("--legend-panel-right", String(legendRight) + "px");
        target.style.setProperty("--legend-panel-bottom", String(legendBottom) + "px");
      });
      syncSummarySpacerWidth();
      requestFrozenHeaderSync();
    }

  function syncSummarySpacerWidth() {
    if (!dom.summaryTable) {
      return;
    }
    const summaryWidth = Math.round(dom.summaryTable.offsetWidth || dom.summaryTable.clientWidth || dom.summaryTable.getBoundingClientRect().width || 0);
    if (summaryWidth > 0) {
      [dom.workspace, dom.app].forEach(function (target) {
        if (!target) {
          return;
        }
        target.style.setProperty("--summary-table-total", String(summaryWidth) + "px");
      });
    }
  }

  function requestFrozenHeaderSync() {
    if (uiState.frozenSyncFrame) {
      return;
    }
    uiState.frozenSyncFrame = window.requestAnimationFrame(function () {
      uiState.frozenSyncFrame = 0;
      syncFrozenLayer();
    });
  }

  function syncFrozenLayer() {
    if (!dom.sheetScroll || !dom.frozenScroll) {
      return;
    }
    dom.frozenScroll.scrollLeft = dom.sheetScroll.scrollLeft;
    updateFrozenColumnOcclusion();
    [dom.workspace, dom.app].forEach(function (target) {
      if (!target) {
        return;
      }
      target.classList.toggle("schedule-sheet--x-shifted", dom.sheetScroll.scrollLeft > 1);
    });
  }

  function updateFrozenColumnOcclusion() {
    if (!dom.sheetScroll) {
      return;
    }
    const frozenEdgeSource =
      document.querySelector("#scheduleFrozenTableHead .schedule-table__sticky--position") ||
      document.querySelector("#scheduleTableHead .schedule-table__sticky--position") ||
      document.querySelector(".schedule-table__body-row .schedule-table__sticky--position");
    const scrollRect = dom.sheetScroll.getBoundingClientRect();
    const frozenEdge = frozenEdgeSource
      ? Math.round(frozenEdgeSource.getBoundingClientRect().right)
      : Math.round(scrollRect.left);
    const summaryEdgeSource =
      document.querySelector("#scheduleSummaryBody td") ||
      document.querySelector("#scheduleSummaryHead th:not(.schedule-summary-table__blank)") ||
      document.querySelector("#scheduleFrozenSummaryHead th:not(.schedule-summary-table__blank)");
    const summaryRect = summaryEdgeSource ? summaryEdgeSource.getBoundingClientRect() : null;
    const summaryLeft = summaryRect ? Math.round(summaryRect.left) : Math.round(scrollRect.right);
    const summaryRight = summaryRect ? Math.round(summaryRect.right) : Math.round(scrollRect.right);
    const isShifted = dom.sheetScroll.scrollLeft > 1;
    const leftCandidates = document.querySelectorAll([
      "#scheduleFrozenTableHead .schedule-table__day-head",
      "#scheduleFrozenTableHead .schedule-table__weekday-head",
      "#scheduleTableBody .schedule-table__cell",
      "#dailySummaryHead th:not(.schedule-daily-table__sticky)",
      "#dailySummaryBody td:not(.schedule-daily-table__sticky)"
    ].join(", "));

    leftCandidates.forEach(function (cell) {
      const rect = cell.getBoundingClientRect();
      const isUnderFrozenColumns = isShifted && rect.left < frozenEdge - 1;
      cell.classList.toggle("schedule-grid-cell--under-frozen", isUnderFrozenColumns);
    });

    const rightCandidates = document.querySelectorAll([
      "#scheduleFrozenTableHead .schedule-table__day-head",
      "#scheduleFrozenTableHead .schedule-table__weekday-head",
      "#scheduleTableBody .schedule-table__cell"
    ].join(", "));

    rightCandidates.forEach(function (cell) {
      const rect = cell.getBoundingClientRect();
      const overlapsFixedSummary =
        summaryRect &&
        rect.right > summaryLeft + 1 &&
        rect.left < summaryRight - 1 &&
        rect.left < scrollRect.right - 1;
      cell.classList.toggle("schedule-grid-cell--under-fixed-summary", Boolean(overlapsFixedSummary));
    });
  }

  function getFilteredShiftCodes() {
    const query = normalizeCellValue(dom.selectionInput && dom.selectionInput.value);
    return VALID_SHIFT_CODES.filter(function (code) {
      return !query || code.indexOf(query) === 0 || code.indexOf(query) >= 0;
    }).slice(0, 12);
  }

  function renderCodeDropdown() {
    if (!dom.codeDropdown) {
      return;
    }
    const items = getFilteredShiftCodes();
    const shouldShow = uiState.codeDropdownOpen && uiState.inputMode !== "overtime" && items.length > 0;
    dom.codeDropdown.hidden = !shouldShow;
    if (!shouldShow) {
      dom.codeDropdown.innerHTML = "";
      return;
    }
    if (uiState.codeDropdownIndex >= items.length) {
      uiState.codeDropdownIndex = items.length - 1;
    }
    dom.codeDropdown.innerHTML = items.map(function (code, index) {
      const activeClass = index === uiState.codeDropdownIndex ? " is-active" : "";
      return '<button type="button" class="schedule-code-dropdown__option' + activeClass + '" data-shift-suggestion="' + escapeHtml(code) + '">' + escapeHtml(code) + "</button>";
    }).join("");
  }

  function hideCodeDropdown() {
    uiState.codeDropdownOpen = false;
    uiState.codeDropdownIndex = -1;
    renderCodeDropdown();
  }

  function handleCodeDropdownKeydown(event) {
    const items = getFilteredShiftCodes();
    if (!items.length) {
      if (event.key === "Escape") {
        event.preventDefault();
        hideCodeDropdown();
        return true;
      }
      return false;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      uiState.codeDropdownOpen = true;
      uiState.codeDropdownIndex = Math.min(items.length - 1, uiState.codeDropdownIndex + 1);
      if (uiState.codeDropdownIndex < 0) {
        uiState.codeDropdownIndex = 0;
      }
      renderCodeDropdown();
      return true;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      uiState.codeDropdownOpen = true;
      uiState.codeDropdownIndex = Math.max(0, uiState.codeDropdownIndex - 1);
      renderCodeDropdown();
      return true;
    }
    if (event.key === "Tab" && uiState.codeDropdownOpen && uiState.codeDropdownIndex >= 0) {
      dom.selectionInput.value = items[uiState.codeDropdownIndex];
      hideCodeDropdown();
      return false;
    }
    if (event.key === "Enter" && uiState.codeDropdownOpen && uiState.codeDropdownIndex >= 0) {
      event.preventDefault();
      dom.selectionInput.value = items[uiState.codeDropdownIndex];
      hideCodeDropdown();
      applySelectionInput();
      return true;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      hideCodeDropdown();
      return true;
    }
    return false;
  }

  function focusSelectionInput() {
    try {
      dom.selectionInput.focus({ preventScroll: true });
    } catch (error) {
      dom.selectionInput.focus();
    }
  }

  function getCellPoint(cell) {
    return {
      rowIndex: Number(cell.getAttribute("data-row-index") || 0),
      colIndex: Number(cell.getAttribute("data-col-index") || 0)
    };
  }

  function renderCellValue(code) {
    return code ? escapeHtml(getLegendCodeLabel(code)) : '<span class="schedule-cell__placeholder">·</span>';
  }

  function getCodeGroup(code) {
    if (!code) {
      return "empty";
    }
    if (/^A/.test(code)) {
      return "A";
    }
    if (/^B/.test(code)) {
      return "B";
    }
    if (/^C/.test(code)) {
      return "C";
    }
    if (code === "OFF") {
      return "off";
    }
    if (["NPL", "SL", "PH", "TL", "AL", "BL"].indexOf(code) >= 0) {
      return "leave";
    }
    return "other";
  }

  function handleAddRows() {
    if (uiState.scheduleLocked) {
      showFeedback(getLockedFeedback(), "error");
      return;
    }
    const count = Math.max(1, Math.min(100, Number(dom.addRowsCount && dom.addRowsCount.value || 1) || 1));
    const monthState = ensureCurrentMonthState();
    for (let index = 0; index < count; index += 1) {
      monthState.rows.push(createManualRow());
    }
    saveState();
    renderAll();
    showFeedback((i18n.getLocale() === "zh-Hant"
      ? "已新增 "
      : (i18n.getLocale() === "vi" ? "Đã thêm " : "Added "))
      + count
      + (i18n.getLocale() === "zh-Hant" ? " 行。" : (i18n.getLocale() === "vi" ? " hàng." : " rows.")), "success");
  }

  function handleDeleteRows() {
    if (uiState.scheduleLocked) {
      showFeedback(getLockedFeedback(), "error");
      return;
    }
    const count = Math.max(1, Math.min(100, Number(dom.addRowsCount && dom.addRowsCount.value || 1) || 1));
    const monthState = ensureCurrentMonthState();
    if (!monthState.rows.length) {
      showFeedback(i18n.getLocale() === "zh-Hant" ? "目前沒有可刪除的列。" : (i18n.getLocale() === "vi" ? "Hiện không có hàng nào để xóa." : "There are no rows to delete."), "error");
      return;
    }
    const deletedCount = Math.min(count, monthState.rows.length);
    monthState.rows.splice(Math.max(0, monthState.rows.length - deletedCount), deletedCount);
    saveState();
    clearSelection(true);
    renderAll();
    showFeedback((i18n.getLocale() === "zh-Hant"
      ? "已刪除 "
      : (i18n.getLocale() === "vi" ? "Đã xóa " : "Deleted "))
      + deletedCount
      + (i18n.getLocale() === "zh-Hant" ? " 行。" : (i18n.getLocale() === "vi" ? " hàng." : " rows.")), "success");
  }

  function handleResizePointerStart(event) {
    if (uiState.scheduleLocked) {
      event.preventDefault();
      showFeedback(getLockedFeedback(), "error");
      return;
    }
    const handle = event.target.closest("[data-resize-key]");
    if (!handle || event.button !== 0) {
      return;
    }
    event.preventDefault();
    const key = handle.getAttribute("data-resize-key");
    uiState.columnResize = {
      key: key,
      startX: event.clientX,
      startWidth: state.columnWidths[key]
    };
  }

  function handleResizePointerMove(event) {
    if (!uiState.columnResize) {
      return;
    }
    const nextWidth = uiState.columnResize.startWidth + (event.clientX - uiState.columnResize.startX);
    state.columnWidths[uiState.columnResize.key] = Math.max(uiState.columnResize.key === "day" ? 36 : 64, Math.round(nextWidth));
    applyColumnWidths();
    updateStickyMetrics();
    updateSheetOverflowState();
  }

  function handleResizeAutoFit(event) {
    const handle = event.target.closest("[data-resize-key]");
    if (!handle) {
      return;
    }
    event.preventDefault();
    const key = handle.getAttribute("data-resize-key");
    state.columnWidths[key] = measureAutoFitWidth(key);
    saveState();
    renderAll();
  }

  function measureAutoFitWidth(key) {
    const values = [];
    if (key === "day") {
      const days = getDaysInMonth(state.selectedYear, state.selectedMonth);
      for (let day = 1; day <= days; day += 1) {
        values.push(String(day));
        values.push(getWeekdayLabel(state.selectedYear, state.selectedMonth, day));
      }
      ensureCurrentMonthState().rows.forEach(function (row) {
        Object.keys(row.shifts).forEach(function (dayKey) {
          values.push(normalizeCellValue(row.shifts[dayKey]));
        });
      });
      return Math.max(36, Math.min(96, measureMaxWidth(values, 30)));
    }

    const meta = META_COLUMNS.find(function (item) { return item.widthKey === key; });
    if (!meta) {
      return DEFAULT_COLUMN_WIDTHS[key] || 80;
    }
    values.push((META_HEADERS[i18n.getLocale()] || META_HEADERS["zh-Hant"])[META_COLUMNS.indexOf(meta)]);
    ensureCurrentMonthState().rows.forEach(function (row) {
      values.push(String(row.employeeSnapshot[meta.key] || ""));
    });
    return Math.max(64, Math.min(280, measureMaxWidth(values, 34)));
  }

  function measureMaxWidth(values, padding) {
    const probe = document.createElement("span");
    probe.style.position = "fixed";
    probe.style.visibility = "hidden";
    probe.style.whiteSpace = "nowrap";
    probe.style.fontSize = "11px";
    probe.style.fontWeight = "800";
    probe.style.fontFamily = "inherit";
    document.body.appendChild(probe);
    let maxWidth = 0;
    values.forEach(function (value) {
      probe.textContent = value || "";
      maxWidth = Math.max(maxWidth, Math.ceil(probe.getBoundingClientRect().width));
    });
    probe.remove();
    return maxWidth + padding;
  }

  function uniqueOnly(value, index, list) {
    return list.indexOf(value) === index;
  }

  function showFeedback(message, tone) {
    clearTimeout(uiState.feedbackTimer);
    dom.feedback.dataset.tone = tone || "";
    dom.feedback.textContent = message || "";
    if (!message) {
      return;
    }
    uiState.feedbackTimer = window.setTimeout(function () {
      dom.feedback.textContent = "";
      dom.feedback.dataset.tone = "";
    }, 4200);
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeXml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  // --- Public bridge for the Zodiac Galaxy Gate (and other external modules) ---
  // Keeps the grid logic inside this IIFE; exposes only safe, read-mostly hooks.
  const monthOpenSubscribers = [];

  function ensureYearOption(year) {
    if (!dom.yearSelect || year < 2020 || year > 2100) {
      return;
    }
    const exists = Array.prototype.some.call(dom.yearSelect.options, function (option) {
      return Number(option.value) === year;
    });
    if (exists) {
      return;
    }
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    const reference = Array.prototype.find.call(dom.yearSelect.options, function (item) {
      return Number(item.value) > year;
    });
    dom.yearSelect.add(option, reference || null);
  }

  function summarizeMonth(year, month) {
    const safeYear = sanitizeYear(year);
    const safeMonth = sanitizeMonth(month);
    const key = getMonthKeyFor(safeYear, safeMonth);
    const raw = state.months[key];
    const rows = raw && Array.isArray(raw.rows) ? raw.rows.map(normalizeRow) : [];
    const holidays = normalizeHolidays(raw && raw.holidays);
    const days = getDaysInMonth(safeYear, safeMonth);
    const result = {
      year: safeYear,
      month: safeMonth,
      key: key,
      rowCount: rows.length,
      employeeCount: 0,
      filledCells: 0,
      hasData: false,
      overtimeDays: 0,
      overtimeHours: 0,
      otNightHours: 0,
      otHolidayHours: 0,
      nightHours: 0,
      holidayCount: holidays.length,
      holidays: holidays
    };
    rows.forEach(function (row) {
      let rowFilled = 0;
      for (let day = 1; day <= days; day += 1) {
        const code = normalizeCellValue(row.shifts[String(day)]);
        if (code) {
          rowFilled += 1;
          const definition = SHIFT_CODE_MAP[code];
          if (definition) {
            result.nightHours += Number(definition.nightHours || 0);
          }
        }
      }
      if (rowFilled > 0) {
        result.employeeCount += 1;
      }
      result.filledCells += rowFilled;
      Object.keys(row.overtime).forEach(function (day) {
        const entry = row.overtime[day];
        const hours = Number(entry.hours) || 0;
        if (!hours) {
          return;
        }
        result.overtimeDays += 1;
        result.overtimeHours += hours;
        if (entry.type === "night" || entry.type === "holidayNight") {
          result.otNightHours += hours;
        }
        if (entry.type === "holiday" || entry.type === "holidayNight") {
          result.otHolidayHours += hours;
        }
      });
    });
    result.hasData = result.filledCells > 0;
    result.overtimeHours = Math.round(result.overtimeHours * 2) / 2;
    result.otNightHours = Math.round(result.otNightHours * 2) / 2;
    result.otHolidayHours = Math.round(result.otHolidayHours * 2) / 2;
    return result;
  }

  function notifyMonthOpen(year, month) {
    monthOpenSubscribers.forEach(function (callback) {
      try {
        callback({ year: year, month: month });
      } catch (error) {}
    });
  }

  window.YiDingScheduleView = {
    openMonth: function (year, month) {
      const safeYear = sanitizeYear(year);
      const safeMonth = sanitizeMonth(month);
      ensureYearOption(safeYear);
      handlePeriodChange(safeYear, safeMonth);
      notifyMonthOpen(safeYear, safeMonth);
      return { year: safeYear, month: safeMonth };
    },
    getSelected: function () {
      return { year: state.selectedYear, month: state.selectedMonth };
    },
    getMonthOverview: function (year, month) {
      return summarizeMonth(year, month);
    },
    getYearOverview: function (year) {
      const overview = [];
      for (let month = 1; month <= 12; month += 1) {
        overview.push(summarizeMonth(year, month));
      }
      return overview;
    },
    onMonthOpen: function (callback) {
      if (typeof callback === "function") {
        monthOpenSubscribers.push(callback);
      }
      return function () {
        const index = monthOpenSubscribers.indexOf(callback);
        if (index >= 0) {
          monthOpenSubscribers.splice(index, 1);
        }
      };
    }
  };
})();
