(function () {
  // Excel export for the schedule module — SpreadsheetML XML (.xls), no deps.
  // Self-contained: receives an export context from window.YiDingScheduleView
  // (getExportContext) so nothing here reads the grid's private state.
  // Month file : Sheet1 (lịch + summary + daily) + Sheet2 (mã ca) + OT_Notes.
  // Year file  : TongHopNam + 12 sheet 01_MaKet..12_NhanMa + Sheet2 + OT_Notes.
  // OT columns/rows are STATIC values (OT là metadata ngoài grid — không có
  // công thức Excel nào đếm được, nên không gắn formula để tránh recalc về 0).

  const ZODIAC_SHEETS = [
    "01_MaKet", "02_BaoBinh", "03_SongNgu", "04_BachDuong", "05_KimNguu", "06_SongTu",
    "07_CuGiai", "08_SuTu", "09_XuNu", "10_ThienBinh", "11_BoCap", "12_NhanMa"
  ];
  const OT_TYPE_LABELS = {
    normal: "Thường",
    night: "Đêm",
    holiday: "Lễ",
    holidayNight: "Lễ+Đêm"
  };

  function getView() {
    return window.YiDingScheduleView || null;
  }

  function escapeXml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
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

  function getCellType(value) {
    if (typeof value === "number") {
      return "Number";
    }
    if (typeof value === "string" && value !== "" && /^-?\d+(?:\.\d+)?$/.test(value)) {
      return "Number";
    }
    return "String";
  }

  function cell(index, value, styleId, type, formula) {
    const cellType = type || getCellType(value);
    const attributes = [
      'ss:Index="' + index + '"',
      styleId ? 'ss:StyleID="' + styleId + '"' : '',
      formula ? 'ss:Formula="' + escapeXml(formula) + '"' : ''
    ].filter(Boolean).join(" ");
    const data = value !== "" && value !== undefined && value !== null
      ? '<Data ss:Type="' + cellType + '">' + escapeXml(value) + '</Data>'
      : '';
    return { index: index, xml: "<Cell " + attributes + ">" + data + "</Cell>" };
  }

  function row(index, cells) {
    return '<Row ss:Index="' + index + '" ss:AutoFitHeight="0" ss:Height="18">' + cells.map(function (c) {
      return c.xml;
    }).join("") + "</Row>";
  }

  function sortCells(cells) {
    return cells.sort(function (a, b) { return a.index - b.index; });
  }

  function codeStyleId(code) {
    return "sC_" + String(code).replace(/[^A-Z0-9]/gi, "_");
  }

  // ---------- styles ----------

  function buildStyle(id, fillColor, fontColor, numberFormat, bold) {
    return [
      '<Style ss:ID="' + id + '">',
      '<Alignment ss:Horizontal="Center" ss:Vertical="Center"/>',
      '<Font ss:FontName="Arial" ss:Size="10"' + (bold === false ? "" : ' ss:Bold="1"') + (fontColor ? ' ss:Color="' + fontColor + '"' : "") + '/>',
      "<Borders>",
      '<Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>',
      '<Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>',
      '<Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>',
      '<Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>',
      "</Borders>",
      fillColor ? '<Interior ss:Color="' + fillColor + '" ss:Pattern="Solid"/>' : "",
      numberFormat ? '<NumberFormat ss:Format="' + numberFormat + '"/>' : "",
      "</Style>"
    ].join("");
  }

  function buildStyles(ctx) {
    const parts = [
      "<Styles>",
      '<Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/><Font ss:FontName="Arial" ss:Size="10"/></Style>',
      buildStyle("sGrid", null, null),
      buildStyle("sLabel", "#DDEBF7", null),
      buildStyle("sTitle", "#FFF2CC", null),
      buildStyle("sDay", "#9FD0FF", null, "d"),
      buildStyle("sWeekend", "#FF1F1F", "#FFFFFF", "d"),
      buildStyle("sHolidayDay", "#FFCF4A", null, "d"),
      buildStyle("sWeekday", "#9FD0FF", null),
      buildStyle("sWeekendText", "#FF1F1F", "#FFFFFF"),
      buildStyle("sHolidayText", "#FFCF4A", null),
      buildStyle("sSummary", null, null),
      buildStyle("sDaily", "#93D18B", null),
      buildStyle("sOt", "#FCE4C4", null),
      buildStyle("sOtHead", "#F5B971", null),
      buildStyle("sZero", null, "#FF0000"),
      buildStyle("sHidden", null, null)
    ];
    Object.keys(ctx.shiftColors).forEach(function (code) {
      const color = ctx.shiftColors[code];
      parts.push(buildStyle(codeStyleId(code), color.bg, color.fg));
    });
    parts.push("</Styles>");
    return parts.join("");
  }

  function getCodeStyle(ctx, code) {
    if (!code) {
      return "sGrid";
    }
    return ctx.shiftColors[code] ? codeStyleId(code) : "sGrid";
  }

  // ---------- per-row aggregates ----------

  function getRowAgg(ctx, scheduleRow) {
    const agg = { worked: 0, actualHours: 0, nightHours: 0, otDays: 0, otHours: 0, otNight: 0, otHoliday: 0, otPaid: 0 };
    for (let day = 1; day <= ctx.days; day += 1) {
      const code = String(scheduleRow.shifts[String(day)] || "").trim().toUpperCase();
      if (!code) {
        continue;
      }
      agg.worked += 1;
      const def = ctx.shiftMap[code];
      if (def) {
        agg.actualHours += Number(def.hoursPay || 0);
        agg.nightHours += Number(def.nightHours || 0);
      }
    }
    const overtime = scheduleRow.overtime || {};
    Object.keys(overtime).forEach(function (day) {
      const entry = overtime[day];
      const hours = entry && Number(entry.hours) ? Number(entry.hours) : 0;
      if (!hours || Number(day) > ctx.days) {
        return;
      }
      agg.otDays += 1;
      agg.otHours += hours;
      if (entry.type === "night" || entry.type === "holidayNight") {
        agg.otNight += hours;
      }
      if (entry.type === "holiday" || entry.type === "holidayNight") {
        agg.otHoliday += hours;
      }
      agg.otPaid += hours * (ctx.otMultiplier[entry.type] || 1);
    });
    ["otHours", "otNight", "otHoliday", "otPaid"].forEach(function (key) {
      agg[key] = Math.round(agg[key] * 2) / 2;
    });
    agg.totalPaid = Math.round((agg.actualHours + agg.otPaid) * 2) / 2;
    return agg;
  }

  function hasShiftValue(ctx, scheduleRow) {
    for (let day = 1; day <= ctx.days; day += 1) {
      if (String(scheduleRow.shifts[String(day)] || "").trim()) {
        return true;
      }
    }
    return false;
  }

  function getShiftCount(ctx, code) {
    let total = 0;
    ctx.rows.forEach(function (scheduleRow) {
      for (let day = 1; day <= ctx.days; day += 1) {
        if (String(scheduleRow.shifts[String(day)] || "").trim().toUpperCase() === code) {
          total += 1;
        }
      }
    });
    return total;
  }

  function getDailyCount(ctx, code, day) {
    const dayKey = String(day);
    return ctx.rows.reduce(function (total, scheduleRow) {
      return total + (String(scheduleRow.shifts[dayKey] || "").trim().toUpperCase() === code ? 1 : 0);
    }, 0);
  }

  function getDailyOt(ctx, day) {
    const dayKey = String(day);
    const result = { hours: 0, people: 0 };
    ctx.rows.forEach(function (scheduleRow) {
      const entry = scheduleRow.overtime && scheduleRow.overtime[dayKey];
      const hours = entry && Number(entry.hours) ? Number(entry.hours) : 0;
      if (hours) {
        result.hours += hours;
        result.people += 1;
      }
    });
    result.hours = Math.round(result.hours * 2) / 2;
    return result;
  }

  // ---------- schedule worksheet ----------

  const FIXED_SUMMARY_COLS = [
    { col: 37, code: "_TOTAL", label: "TL", time: null },
    { col: 38, code: "A", label: "A", time: "7-15" },
    { col: 39, code: "B", label: "B", time: "15-23" },
    { col: 40, code: "C", label: "C", time: "23-7" },
    { col: 41, code: "A3", label: "A3", time: "10-18" },
    { col: 42, code: "A4", label: "A4", time: "11-19" },
    { col: 43, code: "A5", label: "A5", time: "12-20" },
    { col: 44, code: "B2", label: "B2", time: "17-1" },
    { col: 45, code: "B4", label: "B4", time: "19-3" },
    { col: 46, code: "B6", label: "B6", time: "21-5" },
    { col: 47, code: "OFF", label: "OFF", time: null },
    { col: 48, code: "PH", label: "PH", time: null },
    { col: 49, code: "TL", label: "TL", time: null },
    { col: 50, code: "AL", label: "AL", time: null },
    { col: 51, code: "BL", label: "BL", time: null },
    { col: 52, code: "_OTDAYS", label: "加班(天)", time: null },
    { col: 53, code: "_REQ", label: "应上时数", time: null },
    { col: 54, code: "_ACT", label: "实际时数", time: null },
    { col: 55, code: "_NIGHT", label: "夜班补贴(时数)", time: null },
    { col: 56, code: "_NIGHTOT", label: "夜班OT补贴", time: null },
    { col: 57, code: "_NIGHTTOTAL", label: "夜班补贴合计", time: null },
    { col: 58, code: "_OTHOURS", label: "OT时数", time: null },
    { col: 59, code: "_OTHOLIDAY", label: "节OT(x3)", time: null },
    { col: 60, code: "_TOTALPAID", label: "实发时数", time: null }
  ];

  const SHEET2_ORDER = [2, 10, 18, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];

  function getOrderSheet2Row(rowIndex) {
    return SHEET2_ORDER[rowIndex - 2] || rowIndex;
  }

  function getCodeBySheet2Row(ctx, sheet2Row) {
    const def = ctx.shiftDefs[sheet2Row - 2];
    return def ? def.code : "";
  }

  function getOrderedCodes(ctx) {
    const codes = [];
    for (let rowIndex = 2; rowIndex <= 32; rowIndex += 1) {
      const code = getCodeBySheet2Row(ctx, getOrderSheet2Row(rowIndex));
      if (code) {
        codes.push(code);
      }
    }
    return codes;
  }

  function getActiveSummaryCodes(ctx) {
    return getOrderedCodes(ctx).filter(function (code) {
      return getShiftCount(ctx, code) > 0;
    });
  }

  function isWeekendColumn(ctx, colIndex) {
    const day = colIndex - 5;
    const weekday = new Date(ctx.year, ctx.month - 1, day).getDay();
    return weekday === 0 || weekday === 6;
  }

  function isHolidayColumn(ctx, colIndex) {
    return ctx.holidaySet[colIndex - 5] === true;
  }

  function dateValue(ctx, day) {
    return String(ctx.year) + "-" + String(ctx.month).padStart(2, "0") + "-" + String(day).padStart(2, "0") + "T00:00:00.000";
  }

  function weekdayLabel(ctx, day) {
    return ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date(ctx.year, ctx.month - 1, day).getDay()];
  }

  function buildColumnsXml() {
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
      '<Column ss:Index="52" ss:AutoFitWidth="0" ss:Width="56"/>',
      '<Column ss:Index="53" ss:AutoFitWidth="0" ss:Width="70"/>',
      '<Column ss:Index="54" ss:AutoFitWidth="0" ss:Width="70"/>',
      '<Column ss:Index="55" ss:AutoFitWidth="0" ss:Width="90"/>',
      '<Column ss:Index="56" ss:AutoFitWidth="0" ss:Width="80"/>',
      '<Column ss:Index="57" ss:AutoFitWidth="0" ss:Width="90"/>',
      '<Column ss:Index="58" ss:AutoFitWidth="0" ss:Width="62"/>',
      '<Column ss:Index="59" ss:AutoFitWidth="0" ss:Width="68"/>',
      '<Column ss:Index="60" ss:AutoFitWidth="0" ss:Width="68"/>',
      '<Column ss:Index="74" ss:Hidden="1" ss:AutoFitWidth="0" ss:Span="10" ss:Width="0"/>'
    ].join("");
  }

  function buildOptionsXml() {
    return [
      '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">',
      "<FreezePanes/>",
      "<FrozenNoSplit/>",
      "<SplitHorizontal>3</SplitHorizontal>",
      "<TopRowBottomPane>3</TopRowBottomPane>",
      "<SplitVertical>5</SplitVertical>",
      "<LeftColumnRightPane>5</LeftColumnRightPane>",
      "<ActivePane>0</ActivePane>",
      "<ProtectObjects>False</ProtectObjects>",
      "<ProtectScenarios>False</ProtectScenarios>",
      "</WorksheetOptions>"
    ].join("");
  }

  function addScheduleDataCells(ctx, cells, scheduleRow, rowIndex) {
    ctx.metaKeys.forEach(function (key, index) {
      const value = scheduleRow.employeeSnapshot ? scheduleRow.employeeSnapshot[key] : "";
      cells.push(cell(index + 1, value || "", "sGrid"));
    });
    for (let day = 1; day <= 31; day += 1) {
      const code = day <= ctx.days ? String(scheduleRow.shifts[String(day)] || "").trim().toUpperCase() : "";
      cells.push(cell(day + 5, code, getCodeStyle(ctx, code)));
    }
  }

  function addSummaryFormulaCells(ctx, cells, scheduleRow, rowIndex, codeSheetName) {
    const rowRange = "$F" + rowIndex + ":INDEX($F" + rowIndex + ":$AJ" + rowIndex + ",$CF$1)";
    const hasValue = hasShiftValue(ctx, scheduleRow);
    const agg = getRowAgg(ctx, scheduleRow);
    FIXED_SUMMARY_COLS.forEach(function (col) {
      let formula = null;
      let value = "";
      let style = "sSummary";
      if (col.code === "_TOTAL") {
        value = hasValue ? agg.worked : "";
        formula = '=IF(COUNTA(' + rowRange + ')=0,"",COUNTA(' + rowRange + "))";
      } else if (col.code === "_OTDAYS") {
        value = agg.otDays || (hasValue ? 0 : "");
        style = "sOt";
      } else if (col.code === "_REQ") {
        value = hasValue ? Math.max(0, (ctx.days - 4) * 8) : "";
        formula = '=IF(COUNTA(' + rowRange + ')=0,"",($CF$1-4)*8)';
      } else if (col.code === "_ACT") {
        value = hasValue ? agg.actualHours : "";
        formula = '=IF(COUNTA(' + rowRange + ')=0,"",SUMPRODUCT(COUNTIF(' + rowRange + "," + codeSheetName + "!$A$2:$A$32)," + codeSheetName + "!$D$2:$D$32))";
      } else if (col.code === "_NIGHT") {
        value = hasValue ? agg.nightHours : "";
        formula = '=IF(COUNTA(' + rowRange + ')=0,"",SUMPRODUCT(COUNTIF(' + rowRange + "," + codeSheetName + "!$A$2:$A$32)," + codeSheetName + "!$E$2:$E$32))";
      } else if (col.code === "_NIGHTOT") {
        value = agg.otNight || (hasValue ? 0 : "");
        style = "sOt";
      } else if (col.code === "_NIGHTTOTAL") {
        value = hasValue ? Math.round((agg.nightHours + agg.otNight) * 2) / 2 : "";
        formula = '=IF(COUNTA(' + rowRange + ')=0,"",' + excelColName(55) + rowIndex + "+" + excelColName(56) + rowIndex + ")";
      } else if (col.code === "_OTHOURS") {
        value = agg.otHours || (hasValue ? 0 : "");
        style = "sOt";
      } else if (col.code === "_OTHOLIDAY") {
        value = agg.otHoliday || (hasValue ? 0 : "");
        style = "sOt";
      } else if (col.code === "_TOTALPAID") {
        value = hasValue ? agg.totalPaid : "";
        style = "sOt";
      } else {
        value = hasValue ? (function () {
          let count = 0;
          for (let day = 1; day <= ctx.days; day += 1) {
            if (String(scheduleRow.shifts[String(day)] || "").trim().toUpperCase() === col.code) {
              count += 1;
            }
          }
          return count;
        })() : "";
        formula = '=IF(COUNTA(' + rowRange + ')=0,"",COUNTIF(' + rowRange + ',"' + col.code + '"))';
      }
      cells.push(cell(col.col, value, style, typeof value === "number" ? "Number" : "String", formula));
    });
  }

  function addDailySummaryCells(ctx, cells, rowIndex, scheduleLastRow, bottomStartRow, activeCodes) {
    const lineIndex = rowIndex - bottomStartRow;
    if (lineIndex < activeCodes.length) {
      const code = activeCodes[lineIndex];
      cells.push(cell(5, code, "sSummary", "String"));
      for (let colIndex = 6; colIndex <= 36; colIndex += 1) {
        const day = colIndex - 5;
        const colName = excelColName(colIndex);
        const value = day <= ctx.days ? getDailyCount(ctx, code, day) : "";
        cells.push(cell(colIndex, value, "sDaily", "Number", '=IF(OR($E' + rowIndex + '="",' + colName + '$3=""),"",COUNTIF(' + colName + "$5:" + colName + "$" + scheduleLastRow + ",$E" + rowIndex + "))"));
      }
      return;
    }
    // Two static OT lines under the per-code daily counts.
    const otLine = lineIndex - activeCodes.length;
    if (otLine === 0 || otLine === 1) {
      cells.push(cell(5, otLine === 0 ? "OT(h)" : "OT人", "sOtHead", "String"));
      for (let day = 1; day <= ctx.days; day += 1) {
        const daily = getDailyOt(ctx, day);
        const value = otLine === 0 ? (daily.hours || "") : (daily.people || "");
        cells.push(cell(day + 5, value, "sOt"));
      }
    }
  }

  function addShiftOrderHelperCells(ctx, cells, rowIndex, scheduleLastRow) {
    if (rowIndex < 2 || rowIndex > 32) {
      return;
    }
    const sheet2Row = getOrderSheet2Row(rowIndex);
    const code = getCodeBySheet2Row(ctx, sheet2Row);
    const count = getShiftCount(ctx, code);
    let rank = "";
    if (count > 0) {
      rank = 0;
      for (let current = 2; current <= rowIndex; current += 1) {
        if (getShiftCount(ctx, getCodeBySheet2Row(ctx, getOrderSheet2Row(current))) > 0) {
          rank += 1;
        }
      }
    }
    cells.push(cell(74, code, "sHidden", "String", "=" + ctx.codeSheetName + "!A" + sheet2Row));
    cells.push(cell(75, count, "sHidden", "Number", '=COUNTIF($F$5:INDEX($F$5:$AJ$' + scheduleLastRow + ",ROWS($F$5:$AJ$" + scheduleLastRow + "),$CF$1),BV" + rowIndex + ")"));
    cells.push(cell(76, rank, "sHidden", "Number", '=IF(BW' + rowIndex + '>0,COUNTIF($BW$2:BW' + rowIndex + ',">0"),"")'));
    cells.push(cell(77, code, "sHidden", "String", "=" + ctx.codeSheetName + "!A" + sheet2Row));
    cells.push(cell(78, count, "sHidden", "Number", '=COUNTIF($F$5:INDEX($F$5:$AJ$' + scheduleLastRow + ",ROWS($F$5:$AJ$" + scheduleLastRow + "),$CF$1),BY" + rowIndex + ")"));
    cells.push(cell(79, rank, "sHidden", "Number", '=IF(BZ' + rowIndex + '>0,COUNTIF($BZ$2:BZ' + rowIndex + ',">0"),"")'));
  }

  function buildScheduleRowCells(ctx, rowIndex, scheduleLastRow, bottomStartRow, activeCodes) {
    const cells = [];
    if (rowIndex === 1) {
      cells.push(cell(2, "年", "sLabel"));
      cells.push(cell(3, ctx.year, "sTitle", "Number"));
      cells.push(cell(4, "月", "sLabel"));
      cells.push(cell(5, ctx.month, "sTitle", "Number"));
      cells.push(cell(84, ctx.days, "sHidden", "Number", "=DAY(EOMONTH(DATE($C$1,$E$1,1),0))"));
    }
    if (rowIndex === 3) {
      for (let colIndex = 6; colIndex <= 36; colIndex += 1) {
        const day = colIndex - 5;
        const style = isHolidayColumn(ctx, colIndex) ? "sHolidayDay" : (isWeekendColumn(ctx, colIndex) ? "sWeekend" : "sDay");
        const value = day <= ctx.days ? dateValue(ctx, day) : "";
        cells.push(cell(colIndex, value, style, "DateTime", '=IF(COLUMN()-COLUMN($F$3)+1<=$CF$1,DATE($C$1,$E$1,COLUMN()-COLUMN($F$3)+1),"")'));
      }
      FIXED_SUMMARY_COLS.forEach(function (col) {
        if (col.time) {
          cells.push(cell(col.col, col.time, "sSummary", "String"));
        }
      });
    }
    if (rowIndex === 4) {
      ctx.metaHeaders.forEach(function (label, index) {
        cells.push(cell(index + 1, label, "sGrid"));
      });
      for (let colIndex = 6; colIndex <= 36; colIndex += 1) {
        const day = colIndex - 5;
        const style = isHolidayColumn(ctx, colIndex) ? "sHolidayText" : (isWeekendColumn(ctx, colIndex) ? "sWeekendText" : "sWeekday");
        const value = day <= ctx.days ? weekdayLabel(ctx, day) : "";
        cells.push(cell(colIndex, value, style, "String"));
      }
      FIXED_SUMMARY_COLS.forEach(function (col) {
        cells.push(cell(col.col, col.label, col.col >= 52 && ["_OTDAYS", "_NIGHTOT", "_OTHOURS", "_OTHOLIDAY", "_TOTALPAID"].indexOf(col.code) >= 0 ? "sOtHead" : "sSummary", "String"));
      });
    }
    if (rowIndex === bottomStartRow - 1) {
      cells.push(cell(5, ctx.dailyCodeLabel, "sGrid"));
      for (let colIndex = 6; colIndex <= 36; colIndex += 1) {
        const day = colIndex - 5;
        if (day <= ctx.days) {
          const style = isHolidayColumn(ctx, colIndex) ? "sHolidayDay" : (isWeekendColumn(ctx, colIndex) ? "sWeekend" : "sDay");
          cells.push(cell(colIndex, day, style, "Number"));
        }
      }
    }
    if (rowIndex >= 5 && rowIndex <= scheduleLastRow) {
      const scheduleRow = ctx.rows[rowIndex - 5];
      if (scheduleRow) {
        addScheduleDataCells(ctx, cells, scheduleRow, rowIndex);
        addSummaryFormulaCells(ctx, cells, scheduleRow, rowIndex, ctx.codeSheetName);
      }
    }
    if (rowIndex >= bottomStartRow && rowIndex < bottomStartRow + activeCodes.length + 2) {
      addDailySummaryCells(ctx, cells, rowIndex, scheduleLastRow, bottomStartRow, activeCodes);
    }
    addShiftOrderHelperCells(ctx, cells, rowIndex, scheduleLastRow);
    return sortCells(cells);
  }

  function buildScheduleWorksheetXml(ctx, sheetName) {
    const activeCodes = getActiveSummaryCodes(ctx);
    const scheduleLastRow = Math.max(60, 4 + ctx.rows.length);
    const bottomStartRow = scheduleLastRow + 2;
    const bottomLastRow = bottomStartRow + activeCodes.length + 2;
    const rowsXml = [];
    for (let rowIndex = 1; rowIndex <= bottomLastRow; rowIndex += 1) {
      const cells = buildScheduleRowCells(ctx, rowIndex, scheduleLastRow, bottomStartRow, activeCodes);
      if (cells.length) {
        rowsXml.push(row(rowIndex, cells));
      }
    }
    return [
      '<Worksheet ss:Name="' + escapeXml(sheetName) + '">',
      '<Table ss:ExpandedColumnCount="84" ss:ExpandedRowCount="' + bottomLastRow + '" x:FullColumns="1" x:FullRows="1">',
      buildColumnsXml(),
      rowsXml.join(""),
      "</Table>",
      buildOptionsXml(),
      "</Worksheet>"
    ].join("");
  }

  // ---------- shift definitions worksheet ----------

  function buildCodeSheetXml(ctx, sheetName) {
    const rows = [
      row(1, [
        cell(1, "SHIFT CODE", "sLabel"),
        cell(2, "CHECK IN TIME", "sLabel"),
        cell(3, "CHECK OUT TIME", "sLabel"),
        cell(4, "PAY HOURS", "sLabel"),
        cell(5, "NIGHT SHIFT HOURS", "sLabel"),
        cell(6, "REMARK", "sLabel")
      ])
    ];
    ctx.shiftDefs.forEach(function (item, index) {
      rows.push(row(index + 2, [
        cell(1, item.code, getCodeStyle(ctx, item.code)),
        cell(2, item.checkIn, "sGrid", getCellType(item.checkIn)),
        cell(3, item.checkOut, "sGrid", getCellType(item.checkOut)),
        cell(4, item.hoursPay, Number(item.hoursPay) === 0 ? "sZero" : "sGrid", "Number"),
        cell(5, item.nightHours, Number(item.nightHours) === 0 ? "sZero" : "sGrid", "Number"),
        cell(6, ctx.legendRemarks[item.code] || "", "sGrid")
      ]));
    });
    return [
      '<Worksheet ss:Name="' + escapeXml(sheetName) + '">',
      '<Table ss:ExpandedColumnCount="6" ss:ExpandedRowCount="' + (ctx.shiftDefs.length + 1) + '" x:FullColumns="1" x:FullRows="1">',
      '<Column ss:AutoFitWidth="0" ss:Width="90"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="110"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="120"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="90"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="130"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="220"/>',
      rows.join(""),
      "</Table>",
      "</Worksheet>"
    ].join("");
  }

  // ---------- OT notes worksheet ----------

  function collectOtNotes(ctxs) {
    const notes = [];
    ctxs.forEach(function (ctx) {
      ctx.rows.forEach(function (scheduleRow) {
        const overtime = scheduleRow.overtime || {};
        Object.keys(overtime).map(Number).sort(function (a, b) { return a - b; }).forEach(function (day) {
          const entry = overtime[String(day)];
          const hours = entry && Number(entry.hours) ? Number(entry.hours) : 0;
          if (!hours || day > ctx.days) {
            return;
          }
          const snapshot = scheduleRow.employeeSnapshot || {};
          const multiplier = ctx.otMultiplier[entry.type] || 1;
          notes.push({
            month: ctx.month,
            day: day,
            ydiId: snapshot.ydiId || "",
            name: snapshot.vieName || snapshot.engName || "",
            shiftCode: String(scheduleRow.shifts[String(day)] || "").trim().toUpperCase(),
            hours: hours,
            type: OT_TYPE_LABELS[entry.type] || entry.type,
            multiplier: multiplier,
            paidHours: Math.round(hours * multiplier * 2) / 2,
            note: entry.note || "",
            approvedBy: entry.approvedBy || ""
          });
        });
      });
    });
    return notes;
  }

  function buildOtNotesSheetXml(ctxs, sheetName) {
    const styleCtx = ctxs[0];
    const notes = collectOtNotes(ctxs);
    const headers = ["Tháng", "Ngày", "Mã YDI", "Tên", "Ca chính", "Giờ OT", "Loại", "Hệ số", "Giờ tính lương", "Ghi chú", "Người duyệt"];
    const rows = [row(1, headers.map(function (label, index) {
      return cell(index + 1, label, "sOtHead", "String");
    }))];
    notes.forEach(function (note, index) {
      rows.push(row(index + 2, [
        cell(1, note.month, "sGrid", "Number"),
        cell(2, note.day, "sGrid", "Number"),
        cell(3, note.ydiId, "sGrid"),
        cell(4, note.name, "sGrid"),
        cell(5, note.shiftCode, getCodeStyle(styleCtx, note.shiftCode)),
        cell(6, note.hours, "sGrid", "Number"),
        cell(7, note.type, "sGrid"),
        cell(8, note.multiplier, note.multiplier > 1 ? "sOt" : "sGrid", "Number"),
        cell(9, note.paidHours, "sOt", "Number"),
        cell(10, note.note, "sGrid"),
        cell(11, note.approvedBy, "sGrid")
      ]));
    });
    return [
      '<Worksheet ss:Name="' + escapeXml(sheetName) + '">',
      '<Table ss:ExpandedColumnCount="11" ss:ExpandedRowCount="' + (notes.length + 1) + '" x:FullColumns="1" x:FullRows="1">',
      '<Column ss:AutoFitWidth="0" ss:Width="44"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="44"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="72"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="170"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="62"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="56"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="70"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="48"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="92"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="220"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="110"/>',
      rows.join(""),
      "</Table>",
      "</Worksheet>"
    ].join("");
  }

  // ---------- year summary worksheet ----------

  function buildYearSummarySheetXml(ctxs, year, sheetName) {
    const byEmployee = {};
    const order = [];
    ctxs.forEach(function (ctx) {
      ctx.rows.forEach(function (scheduleRow) {
        const snapshot = scheduleRow.employeeSnapshot || {};
        const key = snapshot.ydiId || snapshot.vieName || snapshot.engName || scheduleRow.id;
        if (!byEmployee[key]) {
          byEmployee[key] = {
            ydiId: snapshot.ydiId || "",
            department: snapshot.department || "",
            vieName: snapshot.vieName || "",
            engName: snapshot.engName || "",
            position: snapshot.position || "",
            months: 0, otDays: 0, otHours: 0, otNight: 0, otHoliday: 0, nightHours: 0, totalPaid: 0
          };
          order.push(key);
        }
        const agg = getRowAgg(ctx, scheduleRow);
        const target = byEmployee[key];
        if (agg.worked > 0) {
          target.months += 1;
        }
        target.otDays += agg.otDays;
        target.otHours += agg.otHours;
        target.otNight += agg.otNight;
        target.otHoliday += agg.otHoliday;
        target.nightHours += agg.nightHours;
        target.totalPaid += agg.totalPaid;
      });
    });
    const headers = ["Mã YDI", "Bộ phận", "Tên Việt", "Tên Anh", "Chức vụ", "Số tháng có lịch", "Ngày OT", "Giờ OT", "OT đêm", "OT lễ (x3)", "Giờ ca đêm", "Tổng giờ thực tế"];
    const rows = [
      row(1, [cell(1, "Tổng hợp năm " + year, "sTitle", "String")]),
      row(2, headers.map(function (label, index) {
        return cell(index + 1, label, "sLabel", "String");
      }))
    ];
    order.forEach(function (key, index) {
      const e = byEmployee[key];
      rows.push(row(index + 3, [
        cell(1, e.ydiId, "sGrid"),
        cell(2, e.department, "sGrid"),
        cell(3, e.vieName, "sGrid"),
        cell(4, e.engName, "sGrid"),
        cell(5, e.position, "sGrid"),
        cell(6, e.months, "sGrid", "Number"),
        cell(7, e.otDays, "sOt", "Number"),
        cell(8, Math.round(e.otHours * 2) / 2, "sOt", "Number"),
        cell(9, Math.round(e.otNight * 2) / 2, "sOt", "Number"),
        cell(10, Math.round(e.otHoliday * 2) / 2, "sOt", "Number"),
        cell(11, Math.round(e.nightHours * 2) / 2, "sGrid", "Number"),
        cell(12, Math.round(e.totalPaid * 2) / 2, "sOt", "Number")
      ]));
    });
    return [
      '<Worksheet ss:Name="' + escapeXml(sheetName) + '">',
      '<Table ss:ExpandedColumnCount="12" ss:ExpandedRowCount="' + (order.length + 2) + '" x:FullColumns="1" x:FullRows="1">',
      '<Column ss:AutoFitWidth="0" ss:Width="72"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="120"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="170"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="120"/>',
      '<Column ss:AutoFitWidth="0" ss:Width="96"/>',
      '<Column ss:AutoFitWidth="0" ss:Span="6" ss:Width="76"/>',
      rows.join(""),
      "</Table>",
      '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>2</SplitHorizontal><TopRowBottomPane>2</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions>',
      "</Worksheet>"
    ].join("");
  }

  // ---------- workbook assembly ----------

  function workbookXml(stylesXml, worksheets) {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<?mso-application progid="Excel.Sheet"?>',
      '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ',
      'xmlns:o="urn:schemas-microsoft-com:office:office" ',
      'xmlns:x="urn:schemas-microsoft-com:office:excel" ',
      'xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" ',
      'xmlns:html="http://www.w3.org/TR/REC-html40">',
      '<DocumentProperties xmlns="urn:schemas-microsoft-com:office:office"><Author>YiDing</Author></DocumentProperties>',
      stylesXml,
      worksheets.join(""),
      "</Workbook>"
    ].join("");
  }

  function download(xml, filename) {
    const blob = new Blob(["\ufeff", xml], { type: "application/vnd.ms-excel;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function buildContext(year, month, codeSheetName) {
    const view = getView();
    if (!view || !view.getExportContext) {
      return null;
    }
    const ctx = view.getExportContext(year, month);
    ctx.codeSheetName = codeSheetName;
    ctx.shiftMap = {};
    ctx.shiftDefs.forEach(function (def) { ctx.shiftMap[def.code] = def; });
    ctx.holidaySet = {};
    (ctx.holidays || []).forEach(function (day) { ctx.holidaySet[Number(day)] = true; });
    return ctx;
  }

  function exportMonth(year, month) {
    const ctx = buildContext(year, month, "Sheet2");
    if (!ctx) {
      return false;
    }
    const sheets = [
      buildScheduleWorksheetXml(ctx, "Sheet1"),
      buildCodeSheetXml(ctx, "Sheet2")
    ];
    if (collectOtNotes([ctx]).length) {
      sheets.push(buildOtNotesSheetXml([ctx], "OT_Notes"));
    }
    download(workbookXml(buildStyles(ctx), sheets), "schedule_" + year + "_" + String(month).padStart(2, "0") + ".xls");
    return true;
  }

  function exportYear(year) {
    const ctxs = [];
    for (let month = 1; month <= 12; month += 1) {
      ctxs.push(buildContext(year, month, "Sheet2"));
    }
    if (ctxs.indexOf(null) >= 0) {
      return false;
    }
    const sheets = [buildYearSummarySheetXml(ctxs, year, "TongHopNam")];
    ctxs.forEach(function (ctx, index) {
      sheets.push(buildScheduleWorksheetXml(ctx, ZODIAC_SHEETS[index]));
    });
    sheets.push(buildCodeSheetXml(ctxs[0], "Sheet2"));
    if (collectOtNotes(ctxs).length) {
      sheets.push(buildOtNotesSheetXml(ctxs, "OT_Notes"));
    }
    download(workbookXml(buildStyles(ctxs[0]), sheets), "schedule_" + year + "_full_year.xls");
    return true;
  }

  window.YiDingScheduleExcel = {
    exportMonth: exportMonth,
    exportYear: exportYear
  };
})();
