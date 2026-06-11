(function () {
  // Zodiac Galaxy Gate — full-page month picker layered over the existing galaxy
  // canvas. Pure HTML/CSS overlay (no extra canvas). Talks to the schedule grid
  // only through window.YiDingScheduleView, so the grid stays untouched.
  // The zodiac signs are VISUAL THEMES for calendar months (Jan=Capricorn ...
  // Dec=Sagittarius); every month still starts on day 1 — no astrological dates.
  const scheduleView = window.YiDingScheduleView || null;
  const body = document.body;
  if (!scheduleView || !body || !body.classList.contains("edit-page")) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const isAutomation = Boolean(window.navigator && window.navigator.webdriver);
  const forceGate = params.get("gate") === "1";
  const suppressGate = params.get("gate") === "0";
  // Playwright suite drives the grid directly — keep the gate out of its way
  // unless a test opts in with ?gate=1.
  if (suppressGate || (isAutomation && !forceGate)) {
    return;
  }

  const YEAR_MIN = 2020;
  const YEAR_MAX = 2100;
  const ZODIAC_MONTHS = [
    { month: 1, symbol: "♑", vi: "Ma Kết", hue: 258 },
    { month: 2, symbol: "♒", vi: "Bảo Bình", hue: 222 },
    { month: 3, symbol: "♓", vi: "Song Ngư", hue: 200 },
    { month: 4, symbol: "♈", vi: "Bạch Dương", hue: 16 },
    { month: 5, symbol: "♉", vi: "Kim Ngưu", hue: 42 },
    { month: 6, symbol: "♊", vi: "Song Tử", hue: 52 },
    { month: 7, symbol: "♋", vi: "Cự Giải", hue: 190 },
    { month: 8, symbol: "♌", vi: "Sư Tử", hue: 36 },
    { month: 9, symbol: "♍", vi: "Xử Nữ", hue: 96 },
    { month: 10, symbol: "♎", vi: "Thiên Bình", hue: 280 },
    { month: 11, symbol: "♏", vi: "Bọ Cạp", hue: 320 },
    { month: 12, symbol: "♐", vi: "Nhân Mã", hue: 245 }
  ];

  const gate = {
    visible: false,
    mode: "grid", // grid | preview
    year: scheduleView.getSelected().year,
    previewMonth: 0,
    hasOpenSheet: false
  };

  const root = document.createElement("div");
  root.id = "zodiacGate";
  root.className = "zg";
  root.hidden = true;
  body.appendChild(root);

  function clampYear(year) {
    return Math.min(YEAR_MAX, Math.max(YEAR_MIN, Math.round(Number(year) || gate.year)));
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function formatHours(value) {
    return String(Math.round((Number(value) || 0) * 2) / 2);
  }

  function getZodiac(month) {
    return ZODIAC_MONTHS[month - 1];
  }

  function buildMonthCard(info, overview, now, selected) {
    const isNow = info.month === now.month && gate.year === now.year;
    const isOpen = info.month === selected.month && gate.year === selected.year;
    const classes = ["zg-month"];
    classes.push(overview.hasData ? "is-filled" : "is-empty");
    if (overview.overtimeDays > 0) { classes.push("has-ot"); }
    if (overview.holidayCount > 0) { classes.push("has-holiday"); }
    if (isOpen) { classes.push("is-open"); }
    if (isNow) { classes.push("is-now"); }
    const statusText = overview.hasData
      ? overview.employeeCount + " NV · " + overview.filledCells + " ô" + (overview.overtimeDays ? " · OT " + formatHours(overview.overtimeHours) + "h" : "")
      : "Trống";
    return [
      '<button type="button" class="' + classes.join(" ") + '" data-zg-month="' + info.month + '" style="--zg-hue:' + info.hue + '" aria-label="Tháng ' + info.month + ' ' + escapeHtml(info.vi) + '">',
      '<span class="zg-month__orb" aria-hidden="true">',
      '<span class="zg-month__spiral"></span>',
      '<span class="zg-month__spiral zg-month__spiral--b"></span>',
      '<span class="zg-month__symbol">' + info.symbol + '</span>',
      overview.holidayCount > 0 ? '<span class="zg-month__holiday-dot"></span>' : "",
      isNow ? '<span class="zg-month__now">NOW</span>' : "",
      '</span>',
      '<span class="zg-month__num">Tháng ' + info.month + '</span>',
      '<span class="zg-month__name">' + escapeHtml(info.vi) + '</span>',
      '<span class="zg-month__status">' + escapeHtml(statusText) + '</span>',
      '</button>'
    ].join("");
  }

  function renderGrid() {
    const overviews = scheduleView.getYearOverview(gate.year);
    const nowDate = new Date();
    const now = { year: nowDate.getFullYear(), month: nowDate.getMonth() + 1 };
    const selected = scheduleView.getSelected();
    const cards = ZODIAC_MONTHS.map(function (info) {
      return buildMonthCard(info, overviews[info.month - 1], now, selected);
    }).join("");
    root.innerHTML = [
      '<div class="zg-inner" role="dialog" aria-label="Chọn tháng">',
      gate.hasOpenSheet ? '<button type="button" class="zg-close" data-zg-close aria-label="Đóng">×</button>' : "",
      '<h1 class="zg-title">Ca làm</h1>',
      '<div class="zg-years">',
      '<button type="button" class="zg-years__arrow" data-zg-year-step="-1" aria-label="Năm trước">‹</button>',
      '<button type="button" class="zg-years__side" data-zg-year="' + (gate.year - 1) + '"' + (gate.year - 1 < YEAR_MIN ? " disabled" : "") + '>' + (gate.year - 1) + '</button>',
      '<span class="zg-years__current">' + gate.year + '</span>',
      '<button type="button" class="zg-years__side" data-zg-year="' + (gate.year + 1) + '"' + (gate.year + 1 > YEAR_MAX ? " disabled" : "") + '>' + (gate.year + 1) + '</button>',
      '<button type="button" class="zg-years__arrow" data-zg-year-step="1" aria-label="Năm sau">›</button>',
      '</div>',
      '<div class="zg-grid">' + cards + '</div>',
      '<p class="zg-hint">← → đổi năm · bấm thiên hà để xem tháng</p>',
      '</div>'
    ].join("");
  }

  function renderPreview() {
    const info = getZodiac(gate.previewMonth);
    const ov = scheduleView.getMonthOverview(gate.year, gate.previewMonth);
    const statusLine = ov.hasData
      ? '<span class="zg-preview__state is-filled">Đã có lịch</span>'
      : '<span class="zg-preview__state">Chưa có dữ liệu</span>';
    const stats = [
      ["Nhân viên trong tháng", ov.employeeCount + (ov.rowCount > ov.employeeCount ? " / " + ov.rowCount + " hàng" : "")],
      ["Ô ca đã điền", ov.filledCells],
      ["Ngày có tăng ca", ov.overtimeDays],
      ["Giờ tăng ca", formatHours(ov.overtimeHours) + "h" + (ov.otNightHours ? " (đêm " + formatHours(ov.otNightHours) + "h)" : "")],
      ["Giờ OT lễ (x3)", formatHours(ov.otHolidayHours) + "h"],
      ["Giờ ca đêm", formatHours(ov.nightHours) + "h"],
      ["Ngày lễ đã đánh dấu", ov.holidayCount]
    ].map(function (pair) {
      return '<div class="zg-preview__stat"><dt>' + pair[0] + '</dt><dd>' + escapeHtml(String(pair[1])) + '</dd></div>';
    }).join("");
    root.innerHTML = [
      '<div class="zg-inner zg-inner--preview" role="dialog" aria-label="Xem tháng">',
      '<div class="zg-preview" style="--zg-hue:' + info.hue + '">',
      '<span class="zg-preview__orb" aria-hidden="true">',
      '<span class="zg-month__spiral"></span>',
      '<span class="zg-month__spiral zg-month__spiral--b"></span>',
      '<span class="zg-preview__symbol">' + info.symbol + '</span>',
      '</span>',
      '<h2 class="zg-preview__title">Tháng ' + gate.previewMonth + ' / ' + escapeHtml(info.vi) + ' / ' + gate.year + '</h2>',
      statusLine,
      '<dl class="zg-preview__stats">' + stats + '</dl>',
      '<div class="zg-preview__actions">',
      '<button type="button" class="zg-btn zg-btn--primary" data-zg-open-month="' + gate.previewMonth + '">Mở bảng tháng này</button>',
      '<button type="button" class="zg-btn" data-zg-back>Quay lại 12 tháng</button>',
      '</div>',
      '<p class="zg-hint">ESC để quay lại</p>',
      '</div>',
      '</div>'
    ].join("");
  }

  function render() {
    if (gate.mode === "preview" && gate.previewMonth) {
      renderPreview();
    } else {
      renderGrid();
    }
  }

  function show(fromBreadcrumb) {
    gate.visible = true;
    gate.hasOpenSheet = Boolean(fromBreadcrumb);
    gate.mode = "grid";
    gate.year = clampYear(scheduleView.getSelected().year);
    root.hidden = false;
    body.classList.add("zg-lock");
    render();
  }

  function hide() {
    gate.visible = false;
    gate.mode = "grid";
    gate.previewMonth = 0;
    root.hidden = true;
    body.classList.remove("zg-lock");
    // The sticky-metrics observers measured the page while covered; nudge them.
    window.dispatchEvent(new Event("resize"));
  }

  function setYear(year) {
    const next = clampYear(year);
    if (next === gate.year) {
      return;
    }
    gate.year = next;
    render();
  }

  function openPreview(month) {
    gate.mode = "preview";
    gate.previewMonth = month;
    render();
  }

  function backToGrid() {
    gate.mode = "grid";
    gate.previewMonth = 0;
    render();
  }

  function openMonth(month) {
    scheduleView.openMonth(gate.year, month);
    hide();
    renderBreadcrumb();
  }

  function renderBreadcrumb() {
    const spacer = document.querySelector(".schedule-header__spacer");
    if (!spacer) {
      return;
    }
    const selected = scheduleView.getSelected();
    const info = getZodiac(selected.month);
    spacer.innerHTML = [
      '<button type="button" id="zodiacGateBreadcrumb" class="zg-breadcrumb">',
      '<span class="zg-breadcrumb__back">← Dải ngân hà</span>',
      '<span class="zg-breadcrumb__sep">/</span><span>' + selected.year + '</span>',
      '<span class="zg-breadcrumb__sep">/</span><span>Tháng ' + selected.month + '</span>',
      '<span class="zg-breadcrumb__sep">/</span><span class="zg-breadcrumb__sign">' + info.symbol + ' ' + escapeHtml(info.vi) + '</span>',
      '</button>'
    ].join("");
  }

  root.addEventListener("click", function (event) {
    const yearStep = event.target.closest("[data-zg-year-step]");
    if (yearStep) {
      setYear(gate.year + Number(yearStep.getAttribute("data-zg-year-step")));
      return;
    }
    const yearBtn = event.target.closest("[data-zg-year]");
    if (yearBtn) {
      setYear(Number(yearBtn.getAttribute("data-zg-year")));
      return;
    }
    const monthBtn = event.target.closest("[data-zg-month]");
    if (monthBtn) {
      openPreview(Number(monthBtn.getAttribute("data-zg-month")));
      return;
    }
    const openBtn = event.target.closest("[data-zg-open-month]");
    if (openBtn) {
      openMonth(Number(openBtn.getAttribute("data-zg-open-month")));
      return;
    }
    if (event.target.closest("[data-zg-back]")) {
      backToGrid();
      return;
    }
    if (event.target.closest("[data-zg-close]")) {
      hide();
    }
  });

  // Capture phase: the grid's global keydown handler preventDefaults most keys
  // while the sheet is locked — the gate must win while it is open.
  window.addEventListener("keydown", function (event) {
    if (!gate.visible) {
      return;
    }
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      if (gate.mode === "preview") {
        backToGrid();
      } else if (gate.hasOpenSheet) {
        hide();
      }
      return;
    }
    if (gate.mode === "grid") {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setYear(gate.year - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setYear(gate.year + 1);
      }
    }
  }, true);

  document.addEventListener("click", function (event) {
    if (event.target.closest("#zodiacGateBreadcrumb")) {
      show(true);
    }
  });

  scheduleView.onMonthOpen(function () {
    renderBreadcrumb();
  });

  window.YiDingZodiacGate = { show: show, hide: hide };

  // First visit: the gate is the front door of the page.
  show(false);
  renderBreadcrumb();
})();
