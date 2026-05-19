import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

(function () {
  const i18n = window.YiDingI18n || null;
  const authStore = window.YiDingAuthStore || null;
  const employeesDataApi = window.YiDingEmployeesData || null;
  const SCHEDULE_STORAGE_KEY = "yiding_schedule_module_v3";
  const HOME_TAB_STORAGE_KEY = "yiding_dashboard_active_tab_v2";
  const SALARY_SHIFT_STORAGE_KEY = "yiding_salary_shift_definitions_v1";
  const REDIRECT_TO_LOGIN = "../index.html";
  const CHI_CHI_URL = "http://46.225.160.243";
  const PDF_FORM_URL = new URL("../pdf/ito-representative-application-form.pdf", import.meta.url).href;
  const ROLE_OWNER = "owner";
  const NIGHT_SHIFT_START_MINUTES = 22 * 60;
  const NIGHT_SHIFT_END_MINUTES = 6 * 60;
  const MONTHLY_OFF_DAYS = 4;
  const STANDARD_HOURS_PER_DAY = 8;
  const NIGHT_ALLOWANCE_RATE = 0.3;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  // Quy uoc ca mac dinh. Co the sua tren giao dien Tinh luong va luu lai trong may.
  const DEFAULT_SALARY_SHIFT_DEFINITIONS = Object.freeze([
    { code: "A", start: "07:00", end: "15:00" },
    { code: "A1", start: "08:00", end: "16:00" },
    { code: "A2", start: "09:00", end: "17:00" },
    { code: "A3", start: "10:00", end: "18:00" },
    { code: "A4", start: "11:00", end: "19:00" },
    { code: "A5", start: "12:00", end: "20:00" },
    { code: "A6", start: "13:00", end: "21:00" },
    { code: "A7", start: "14:00", end: "22:00" },
    { code: "B", start: "15:00", end: "23:00" },
    { code: "B1", start: "16:00", end: "00:00" },
    { code: "B2", start: "17:00", end: "01:00" },
    { code: "B3", start: "18:00", end: "02:00" },
    { code: "B4", start: "19:00", end: "03:00" },
    { code: "B5", start: "20:00", end: "04:00" },
    { code: "B6", start: "21:00", end: "05:00" },
    { code: "B7", start: "22:00", end: "06:00" },
    { code: "C", start: "23:00", end: "07:00" },
    { code: "C1", start: "00:00", end: "08:00" },
    { code: "C2", start: "01:00", end: "09:00" },
    { code: "C3", start: "02:00", end: "10:00" },
    { code: "C4", start: "03:00", end: "11:00" },
    { code: "C5", start: "04:00", end: "12:00" },
    { code: "C6", start: "05:00", end: "13:00" },
    { code: "C7", start: "06:00", end: "14:00" }
  ]);
  const SHIFT_CODE_DEFINITIONS = Object.freeze([
    { code: "A", checkIn: "7", checkOut: "15", hoursPay: 8 },
    { code: "A1", checkIn: "8", checkOut: "16", hoursPay: 8 },
    { code: "A2", checkIn: "9", checkOut: "17", hoursPay: 8 },
    { code: "A3", checkIn: "10", checkOut: "18", hoursPay: 8 },
    { code: "A4", checkIn: "11", checkOut: "19", hoursPay: 8 },
    { code: "A5", checkIn: "12", checkOut: "20", hoursPay: 8 },
    { code: "A6", checkIn: "13", checkOut: "21", hoursPay: 8 },
    { code: "A7", checkIn: "14", checkOut: "22", hoursPay: 8 },
    { code: "B", checkIn: "15", checkOut: "23", hoursPay: 8 },
    { code: "B1", checkIn: "16", checkOut: "0", hoursPay: 8 },
    { code: "B2", checkIn: "17", checkOut: "1", hoursPay: 8 },
    { code: "B3", checkIn: "18", checkOut: "2", hoursPay: 8 },
    { code: "B4", checkIn: "19", checkOut: "3", hoursPay: 8 },
    { code: "B5", checkIn: "20", checkOut: "4", hoursPay: 8 },
    { code: "B6", checkIn: "21", checkOut: "5", hoursPay: 8 },
    { code: "B7", checkIn: "22", checkOut: "6", hoursPay: 8 },
    { code: "C", checkIn: "23", checkOut: "7", hoursPay: 8 },
    { code: "C1", checkIn: "0", checkOut: "8", hoursPay: 8 },
    { code: "C2", checkIn: "1", checkOut: "9", hoursPay: 8 },
    { code: "C3", checkIn: "2", checkOut: "10", hoursPay: 8 },
    { code: "C4", checkIn: "3", checkOut: "11", hoursPay: 8 },
    { code: "C5", checkIn: "4", checkOut: "12", hoursPay: 8 },
    { code: "C6", checkIn: "5", checkOut: "13", hoursPay: 8 },
    { code: "C7", checkIn: "6", checkOut: "14", hoursPay: 8 }
  ]);
  const SHIFT_CODE_MAP = SHIFT_CODE_DEFINITIONS.reduce(function (result, item) {
    result[item.code] = item;
    return result;
  }, {});
  const PDF_FIELD_GROUPS = Object.freeze([
    {
      title: "Application",
      fields: [
        { key: "applicationType", label: "Application type", type: "choice", options: ["New", "Renewal", "Amendment", "Termination"] },
        { key: "formNo", label: "NO.", type: "text" },
        { key: "passEffectiveDate", label: "Pass Effective Date", type: "date" }
      ]
    },
    {
      title: "Representative",
      fields: [
        { key: "lastName", label: "Last Name", type: "text" },
        { key: "firstName", label: "First Name", type: "text" },
        { key: "commonName", label: "Common Name", type: "text" },
        { key: "chineseName", label: "Chinese Name", type: "text" },
        { key: "dateOfBirth", label: "Date of Birth", type: "date" },
        { key: "sex", label: "Sex", type: "choice", options: ["Male", "Female"] },
        { key: "passportNo", label: "Passport / ID No.", type: "text" },
        { key: "passportExpiry", label: "Passport Expiry", type: "date" },
        { key: "contactNumber", label: "Contact Number", type: "text" },
        { key: "nationality", label: "Nationality", type: "text" },
        { key: "itoGroup", label: "ITO Group", type: "text" },
        { key: "itoAccountNo", label: "ITO Account No.", type: "text" },
        { key: "familyEmployment", label: "Family member under Hoiana employment?", type: "choice", options: ["YES", "NO"] }
      ]
    },
    {
      title: "Signatures",
      fields: [
        { key: "representativeFullName", label: "Authorized Representative Name", type: "text" },
        { key: "representativeDate", label: "Representative Date", type: "date" },
        { key: "authorizerName", label: "ITO Authorizer Name", type: "text" },
        { key: "authorizerDate", label: "Authorizer Date", type: "date" }
      ]
    },
    {
      title: "Authorization",
      fields: [
        { key: "authorizedBy", label: "I, hereby authorized", type: "text" },
        { key: "authorizedItoGroup", label: "International Travel Operator Group", type: "text" },
        { key: "categoryA", label: "Category A", type: "checkbox" },
        { key: "categoryB", label: "Category B", type: "checkbox" },
        { key: "categoryC", label: "Category C", type: "checkbox" },
        { key: "categoryD", label: "Category D", type: "checkbox" },
        { key: "categoryE", label: "Category E", type: "checkbox" }
      ]
    },
    {
      title: "Office Use",
      fields: [
        { key: "approvedBy", label: "Approved by", type: "text" },
        { key: "approvedPosition", label: "Approved Position", type: "text" },
        { key: "approvedDate", label: "Approved Date", type: "date" },
        { key: "preparedBy", label: "Prepared by", type: "text" },
        { key: "preparedPosition", label: "Prepared Position", type: "text" },
        { key: "preparedDate", label: "Prepared Date", type: "date" },
        { key: "receivedBy", label: "Received by", type: "text" },
        { key: "receivedDesignation", label: "Received Designation", type: "text" },
        { key: "receivedDate", label: "Received Date", type: "date" }
      ]
    }
  ]);
  const PDF_PREVIEW_FIELDS = Object.freeze([
    { key: "formNo", page: 1, x: 84, y: 14.1, w: 11, h: 1.8 },
    { key: "passEffectiveDate", page: 1, x: 82, y: 16.9, w: 13, h: 1.8 },
    { key: "applicationType", value: "New", page: 1, x: 16.95, y: 21.6, w: 1.15, h: 1.15, mark: true },
    { key: "applicationType", value: "Renewal", page: 1, x: 32.15, y: 21.6, w: 1.15, h: 1.15, mark: true },
    { key: "applicationType", value: "Amendment", page: 1, x: 49.4, y: 21.6, w: 1.15, h: 1.15, mark: true },
    { key: "applicationType", value: "Termination", page: 1, x: 67.9, y: 21.6, w: 1.15, h: 1.15, mark: true },
    { key: "lastName", page: 1, x: 23, y: 24.4, w: 25, h: 2.2 },
    { key: "firstName", page: 1, x: 62, y: 24.4, w: 27, h: 2.2 },
    { key: "commonName", page: 1, x: 24, y: 26.7, w: 24, h: 2.2 },
    { key: "chineseName", page: 1, x: 63, y: 26.7, w: 26, h: 2.2 },
    { key: "dateOfBirth", page: 1, x: 23, y: 28.9, w: 18, h: 2.2 },
    { key: "sex", value: "Male", page: 1, x: 61.65, y: 30.65, w: 1.15, h: 1.15, mark: true },
    { key: "sex", value: "Female", page: 1, x: 73.45, y: 30.65, w: 1.15, h: 1.15, mark: true },
    { key: "passportNo", page: 1, x: 28.5, y: 33, w: 20, h: 2.2 },
    { key: "passportExpiry", page: 1, x: 66, y: 33, w: 22, h: 2.2 },
    { key: "contactNumber", page: 1, x: 25, y: 35.3, w: 24, h: 2.2 },
    { key: "nationality", page: 1, x: 62, y: 35.3, w: 27, h: 2.2 },
    { key: "itoGroup", page: 1, x: 38, y: 38.1, w: 50, h: 2.2 },
    { key: "itoAccountNo", page: 1, x: 43, y: 40.3, w: 45, h: 2.2 },
    { key: "familyEmployment", value: "YES", page: 1, x: 73.35, y: 42.7, w: 1.15, h: 1.15, mark: true },
    { key: "familyEmployment", value: "NO", page: 1, x: 80.35, y: 42.7, w: 1.15, h: 1.15, mark: true },
    { key: "representativeFullName", page: 1, x: 10, y: 58.5, w: 36, h: 2.2 },
    { key: "representativeDate", page: 1, x: 78, y: 58.5, w: 15, h: 2.2 },
    { key: "authorizedBy", page: 1, x: 13, y: 65.8, w: 34, h: 2.2 },
    { key: "authorizedItoGroup", page: 1, x: 11, y: 69.9, w: 36, h: 2.2 },
    { key: "categoryA", page: 1, x: 14.8, y: 78.9, w: 2.2, h: 2.2, mark: true },
    { key: "categoryB", page: 1, x: 14.8, y: 82.8, w: 2.2, h: 2.2, mark: true },
    { key: "categoryC", page: 1, x: 14.8, y: 86.6, w: 2.2, h: 2.2, mark: true },
    { key: "categoryD", page: 1, x: 14.8, y: 89.8, w: 2.2, h: 2.2, mark: true },
    { key: "categoryE", page: 1, x: 14.8, y: 93.6, w: 2.2, h: 2.2, mark: true },
    { key: "authorizerName", page: 2, x: 10, y: 42.9, w: 36, h: 2.2 },
    { key: "authorizerDate", page: 2, x: 78, y: 42.9, w: 16, h: 2.2 },
    { key: "approvedBy", page: 2, x: 10, y: 61.7, w: 36, h: 2.2 },
    { key: "approvedPosition", page: 2, x: 52, y: 61.7, w: 18, h: 2.2 },
    { key: "approvedDate", page: 2, x: 78, y: 61.7, w: 16, h: 2.2 },
    { key: "preparedBy", page: 2, x: 10, y: 55.8, w: 36, h: 2.2 },
    { key: "preparedPosition", page: 2, x: 52, y: 55.8, w: 18, h: 2.2 },
    { key: "preparedDate", page: 2, x: 78, y: 55.8, w: 16, h: 2.2 },
    { key: "receivedBy", page: 2, x: 10, y: 73.9, w: 36, h: 2.2 },
    { key: "receivedDesignation", page: 2, x: 52, y: 73.9, w: 18, h: 2.2 },
    { key: "receivedDate", page: 2, x: 78, y: 73.9, w: 16, h: 2.2 }
  ]);

  const homeMenu = document.getElementById("homeMenu");
  const homeTopActions = document.getElementById("homeTopActions");
  const profileName = document.getElementById("dashboardProfileName");
  const profileRole = document.getElementById("dashboardProfileRole");
  const avatarButton = document.getElementById("dashboardAvatarButton");
  const avatarImage = document.getElementById("dashboardAvatarImage");
  const avatarInput = document.getElementById("dashboardAvatarInput");
  const logoutButton = document.getElementById("dashboardLogoutButton");
  const chatEyebrow = document.getElementById("dashboardChatEyebrow");
  const chatTitle = document.getElementById("dashboardChatTitle");
  const chatBadge = document.getElementById("dashboardChatBadge");
  const chatBody = document.getElementById("dashboardChatBody");
  const detailEyebrow = document.getElementById("dashboardDetailEyebrow");
  const detailTitle = document.getElementById("dashboardDetailTitle");
  const detailBody = document.getElementById("dashboardDetailBody");

  if (
    !i18n ||
    !authStore ||
    !homeMenu ||
    !homeTopActions ||
    !chatBody ||
    !detailBody ||
    !chatEyebrow ||
    !chatTitle ||
    !chatBadge
  ) {
    return;
  }

  const currentAccount = authStore.getCurrentAccount();

  if (!currentAccount) {
    window.location.replace(REDIRECT_TO_LOGIN);
    return;
  }

  const uiState = {
    localeMenuOpen: false,
    activeTab: getStoredActiveTab(currentAccount),
    employeeDepartmentId: "",
    scheduleMonthKey: "",
    accountFormOpen: false,
    accountFormMode: "create",
    editingAccountUsername: "",
    accountFeedback: { text: "", type: "" },
    salaryMonthlyInput: "",
    salaryShiftCode: "B",
    salaryShiftDefinitions: getStoredSalaryShiftDefinitions(),
    salaryShiftDraft: [],
    salaryEditing: false,
    salaryEditFeedback: "",
    salaryResult: null,
    salaryFeedback: "",
    salaryTableMonthKey: defaultSalaryTableMonthKey(),
    pdfZoom: 1.25,
    pdfValues: Object.create(null)
  };
  let pdfDocumentPromise = null;
  let pdfRenderToken = 0;

  const customText = {
    "zh-Hant": {
      detailEyebrow: "LIVE PANEL",
      chatEyebrow: "MID PANEL",
      help: "說明",
      logout: "退出登录",
      roleAdmin: "最高權限帳號",
      roleViewer: "一般帳號",
      roleOwner: "Owner / Chi Chi 主人",
      readOnly: "唯讀",
      editable: "可編輯",
      allDepartments: "全部部門",
      selectedDepartments: "指定部門",
      menuEmployees: "員工",
      menuSchedule: "班表",
      menuAttendance: "出勤",
      menuInfo: "弈鼎資料",
      menuAccounts: "管理帳號",
      menuChiChi: "Chi Chi",
      employeesTitle: "員工總覽",
      employeesHintAdmin: "完整 Airtable 匯入資料會從舊員工模組同步顯示，這裡先做總覽與捷徑。",
      employeesHintViewer: "此帳號只會看到被授權的部門與員工。",
      employeesDepartment: "部門",
      employeesEmpty: "這個權限範圍目前沒有可顯示的員工。",
      employeesStatActive: "在職員工",
      employeesStatRetired: "離職人員",
      employeesStatDepartments: "可見部門",
      employeesStatSelected: "當前部門",
      employeesOpen: "打開完整員工模組",
      scheduleTitle: "班表總覽",
      scheduleHintAdmin: "完整排班邏輯仍維持舊模組，這裡只做摘要與入口。",
      scheduleHintViewer: "此帳號依權限查看排班，不可跨權限編輯。",
      scheduleMonth: "月份",
      scheduleEmpty: "目前沒有可顯示的班表資料。",
      scheduleRows: "可見列數",
      scheduleAssignments: "已排班格",
      scheduleVisibleDepartments: "可見部門",
      scheduleLiveTitle: "當前在崗",
      scheduleOnShiftNow: "當前上班人數",
      scheduleActiveDepartments: "當前啟用部門",
      scheduleCurrentTime: "現在時間",
      scheduleCurrentDate: "對應日期",
      scheduleLiveHint: "依照目前時間比對 A / B / C 系列班碼，跨夜班也會接續前一天的班別。",
      scheduleLiveEmpty: "現在沒有任何員工處於班內。",
      scheduleDepartmentActive: "在崗部門",
      scheduleAssignedDays: "已排 {count} 天",
      scheduleOpen: "打開完整班表模組",
      attendanceTitle: "出勤區",
      attendanceBody: "保留給之後接打卡、異常與考勤摘要。",
      infoTitle: "弈鼎資料",
      infoBody: "保留給公告、SOP 與內部知識入口。",
      accountsTitle: "帳號管理",
      accountsHint: "YiDing Admin 可以建立、編輯帳號與權限。新增後立刻可登入。",
      accountsAdd: "新增帳號",
      accountsHide: "收起表單",
      accountEdit: "編輯帳號",
      accountSave: "儲存變更",
      accountCreate: "建立帳號",
      accountCancel: "取消",
      accountUsername: "帳號",
      accountPassword: "密碼",
      accountWelcome: "歡迎登入",
      accountPhone: "綁定手機",
      accountEmployeesPermission: "員工模組權限",
      accountSchedulePermission: "班表模組權限",
      accountDepartments: "授權部門",
      accountSuccess: "帳號已建立，現在可以直接登入。",
      accountUpdateSuccess: "帳號已更新。",
      accountDuplicate: "此帳號已存在，請換一個名稱。",
      accountMissing: "必填欄位尚未填完。",
      accountCurrent: "目前登入中",
      accountNoDepartments: "請至少選一個部門，或改回全部部門。",
      accountViewer: "一般帳號",
      accountModuleView: "只看",
      accountModuleEdit: "可編輯",
      currentBinding: "目前綁定",
      phoneEmpty: "尚未綁手機",
      chiChiTitle: "Chi Chi 中控",
      chiChiBadge: "External",
      chiChiPrimary: "Chi Chi 對話入口",
      chiChiBody: "Production 目前只能安全地從這裡打開外部 Chi Chi 視窗；要直接嵌入本站還需要 HTTPS 或反向代理。",
      chiChiOwner: "YiDing Admin 會被視為 owner 身分。",
      chiChiOpen: "在新分頁打開 Chi Chi",
      chiChiWarning: "目前 Chi Chi VPS 只有 HTTP，瀏覽器會阻擋從 HTTPS 首頁直接內嵌。",
      openModule: "打開完整模組",
      permissionScope: "權限範圍",
      permissionAccess: "操作權限",
      permissionDepartments: "部門授權",
      summaryViewer: "只可瀏覽",
      summaryEditor: "可編輯",
      summaryAll: "全部部門",
      summarySelected: "指定部門",
      noDepartmentPermission: "尚未授權任何部門",
      menuTraining: "運營培訓",
      trainingTitle: "運營培訓系統",
      trainingBadge: "Beta",
      trainingBody: "Baccarat 桌台操作模擬訓練。包含完整 Shoe 管理、牌規引擎、第三張牌規則與多角色切換。",
      trainingLaunch: "進入培訓系統",
      trainingDetailTitle: "培訓內容",
      trainingDetailPhase: "Phase 1 · 自由練習",
      trainingDetailEngine: "規則引擎",
      trainingDetailShoe: "8 副牌 Shoe",
      menuITAgent: "IT Agent",
      itAgentTitle: "IT Agent 管理工具",
      itAgentBadge: "Internal",
      itAgentBody: "部署到員工 Windows 電腦後，IT Admin 可遠端截圖、管理流程、傳送通知、控制印表機。",
      itAgentDownload: "下載安裝程式",
      itAgentStep1: "1. 下載 install.bat 到員工電腦",
      itAgentStep2: "2. 以系統管理員執行",
      itAgentStep3: "3. 安裝完成後自動連接 Dashboard",
      itAgentNote: "注意：需要管理員權限。安裝後自動隨 Windows 啟動。"
    },
    vi: {
      detailEyebrow: "LIVE PANEL",
      chatEyebrow: "MID PANEL",
      help: "Hướng dẫn",
      logout: "Đăng xuất",
      roleAdmin: "Tài khoản admin",
      roleViewer: "Tài khoản thường",
      roleOwner: "Owner / chủ Chi Chi",
      readOnly: "Chỉ xem",
      editable: "Chỉnh sửa",
      allDepartments: "Tất cả bộ phận",
      selectedDepartments: "Bộ phận chỉ định",
      menuEmployees: "Nhân viên",
      menuSchedule: "Ca làm",
      menuAttendance: "Chấm công",
      menuInfo: "Thông tin YiDing",
      menuAccounts: "Quản lý tài khoản",
      menuChiChi: "Chi Chi",
      employeesTitle: "Tổng quan nhân viên",
      employeesHintAdmin: "Dữ liệu nhân viên đầy đủ vẫn nằm ở module cũ; khu này chỉ hiện tổng quan và lối tắt.",
      employeesHintViewer: "Tài khoản này chỉ thấy các bộ phận và nhân viên được cấp quyền.",
      employeesDepartment: "Bộ phận",
      employeesEmpty: "Không có nhân viên nào trong phạm vi quyền hiện tại.",
      employeesStatActive: "Nhân viên đang làm",
      employeesStatRetired: "Nhân viên đã nghỉ",
      employeesStatDepartments: "Bộ phận có thể xem",
      employeesStatSelected: "Bộ phận đang chọn",
      employeesOpen: "Mở module nhân viên đầy đủ",
      scheduleTitle: "Tổng quan ca làm",
      scheduleHintAdmin: "Logic xếp ca đầy đủ vẫn ở module cũ; khu này chỉ hiện tóm tắt và lối vào.",
      scheduleHintViewer: "Tài khoản này chỉ xem lịch theo quyền, không được sửa ngoài phạm vi quyền.",
      scheduleMonth: "Tháng",
      scheduleEmpty: "Hiện tại không có dữ liệu ca làm để hiển thị.",
      scheduleRows: "Số dòng có thể xem",
      scheduleAssignments: "Ô đã xếp ca",
      scheduleVisibleDepartments: "Bộ phận có thể xem",
      scheduleLiveTitle: "Nhân sự đang trên ca",
      scheduleOnShiftNow: "Đang trên ca",
      scheduleActiveDepartments: "Bộ phận đang hoạt động",
      scheduleCurrentTime: "Thời điểm hiện tại",
      scheduleCurrentDate: "Ngày đối chiếu",
      scheduleLiveHint: "Tự đối chiếu theo giờ hiện tại với các mã ca A / B / C và cả các ca qua đêm.",
      scheduleLiveEmpty: "Hiện tại không có nhân viên nào đang ở trên ca.",
      scheduleDepartmentActive: "Bộ phận đang trên ca",
      scheduleAssignedDays: "Đã xếp {count} ngày",
      scheduleOpen: "Mở module ca làm đầy đủ",
      attendanceTitle: "Khu chấm công",
      attendanceBody: "Để dành cho phần kết nối chấm công, bất thường và tổng hợp sau này.",
      infoTitle: "Thông tin YiDing",
      infoBody: "Để dành cho thông báo, SOP và cổng vào tri thức nội bộ.",
      accountsTitle: "Quản lý tài khoản",
      accountsHint: "YiDing Admin có thể tạo, sửa tài khoản và quyền truy cập. Tạo xong đăng nhập được ngay.",
      accountsAdd: "Thêm tài khoản",
      accountsHide: "Ẩn form",
      accountEdit: "Sửa tài khoản",
      accountSave: "Lưu thay đổi",
      accountCreate: "Tạo tài khoản",
      accountCancel: "Hủy",
      accountUsername: "Tài khoản",
      accountPassword: "Mật khẩu",
      accountWelcome: "Lời chào đăng nhập",
      accountPhone: "Số điện thoại liên kết",
      accountEmployeesPermission: "Quyền module nhân viên",
      accountSchedulePermission: "Quyền module ca làm",
      accountDepartments: "Bộ phận được cấp quyền",
      accountSuccess: "Đã tạo tài khoản, hiện có thể đăng nhập ngay.",
      accountUpdateSuccess: "Đã cập nhật tài khoản.",
      accountDuplicate: "Tài khoản này đã tồn tại, hãy đổi tên khác.",
      accountMissing: "Vẫn còn trường bắt buộc chưa điền.",
      accountCurrent: "Tài khoản đang đăng nhập",
      accountNoDepartments: "Hãy chọn ít nhất 1 bộ phận, hoặc đổi về tất cả bộ phận.",
      accountViewer: "Tài khoản thường",
      accountModuleView: "Chỉ xem",
      accountModuleEdit: "Được sửa",
      currentBinding: "Đang liên kết",
      phoneEmpty: "Chưa liên kết số điện thoại",
      chiChiTitle: "Trung tâm Chi Chi",
      chiChiBadge: "External",
      chiChiPrimary: "Lối vào đối thoại Chi Chi",
      chiChiBody: "Bản production hiện chỉ mở an toàn cửa sổ Chi Chi bên ngoài từ đây; muốn nhúng trực tiếp vào trang này thì vẫn cần HTTPS hoặc reverse proxy.",
      chiChiOwner: "YiDing Admin sẽ được xem như owner.",
      chiChiOpen: "Mở Chi Chi trong tab mới",
      chiChiWarning: "VPS Chi Chi hiện chỉ có HTTP, trình duyệt sẽ chặn việc nhúng trực tiếp từ trang HTTPS.",
      openModule: "Mở module đầy đủ",
      permissionScope: "Phạm vi quyền",
      permissionAccess: "Mức thao tác",
      permissionDepartments: "Bộ phận được cấp quyền",
      summaryViewer: "Chỉ xem",
      summaryEditor: "Được sửa",
      summaryAll: "Tất cả bộ phận",
      summarySelected: "Bộ phận chỉ định",
      noDepartmentPermission: "Chưa được cấp quyền bộ phận nào",
      menuTraining: "Đào tạo vận hành",
      trainingTitle: "Hệ thống đào tạo vận hành",
      trainingBadge: "Beta",
      trainingBody: "Mô phỏng bàn Baccarat với quản lý Shoe đầy đủ, rule engine và tính toán kết quả theo luật thật.",
      trainingLaunch: "Vào hệ thống đào tạo",
      trainingDetailTitle: "Nội dung đào tạo",
      trainingDetailPhase: "Phase 1 · Luyện tập tự do",
      trainingDetailEngine: "Rule engine",
      trainingDetailShoe: "Shoe 8 bộ bài",
      menuITAgent: "IT Agent",
      itAgentTitle: "Công cụ quản lý IT Agent",
      itAgentBadge: "Internal",
      itAgentBody: "Cài lên máy Windows của nhân viên để IT Admin có thể chụp màn hình, quản lý tiến trình, gửi thông báo và điều khiển máy in từ xa.",
      itAgentDownload: "Tải bộ cài đặt",
      itAgentStep1: "1. Tải install.bat về máy nhân viên",
      itAgentStep2: "2. Chạy với quyền Administrator",
      itAgentStep3: "3. Sau khi cài xong, máy tự kết nối Dashboard",
      itAgentNote: "Lưu ý: Cần quyền Admin. Agent tự khởi động cùng Windows."
    },
    en: {
      detailEyebrow: "LIVE PANEL",
      chatEyebrow: "MID PANEL",
      help: "Help",
      logout: "Log out",
      roleAdmin: "Admin account",
      roleViewer: "Standard account",
      roleOwner: "Owner / Chi Chi owner",
      readOnly: "Read only",
      editable: "Editable",
      allDepartments: "All departments",
      selectedDepartments: "Selected departments",
      menuEmployees: "Employees",
      menuSchedule: "Schedule",
      menuAttendance: "Attendance",
      menuInfo: "YiDing Info",
      menuAccounts: "Accounts",
      menuChiChi: "Chi Chi",
      employeesTitle: "Employee Overview",
      employeesHintAdmin: "The full Airtable-import employee data still lives in the legacy module; this area is currently a summary and shortcut layer.",
      employeesHintViewer: "This account only sees the departments and employees it is authorized to access.",
      employeesDepartment: "Department",
      employeesEmpty: "There are no employees available in the current permission scope.",
      employeesStatActive: "Active Employees",
      employeesStatRetired: "Retired Employees",
      employeesStatDepartments: "Visible Departments",
      employeesStatSelected: "Selected Department",
      employeesOpen: "Open Full Employee Module",
      scheduleTitle: "Schedule Overview",
      scheduleHintAdmin: "The full scheduling workflow still lives in the legacy module; this area currently provides a summary and shortcut.",
      scheduleHintViewer: "This account can only view schedules within its permission scope and cannot edit outside it.",
      scheduleMonth: "Month",
      scheduleEmpty: "There is no schedule data available to display right now.",
      scheduleRows: "Visible Rows",
      scheduleAssignments: "Assigned Cells",
      scheduleVisibleDepartments: "Visible Departments",
      scheduleLiveTitle: "Currently On Shift",
      scheduleOnShiftNow: "On Shift Now",
      scheduleActiveDepartments: "Active Departments",
      scheduleCurrentTime: "Current Time",
      scheduleCurrentDate: "Matched Date",
      scheduleLiveHint: "Resolved against the current time with A / B / C shift codes, including overnight carryovers.",
      scheduleLiveEmpty: "No employees are currently on shift.",
      scheduleDepartmentActive: "Departments On Shift",
      scheduleAssignedDays: "Assigned {count} days",
      scheduleOpen: "Open Full Schedule Module",
      attendanceTitle: "Attendance Zone",
      attendanceBody: "Reserved for future clock-in, exception, and attendance summary integration.",
      infoTitle: "YiDing Info",
      infoBody: "Reserved for announcements, SOPs, and internal knowledge entry points.",
      accountsTitle: "Account Management",
      accountsHint: "YiDing Admin can create and edit accounts and permissions here. New accounts can log in immediately.",
      accountsAdd: "Add Account",
      accountsHide: "Hide Form",
      accountEdit: "Edit Account",
      accountSave: "Save Changes",
      accountCreate: "Create Account",
      accountCancel: "Cancel",
      accountUsername: "Account",
      accountPassword: "Password",
      accountWelcome: "Welcome Message",
      accountPhone: "Bound Phone",
      accountEmployeesPermission: "Employee Module Permission",
      accountSchedulePermission: "Schedule Module Permission",
      accountDepartments: "Authorized Departments",
      accountSuccess: "The account has been created and can log in immediately.",
      accountUpdateSuccess: "The account has been updated.",
      accountDuplicate: "That account already exists. Please choose another name.",
      accountMissing: "Some required fields are still empty.",
      accountCurrent: "Currently signed in",
      accountNoDepartments: "Select at least one department, or switch back to all departments.",
      accountViewer: "Standard account",
      accountModuleView: "View only",
      accountModuleEdit: "Can edit",
      currentBinding: "Current binding",
      phoneEmpty: "No phone linked yet",
      chiChiTitle: "Chi Chi Control",
      chiChiBadge: "External",
      chiChiPrimary: "Chi Chi conversation entry",
      chiChiBody: "Production can currently open the external Chi Chi window safely from here; embedding it directly still needs HTTPS or a reverse proxy.",
      chiChiOwner: "YiDing Admin is treated as the owner role.",
      chiChiOpen: "Open Chi Chi in a new tab",
      chiChiWarning: "The Chi Chi VPS currently only serves HTTP, so browsers block direct embedding from an HTTPS homepage.",
      openModule: "Open Full Module",
      permissionScope: "Permission Scope",
      permissionAccess: "Access Level",
      permissionDepartments: "Authorized Departments",
      summaryViewer: "View only",
      summaryEditor: "Can edit",
      summaryAll: "All departments",
      summarySelected: "Selected departments",
      noDepartmentPermission: "No departments have been authorized yet",
      menuTraining: "Operation Training",
      trainingTitle: "Operation Training System",
      trainingBadge: "Beta",
      trainingBody: "Baccarat table simulation with full shoe management, rule engine and third-card rules.",
      trainingLaunch: "Launch Training",
      trainingDetailTitle: "Training Content",
      trainingDetailPhase: "Phase 1 · Free Practice",
      trainingDetailEngine: "Rule engine",
      trainingDetailShoe: "8-deck shoe",
      menuITAgent: "IT Agent",
      itAgentTitle: "IT Agent Management",
      itAgentBadge: "Internal",
      itAgentBody: "Deploy to employee Windows machines so IT Admin can remotely take screenshots, manage processes, send notifications, and control printers.",
      itAgentDownload: "Download Installer",
      itAgentStep1: "1. Download install.bat to the employee machine",
      itAgentStep2: "2. Run as Administrator",
      itAgentStep3: "3. Agent connects to Dashboard automatically",
      itAgentNote: "Note: Administrator rights required. Agent auto-starts with Windows."
    }
  };

  Object.assign(customText["zh-Hant"], {
    menuPdf: "Làm file pdf",
    pdfTitle: "Làm file pdf",
    pdfBadge: "Draft",
    pdfBody: "Khu chuẩn bị tạo và xử lý file PDF. Bố cục hiện tại để sẵn vùng làm việc lớn ở giữa.",
    pdfDropTitle: "Vùng làm việc PDF",
    pdfDropHint: "Sau này có thể thêm kéo thả file, xem trước trang, ghép file hoặc xuất PDF tại đây.",
    pdfSideTitle: "Công cụ PDF",
    pdfSideHint: "Panel bên phải để đặt tuỳ chọn, lịch sử và trạng thái xử lý.",
    pdfToolUpload: "Tải file",
    pdfToolPreview: "Xem trước",
    pdfToolExport: "Xuất PDF",
    pdfStatusReady: "Sẵn sàng",
    menuSalary: "Tính lương",
    salaryTitle: "Tính lương",
    salaryBadge: "Auto",
    salaryBody: "Nhập lương tháng và ca làm, hệ thống tự tính lương giờ và phụ cấp ca đêm theo tháng hiện tại.",
    salaryMonthlyLabel: "Lương tháng",
    salaryShiftLabel: "Ca làm",
    salaryHourly: "Lương giờ",
    salaryNightHours: "Số giờ ca đêm",
    salaryAllowance: "Tiền bù ca đêm",
    salaryWorkingDays: "Ngày làm",
    salaryMonthDays: "Số ngày trong tháng",
    salaryFormula: "Công thức",
    salaryFormulaText: "Lương giờ = lương tháng / ((số ngày trong tháng - 4 ngày off) * 8 giờ). Tiền bù ca đêm = số giờ ca đêm * lương giờ * 30%.",
    salaryMissing: "Hãy nhập lương tháng hợp lệ lớn hơn 0.",
    salaryPreviewTitle: "Quy tắc đang áp dụng",
    salaryShiftWindow: "Giờ ca",
    salaryNightWindow: "Ca đêm 22:00 - 06:00",
    salaryTestHint: "Ví dụ: 20.000.000 + ca B có 1 giờ đêm từ 22:00 đến 23:00.",
    salaryEdit: "Edit",
    salarySave: "Save",
    salaryCancel: "Hủy",
    salaryCode: "Mã ca",
    salaryStart: "Bắt đầu",
    salaryEnd: "Kết thúc",
    salaryEditTitle: "Sửa quy ước ca",
    salaryEditInvalid: "Mã ca và giờ phải hợp lệ, không được trùng mã.",
    salaryEditSaved: "Đã lưu quy ước ca."
  });
  Object.assign(customText.vi, {
    menuPdf: "Làm file pdf",
    pdfTitle: "Làm file pdf",
    pdfBadge: "Draft",
    pdfBody: "Khu chuẩn bị tạo và xử lý file PDF. Bố cục hiện tại để sẵn vùng làm việc lớn ở giữa.",
    pdfDropTitle: "Vùng làm việc PDF",
    pdfDropHint: "Sau này có thể thêm kéo thả file, xem trước trang, ghép file hoặc xuất PDF tại đây.",
    pdfSideTitle: "Công cụ PDF",
    pdfSideHint: "Panel bên phải để đặt tuỳ chọn, lịch sử và trạng thái xử lý.",
    pdfToolUpload: "Tải file",
    pdfToolPreview: "Xem trước",
    pdfToolExport: "Xuất PDF",
    pdfStatusReady: "Sẵn sàng",
    menuSalary: "Tính lương",
    salaryTitle: "Tính lương",
    salaryBadge: "Auto",
    salaryBody: "Nhập lương tháng và ca làm, hệ thống tự tính lương giờ và phụ cấp ca đêm theo tháng hiện tại.",
    salaryMonthlyLabel: "Lương tháng",
    salaryShiftLabel: "Ca làm",
    salaryHourly: "Lương giờ",
    salaryNightHours: "Số giờ ca đêm",
    salaryAllowance: "Tiền bù ca đêm",
    salaryWorkingDays: "Ngày làm",
    salaryMonthDays: "Số ngày trong tháng",
    salaryFormula: "Công thức",
    salaryFormulaText: "Lương giờ = lương tháng / ((số ngày trong tháng - 4 ngày off) * 8 giờ). Tiền bù ca đêm = số giờ ca đêm * lương giờ * 30%.",
    salaryMissing: "Hãy nhập lương tháng hợp lệ lớn hơn 0.",
    salaryPreviewTitle: "Quy tắc đang áp dụng",
    salaryShiftWindow: "Giờ ca",
    salaryNightWindow: "Ca đêm 22:00 - 06:00",
    salaryTestHint: "Ví dụ: 20.000.000 + ca B có 1 giờ đêm từ 22:00 đến 23:00.",
    salaryEdit: "Edit",
    salarySave: "Save",
    salaryCancel: "Hủy",
    salaryCode: "Mã ca",
    salaryStart: "Bắt đầu",
    salaryEnd: "Kết thúc",
    salaryEditTitle: "Sửa quy ước ca",
    salaryEditInvalid: "Mã ca và giờ phải hợp lệ, không được trùng mã.",
    salaryEditSaved: "Đã lưu quy ước ca."
  });
  Object.assign(customText.en, {
    menuPdf: "Make PDF",
    pdfTitle: "Make PDF",
    pdfBadge: "Draft",
    pdfBody: "A workspace prepared for creating and processing PDF files. The current layout reserves a large work panel in the middle.",
    pdfDropTitle: "PDF workspace",
    pdfDropHint: "File upload, page preview, merge tools, and export actions can be added here next.",
    pdfSideTitle: "PDF tools",
    pdfSideHint: "The right panel is reserved for options, history, and processing status.",
    pdfToolUpload: "Upload file",
    pdfToolPreview: "Preview",
    pdfToolExport: "Export PDF",
    pdfStatusReady: "Ready",
    menuSalary: "Payroll",
    salaryTitle: "Payroll Calculator",
    salaryBadge: "Auto",
    salaryBody: "Enter monthly salary and shift code. The system calculates hourly pay and night-shift allowance for the current month.",
    salaryMonthlyLabel: "Monthly Salary",
    salaryShiftLabel: "Shift",
    salaryHourly: "Hourly Pay",
    salaryNightHours: "Night Hours",
    salaryAllowance: "Night Shift Offset",
    salaryWorkingDays: "Working Days",
    salaryMonthDays: "Days In Month",
    salaryFormula: "Formula",
    salaryFormulaText: "Hourly pay = monthly salary / ((days in month - 4 off days) * 8 hours). Night shift offset = night hours * hourly pay * 30%.",
    salaryMissing: "Enter a valid monthly salary greater than 0.",
    salaryPreviewTitle: "Active Rules",
    salaryShiftWindow: "Shift Window",
    salaryNightWindow: "Night shift 22:00 - 06:00",
    salaryTestHint: "Example: 20,000,000 + shift B has 1 night hour from 22:00 to 23:00.",
    salaryEdit: "Edit",
    salarySave: "Save",
    salaryCancel: "Cancel",
    salaryCode: "Code",
    salaryStart: "Start",
    salaryEnd: "End",
    salaryEditTitle: "Edit Shift Rules",
    salaryEditInvalid: "Shift codes and times must be valid, with no duplicate codes.",
    salaryEditSaved: "Shift rules saved."
  });
  const menuConfigs = [
    { id: "employees", labelKey: "menuEmployees", icon: "👥", adminOnly: true },
    { id: "schedule", labelKey: "menuSchedule", icon: "🗓", adminOnly: true },
    { id: "operationTraining", labelKey: "menuTraining", icon: "🎯" },
    { id: "pdfMaker", labelKey: "menuPdf", icon: "PDF", adminOnly: true },
    { id: "chiChi", labelKey: "menuChiChi", icon: "💬", adminOnly: true },
    { id: "attendance", labelKey: "menuAttendance", icon: "⏱", adminOnly: true },
    { id: "salary", labelKey: "menuSalary", icon: "₫", adminOnly: true },
    { id: "yidingInfo", labelKey: "menuInfo", icon: "✦", adminOnly: true },
    { id: "accounts", labelKey: "menuAccounts", icon: "🛡", adminOnly: true },
    { id: "itAgent", labelKey: "menuITAgent", icon: "🖥", adminOnly: true }
  ];

  const topActionIcons = [
    { id: "help", icon: "?", tooltipKey: "help" },
    { id: "settings", icon: "⚙", tooltipKey: "common.settings" }
  ];

  renderAll();
  bindEvents();
  startLiveClockTicker();

  i18n.subscribe(function () {
    renderAll();
  });

  let lastLiveScheduleMinute = -1;

  function tickLiveClock() {
    if (uiState.activeTab !== "schedule") {
      return;
    }
    const now = new Date();
    const label = formatClock(now);
    if (chatBadge && chatBadge.textContent !== label) {
      chatBadge.textContent = label;
    }
    document.querySelectorAll('[data-live-clock-value="true"]').forEach(function (node) {
      if (node.textContent !== label) {
        node.textContent = label;
      }
    });
    const currentMinuteKey = now.getFullYear() * 1e8 + (now.getMonth() + 1) * 1e6 + now.getDate() * 1e4 + now.getHours() * 100 + now.getMinutes();
    if (currentMinuteKey !== lastLiveScheduleMinute) {
      lastLiveScheduleMinute = currentMinuteKey;
      renderChatPanel();
    }
  }

  function startLiveClockTicker() {
    tickLiveClock();
    const msToNextSecond = 1000 - (Date.now() % 1000);
    setTimeout(function loop() {
      tickLiveClock();
      setTimeout(loop, 1000 - (Date.now() % 1000));
    }, msToNextSecond);
  }

  function bindEvents() {
    homeMenu.addEventListener("click", function (event) {
      const button = event.target.closest(".dashboard-nav__item");
      if (!button) {
        return;
      }

      const nextTab = button.getAttribute("data-main-menu-id");
      if (!nextTab) {
        return;
      }

      uiState.activeTab = nextTab;
      uiState.accountFeedback = { text: "", type: "" };
      uiState.accountFormOpen = false;
      uiState.accountFormMode = "create";
      uiState.editingAccountUsername = "";
      storeActiveTab(currentAccount, nextTab);
      renderAll();
    });

    homeTopActions.addEventListener("click", function (event) {
      const localeOption = event.target.closest("[data-locale-value]");
      const actionButton = event.target.closest(".dashboard-top-action");

      if (localeOption) {
        event.stopPropagation();
        i18n.setLocale(localeOption.getAttribute("data-locale-value"));
        uiState.localeMenuOpen = false;
        renderTopActions();
        return;
      }

      if (!actionButton) {
        return;
      }

      const actionId = actionButton.getAttribute("data-top-action-id");
      if (actionId === "settings") {
        event.stopPropagation();
        uiState.localeMenuOpen = !uiState.localeMenuOpen;
        renderTopActions();
        return;
      }

      if (actionId === "help") {
        uiState.activeTab = "yidingInfo";
        storeActiveTab(currentAccount, uiState.activeTab);
        renderAll();
      }
    });

    document.addEventListener("click", function (event) {
      if (uiState.localeMenuOpen && !homeTopActions.contains(event.target)) {
        uiState.localeMenuOpen = false;
        renderTopActions();
      }
    });

    avatarButton.addEventListener("click", function () {
      avatarInput.click();
    });

    avatarInput.addEventListener("change", function () {
      const file = avatarInput.files && avatarInput.files[0];
      if (!file) {
        return;
      }

      const reader = new FileReader();
      reader.onload = function () {
        authStore.updateAvatar(currentAccount.username, String(reader.result || ""));
        renderProfile();
        if (uiState.activeTab === "accounts") {
          renderDetailPanel();
        }
      };
      reader.readAsDataURL(file);
      avatarInput.value = "";
    });

    logoutButton.addEventListener("click", function () {
      authStore.clearSession();
      window.location.replace(REDIRECT_TO_LOGIN);
    });

    chatBody.addEventListener("click", function (event) {
      const salaryAction = event.target.closest("[data-salary-action]");
      if (salaryAction) {
        handleSalaryAction(salaryAction);
        return;
      }

      const exportButton = event.target.closest("[data-pdf-export]");
      if (exportButton) {
        exportFilledPdf(exportButton);
        return;
      }

      const zoomButton = event.target.closest("[data-pdf-zoom]");
      if (zoomButton) {
        const direction = zoomButton.getAttribute("data-pdf-zoom");
        const nextZoom = direction === "in"
          ? Math.min(uiState.pdfZoom + 0.1, 2.5)
          : Math.max(uiState.pdfZoom - 0.1, 0.75);
        uiState.pdfZoom = Math.round(nextZoom * 10) / 10;
        const zoomLabel = chatBody.querySelector("[data-pdf-zoom-label]");
        if (zoomLabel) zoomLabel.textContent = Math.round(uiState.pdfZoom * 100) + "%";
        renderPdfDocument();
        return;
      }

      const button = event.target.closest("[data-chat-action='open-external']");
      if (!button) {
        return;
      }

      window.open(CHI_CHI_URL, "_blank", "noopener,noreferrer");
    });

    chatBody.addEventListener("input", function (event) {
      const salaryInput = event.target.closest("[data-salary-field]");
      if (salaryInput) {
        handleSalaryTableInput(salaryInput);
        return;
      }
      const salaryForm = event.target.closest("#dashboardSalaryForm");
      if (salaryForm) {
        updateSalaryFromForm(salaryForm, false);
      }
    });

    chatBody.addEventListener("change", function (event) {
      if (event.target && event.target.id === "salaryMonthSelect") {
        handleSalaryTableMonthChange(event.target.value);
        return;
      }
      const salaryForm = event.target.closest("#dashboardSalaryForm");
      if (salaryForm) {
        updateSalaryFromForm(salaryForm, true);
      }
    });

    chatBody.addEventListener("submit", function (event) {
      const salaryEditForm = event.target.closest("#dashboardSalaryEditForm");
      if (salaryEditForm) {
        event.preventDefault();
        saveSalaryShiftEditForm(salaryEditForm);
        return;
      }

      const salaryForm = event.target.closest("#dashboardSalaryForm");
      if (!salaryForm) {
        return;
      }

      event.preventDefault();
      updateSalaryFromForm(salaryForm, true);
    });

    detailBody.addEventListener("click", function (event) {
      const accountToggle = event.target.closest("[data-account-action='toggle-form']");
      const accountCancel = event.target.closest("[data-account-action='cancel-form']");
      const accountEdit = event.target.closest("[data-account-action='edit-account']");
      const openModuleButton = event.target.closest("[data-open-module]");

      if (openModuleButton) {
        window.location.href = openModuleButton.getAttribute("data-open-module");
        return;
      }

      if (accountToggle) {
        uiState.accountFeedback = { text: "", type: "" };
        uiState.accountFormMode = "create";
        uiState.editingAccountUsername = "";
        uiState.accountFormOpen = !uiState.accountFormOpen;
        renderDetailPanel();
        return;
      }

      if (accountCancel) {
        uiState.accountFeedback = { text: "", type: "" };
        uiState.accountFormOpen = false;
        uiState.accountFormMode = "create";
        uiState.editingAccountUsername = "";
        renderDetailPanel();
        return;
      }

      if (accountEdit) {
        uiState.accountFeedback = { text: "", type: "" };
        uiState.accountFormOpen = true;
        uiState.accountFormMode = "edit";
        uiState.editingAccountUsername = accountEdit.getAttribute("data-account-username") || "";
        renderDetailPanel();
      }
    });

    detailBody.addEventListener("change", function (event) {
      if (event.target.closest("[data-pdf-field]")) {
        handlePdfFieldInput(event.target);
        return;
      }

      if (event.target.id === "dashboardDepartmentFilter") {
        uiState.employeeDepartmentId = event.target.value;
        renderDetailPanel();
      }

      if (event.target.id === "dashboardScheduleMonth") {
        uiState.scheduleMonthKey = event.target.value;
        renderDetailPanel();
      }

      if (event.target.name === "employeesScope" || event.target.name === "scheduleScope") {
        renderDetailPanel();
      }
    });

    detailBody.addEventListener("input", function (event) {
      if (event.target.closest("[data-pdf-field]")) {
        handlePdfFieldInput(event.target);
      }
    });

    detailBody.addEventListener("submit", function (event) {
      const salaryForm = event.target.closest("#dashboardSalaryForm");
      if (salaryForm) {
        event.preventDefault();
        submitSalaryForm(salaryForm);
        return;
      }

      const form = event.target.closest("#dashboardAccountForm");
      if (!form) {
        return;
      }

      event.preventDefault();
      submitAccountForm(form);
    });
  }

  function renderAll() {
    document.title = i18n.t("home.pageTitle");
    document.body.setAttribute("data-dashboard-tab", uiState.activeTab);
    renderProfile();
    renderTopActions();
    renderSidebarMenu();
    renderChatPanel();
    renderDetailPanel();
    if (uiState.activeTab === "pdfMaker") {
      window.requestAnimationFrame(renderPdfDocument);
    }
  }

  function renderProfile() {
    const freshAccount = authStore.getCurrentAccount() || currentAccount;
    profileName.textContent = freshAccount.displayName || freshAccount.username;
    profileRole.textContent = authStore.isAdmin(freshAccount)
      ? t("roleAdmin")
      : (freshAccount.username === authStore.ADMIN_ACCOUNT.username ? t("roleOwner") : t("roleViewer"));
    avatarImage.src = freshAccount.avatarSrc || authStore.DEFAULT_AVATAR_SRC;
    avatarImage.alt = freshAccount.displayName || freshAccount.username;
    logoutButton.textContent = t("logout");
  }

  function renderTopActions() {
    homeTopActions.setAttribute("aria-label", i18n.t("home.topActionsAria"));
    homeTopActions.innerHTML = topActionIcons.map(function (iconConfig) {
      return [
        '<button type="button" id="dashboardTopAction-' + iconConfig.id + '" class="dashboard-top-action" data-top-action-id="' + iconConfig.id + '" aria-label="' + escapeHtml(resolveActionTooltip(iconConfig.tooltipKey)) + '" data-tooltip="' + escapeHtml(resolveActionTooltip(iconConfig.tooltipKey)) + '"',
        iconConfig.id === "settings" ? ' aria-expanded="' + String(uiState.localeMenuOpen) + '"' : "",
        ">",
        '<span class="dashboard-top-action__icon" aria-hidden="true">' + iconConfig.icon + "</span>",
        "</button>"
      ].join("");
    }).join("") + renderLocalePopover();
  }

  function renderLocalePopover() {
    const options = i18n.getLocaleOptions().map(function (option) {
      const activeClass = option.value === i18n.getLocale() ? " is-active" : "";
      return [
        '<button type="button" class="yd-locale-option' + activeClass + '" data-locale-value="' + option.value + '">',
        "<span>" + escapeHtml(option.label) + "</span>",
        '<span class="yd-locale-option__check" aria-hidden="true">●</span>',
        "</button>"
      ].join("");
    }).join("");

    return [
      '<div class="yd-locale-control dashboard-top-actions__locale-control">',
      '<div class="yd-locale-popover"' + (uiState.localeMenuOpen ? "" : " hidden") + ">",
      '<p class="yd-locale-popover__title">' + escapeHtml(i18n.t("common.language")) + "</p>",
      options,
      "</div>",
      "</div>"
    ].join("");
  }

  function renderSidebarMenu() {
    const buttons = menuConfigs.filter(function (item) {
      return !item.adminOnly || authStore.isAdmin(currentAccount);
    });

    if (!buttons.some(function (item) { return item.id === uiState.activeTab; })) {
      uiState.activeTab = authStore.isAdmin(currentAccount) ? "accounts" : "operationTraining";
    }

    homeMenu.setAttribute("aria-label", i18n.t("home.menuAria"));
    homeMenu.innerHTML = buttons.map(function (buttonConfig) {
      const isActive = buttonConfig.id === uiState.activeTab;
      return [
        '<button type="button" id="dashboardMainButton-' + buttonConfig.id + '" class="dashboard-nav__item' + (isActive ? " is-active" : "") + '" data-main-menu-id="' + buttonConfig.id + '">',
        '<span class="dashboard-nav__label">' + escapeHtml(t(buttonConfig.labelKey)) + "</span>",
        '<span class="dashboard-nav__icon" aria-hidden="true">' + buttonConfig.icon + "</span>",
        "</button>"
      ].join("");
    }).join("");
  }

  function renderChatPanel() {
    const freshAccount = authStore.getCurrentAccount() || currentAccount;
    const currentPhone = freshAccount.phoneNumber || "";

    chatEyebrow.textContent = t("chatEyebrow");

    if (uiState.activeTab === "chiChi") {
      chatTitle.textContent = t("chiChiTitle");
      chatBadge.textContent = t("chiChiBadge");
      chatBody.innerHTML = [
        '<div class="dashboard-chat-stack dashboard-chat-stack--chi-chi">',
        '<section class="dashboard-chat-surface">',
        '<div class="dashboard-chat-surface__row">',
        '<span class="dashboard-role-badge">' + escapeHtml(authStore.isAdmin(freshAccount) ? t("roleOwner") : t("roleViewer")) + "</span>",
        '<span class="dashboard-role-badge">' + escapeHtml(t("currentBinding")) + ": " + escapeHtml(currentPhone || t("phoneEmpty")) + "</span>",
        "</div>",
        '<h3 class="dashboard-chat-surface__title">' + escapeHtml(t("chiChiPrimary")) + "</h3>",
        '<p class="dashboard-chat-surface__body">' + escapeHtml(t("chiChiBody")) + "</p>",
        '<p class="dashboard-chat-surface__hint">' + escapeHtml(t("chiChiOwner")) + "</p>",
        '<button type="button" class="dashboard-button dashboard-button--accent" data-chat-action="open-external">' + escapeHtml(t("chiChiOpen")) + "</button>",
        '<div class="dashboard-chat-warning">' + escapeHtml(t("chiChiWarning")) + "</div>",
        "</section>",
        '<section class="dashboard-chat-surface dashboard-chat-surface--support">',
        '<div class="dashboard-chat-chip-grid">',
        renderChatChip("Account", freshAccount.username),
        renderChatChip("Phone", currentPhone || t("phoneEmpty")),
        renderChatChip("Mode", authStore.isAdmin(freshAccount) ? ROLE_OWNER : "user"),
        "</div>",
        "</section>",
        "</div>"
      ].join("");
      return;
    }

    if (uiState.activeTab === "employees") {
      const employeesState = getEmployeesState();
      const employees = getAccessibleEmployees(currentAccount, employeesState);
      const activeEmployees = employees.filter(function (employee) {
        return employee && employee.work && employee.work.status === "在職";
      });
      const departmentCount = getAccessibleDepartments(currentAccount, "employees", employeesState, false).length;

      chatTitle.textContent = t("employeesTitle");
      chatBadge.textContent = String(activeEmployees.length);
      chatBody.innerHTML = [
        '<div class="dashboard-chat-stack">',
        '<section class="dashboard-chat-surface">',
        '<h3 class="dashboard-chat-surface__title">' + escapeHtml(t("employeesTitle")) + "</h3>",
        '<div class="dashboard-chat-chip-grid">',
        renderChatChip(t("employeesStatActive"), String(activeEmployees.length)),
        renderChatChip(t("employeesStatRetired"), String(Math.max(employees.length - activeEmployees.length, 0))),
        renderChatChip(t("employeesStatDepartments"), String(departmentCount)),
        "</div>",
        "</section>",
        "</div>"
      ].join("");
      return;
    }

    if (uiState.activeTab === "schedule") {
      const liveSchedule = getCurrentLiveSchedule(currentAccount);

      chatTitle.textContent = t("scheduleLiveTitle");
      chatBadge.textContent = liveSchedule.timeLabel;
      chatBody.innerHTML = [
        '<div class="dashboard-chat-stack">',
        '<section class="dashboard-chat-surface dashboard-chat-surface--live">',
        '<h3 class="dashboard-chat-surface__title">' + escapeHtml(t("scheduleLiveTitle")) + "</h3>",
        '<p class="dashboard-chat-surface__hint">' + escapeHtml(t("scheduleLiveHint")) + "</p>",
        '<div class="dashboard-chat-chip-grid">',
        renderChatChip(t("scheduleOnShiftNow"), String(liveSchedule.activeStaffCount)),
        renderChatChip(t("scheduleActiveDepartments"), String(liveSchedule.departments.length)),
        renderChatChip(t("scheduleCurrentDate"), liveSchedule.dateLabel),
        renderChatChip(t("scheduleCurrentTime"), liveSchedule.timeLabel, { liveClock: true }),
        "</div>",
        "</section>",
        liveSchedule.staff.length
          ? '<section class="dashboard-chat-surface dashboard-chat-surface--cards"><div class="dashboard-shift-cards">' + liveSchedule.staff.map(renderShiftCard).join("") + "</div></section>"
          : '<section class="dashboard-chat-surface"><div class="dashboard-empty">' + escapeHtml(t("scheduleLiveEmpty")) + "</div></section>",
        "</div>"
      ].join("");
      return;
    }

    if (uiState.activeTab === "pdfMaker") {
      chatTitle.textContent = t("pdfTitle");
      chatBadge.textContent = t("pdfBadge");
      chatBody.innerHTML = renderPdfMainPanel();
      return;
    }

    if (uiState.activeTab === "salary") {
      chatTitle.textContent = t("salaryTitle");
      chatBadge.textContent = t("salaryBadge");
      chatBody.innerHTML = renderSalaryPanel();
      return;
    }

    if (uiState.activeTab === "operationTraining") {
      chatTitle.textContent = t("trainingTitle");
      chatBadge.textContent = t("trainingBadge");
      chatBody.innerHTML = [
        '<div class="dashboard-chat-stack">',
        '<section class="dashboard-chat-surface">',
        '<h3 class="dashboard-chat-surface__title">' + escapeHtml(t("trainingTitle")) + "</h3>",
        '<p class="dashboard-chat-surface__body">' + escapeHtml(t("trainingBody")) + "</p>",
        '<div class="dashboard-chat-chip-grid">',
        renderChatChip(t("trainingDetailPhase"), ""),
        renderChatChip(t("trainingDetailEngine"), "Baccarat"),
        renderChatChip(t("trainingDetailShoe"), "416"),
        "</div>",
        '<a href="/home/training/index.html" class="dashboard-button dashboard-button--accent" style="display:inline-block;margin-top:12px;">' + escapeHtml(t("trainingLaunch")) + "</a>",
        "</section>",
        "</div>"
      ].join("");
      return;
    }

    if (uiState.activeTab === "itAgent") {
      chatTitle.textContent = t("itAgentTitle");
      chatBadge.textContent = t("itAgentBadge");
      chatBody.innerHTML = [
        '<div class="dashboard-chat-stack">',
        '<section class="dashboard-chat-surface">',
        '<h3 class="dashboard-chat-surface__title">' + escapeHtml(t("itAgentTitle")) + "</h3>",
        '<p class="dashboard-chat-surface__body">' + escapeHtml(t("itAgentBody")) + "</p>",
        '<div class="dashboard-chat-chip-grid">',
        renderChatChip("Windows", "10 / 11"),
        renderChatChip("Auto-start", "✓"),
        renderChatChip("Silent", "✓"),
        "</div>",
        '<a href="/downloads/install.bat" download class="dashboard-button dashboard-button--accent" style="display:inline-block;margin-top:12px;">' + escapeHtml(t("itAgentDownload")) + "</a>",
        "</section>",
        "</div>"
      ].join("");
      return;
    }

    chatTitle.textContent = i18n.t("home.welcome");
    chatBadge.textContent = "Ready";
    chatBody.innerHTML = [
      '<div class="dashboard-chat-stack">',
      '<section class="dashboard-chat-placeholder">',
      '<div class="dashboard-chat-placeholder__orb"></div>',
      '<div class="dashboard-chat-placeholder__grid"></div>',
      '<div class="dashboard-chat-placeholder__copy">',
      '<h3>' + escapeHtml(t("chiChiTitle")) + "</h3>",
      '<p>' + escapeHtml(t("chiChiBody")) + "</p>",
      "</div>",
      "</section>",
      "</div>"
    ].join("");
  }

  function renderDetailPanel() {
    detailEyebrow.textContent = t("detailEyebrow");

    if (uiState.activeTab === "employees") {
      detailTitle.textContent = t("employeesTitle");
      detailBody.innerHTML = renderEmployeesPanel();
      return;
    }

    if (uiState.activeTab === "schedule") {
      detailTitle.textContent = t("scheduleTitle");
      detailBody.innerHTML = renderSchedulePanel();
      return;
    }

    if (uiState.activeTab === "attendance") {
      detailTitle.textContent = t("attendanceTitle");
      detailBody.innerHTML = renderStaticPanel(t("attendanceTitle"), t("attendanceBody"));
      return;
    }

    if (uiState.activeTab === "yidingInfo") {
      detailTitle.textContent = t("infoTitle");
      detailBody.innerHTML = renderStaticPanel(t("infoTitle"), t("infoBody"));
      return;
    }

    if (uiState.activeTab === "pdfMaker") {
      detailTitle.textContent = t("pdfSideTitle");
      detailBody.innerHTML = renderPdfSidePanel();
      return;
    }

    if (uiState.activeTab === "salary") {
      detailTitle.textContent = t("salaryTitle");
      detailBody.innerHTML = "";
      return;
    }

    if (uiState.activeTab === "operationTraining") {
      detailTitle.textContent = t("trainingDetailTitle");
      detailBody.innerHTML = [
        '<div class="dashboard-detail-stack">',
        '<div class="dashboard-chat-chip-grid">',
        renderChatChip(t("trainingDetailPhase"), "✓"),
        renderChatChip(t("trainingDetailEngine"), "✓"),
        renderChatChip(t("trainingDetailShoe"), "✓"),
        "</div>",
        "</div>"
      ].join("");
      return;
    }

    if (uiState.activeTab === "chiChi") {
      detailTitle.textContent = t("chiChiTitle");
      detailBody.innerHTML = renderChiChiDetailPanel();
      return;
    }

    if (uiState.activeTab === "accounts" && authStore.isAdmin(currentAccount)) {
      detailTitle.textContent = t("accountsTitle");
      detailBody.innerHTML = renderAccountsPanel();
      return;
    }

    if (uiState.activeTab === "itAgent") {
      detailTitle.textContent = t("itAgentTitle");
      detailBody.innerHTML = [
        '<section class="dashboard-surface-card">',
        '<h3 class="dashboard-panel__title">' + escapeHtml(t("itAgentTitle")) + "</h3>",
        '<div class="dashboard-detail-stack" style="margin-top:12px;">',
        '<div class="dashboard-chat-chip-grid">',
        renderChatChip(t("itAgentStep1"), ""),
        renderChatChip(t("itAgentStep2"), ""),
        renderChatChip(t("itAgentStep3"), ""),
        "</div>",
        '<p class="dashboard-readonly-note" style="margin-top:12px;">' + escapeHtml(t("itAgentNote")) + "</p>",
        "</div>",
        "</section>"
      ].join("");
      return;
    }

    uiState.activeTab = authStore.isAdmin(currentAccount) ? "accounts" : "employees";
    renderDetailPanel();
  }

  function renderEmployeesPanel() {
    const employeesState = getEmployeesState();
    const accessibleDepartments = getAccessibleDepartments(currentAccount, "employees", employeesState, false);
    const accessibleEmployees = getAccessibleEmployees(currentAccount, employeesState);
    const activeEmployees = accessibleEmployees.filter(function (employee) {
      return employee && employee.work && employee.work.status === "在職";
    });
    const retiredEmployees = accessibleEmployees.filter(function (employee) {
      return employee && employee.work && employee.work.status === "離職";
    });

    if (!uiState.employeeDepartmentId || !accessibleDepartments.some(function (department) { return department.id === uiState.employeeDepartmentId; })) {
      uiState.employeeDepartmentId = accessibleDepartments[0] ? accessibleDepartments[0].id : "";
    }

    const filteredEmployees = activeEmployees.filter(function (employee) {
      return employee.departmentId === uiState.employeeDepartmentId;
    });

    const currentDepartment = accessibleDepartments.find(function (department) {
      return department.id === uiState.employeeDepartmentId;
    });

    return [
      '<section class="dashboard-surface-stack">',
      '<div class="dashboard-stat-grid">',
      renderStatCard(t("employeesStatActive"), activeEmployees.length),
      renderStatCard(t("employeesStatRetired"), retiredEmployees.length),
      renderStatCard(t("employeesStatDepartments"), accessibleDepartments.length),
      renderStatCard(t("employeesStatSelected"), currentDepartment ? currentDepartment.name : "--"),
      "</div>",
      '<section class="dashboard-surface-card">',
      '<div class="dashboard-panel__meta">',
      '<h3 class="dashboard-panel__title">' + escapeHtml(t("employeesTitle")) + "</h3>",
      authStore.canEditModule(currentAccount, "employees")
        ? '<button type="button" class="dashboard-button dashboard-button--ghost" data-open-module="employees.html">' + escapeHtml(t("employeesOpen")) + "</button>"
        : '<span class="dashboard-role-badge">' + escapeHtml(t("readOnly")) + "</span>",
      "</div>",
      '<p class="dashboard-readonly-note">' + escapeHtml(authStore.isAdmin(currentAccount) ? t("employeesHintAdmin") : t("employeesHintViewer")) + "</p>",
      accessibleDepartments.length
        ? '<label class="dashboard-form-label" for="dashboardDepartmentFilter">' + escapeHtml(t("employeesDepartment")) + '<select id="dashboardDepartmentFilter" class="dashboard-select">' + accessibleDepartments.map(function (department) {
            return '<option value="' + escapeHtml(department.id) + '"' + (department.id === uiState.employeeDepartmentId ? " selected" : "") + ">" + escapeHtml(department.name) + "</option>";
          }).join("") + "</select></label>"
        : "",
      filteredEmployees.length
        ? '<div class="dashboard-list">' + filteredEmployees.slice(0, 16).map(function (employee) {
            const basic = employee.basic || {};
            const work = employee.work || {};
            return [
              '<article class="dashboard-list__item">',
              '<div class="dashboard-list__avatar-wrap"><img class="dashboard-list__avatar" src="' + escapeHtml(employee.avatarSrc || authStore.DEFAULT_AVATAR_SRC) + '" alt="' + escapeHtml(basic.engName || basic.vieName || employee.id) + '"></div>',
              '<div class="dashboard-list__content">',
              '<strong>' + escapeHtml(basic.engName || basic.vieName || employee.id) + "</strong>",
              '<span>' + escapeHtml(basic.vieName || basic.engName || "") + "</span>",
              '<span>' + escapeHtml((work.position || "") + " · " + (basic.ydiId || "")) + "</span>",
              "</div>",
              "</article>"
            ].join("");
          }).join("") + "</div>"
        : '<div class="dashboard-empty">' + escapeHtml(t("employeesEmpty")) + "</div>",
      "</section>",
      "</section>"
    ].join("");
  }

  function renderSchedulePanel() {
    const scheduleState = getScheduleState();
    const monthKeys = Object.keys(scheduleState.months || {}).sort();
    const fallbackKey = monthKeys[0] || buildMonthKey(scheduleState.selectedYear, scheduleState.selectedMonth);

    if (!uiState.scheduleMonthKey || monthKeys.indexOf(uiState.scheduleMonthKey) === -1) {
      uiState.scheduleMonthKey = fallbackKey;
    }

    const monthState = getVisibleMonthState(scheduleState, uiState.scheduleMonthKey, currentAccount);
    const rows = Array.isArray(monthState.rows) ? monthState.rows : [];
    const assignedCells = rows.reduce(function (sum, row) {
      return sum + Object.keys(row && row.shifts ? row.shifts : {}).length;
    }, 0);
    const visibleDepartmentCount = getVisibleScheduleDepartmentCount(rows);

    return [
      '<section class="dashboard-surface-stack">',
      '<div class="dashboard-stat-grid">',
      renderStatCard(t("scheduleRows"), rows.length),
      renderStatCard(t("scheduleAssignments"), assignedCells),
      renderStatCard(t("scheduleMonth"), uiState.scheduleMonthKey || fallbackKey),
      renderStatCard(t("scheduleVisibleDepartments"), visibleDepartmentCount),
      "</div>",
      '<section class="dashboard-surface-card">',
      '<div class="dashboard-panel__meta">',
      '<h3 class="dashboard-panel__title">' + escapeHtml(t("scheduleTitle")) + "</h3>",
      authStore.canEditModule(currentAccount, "schedule")
        ? '<button type="button" class="dashboard-button dashboard-button--ghost" data-open-module="edit/index.html">' + escapeHtml(t("scheduleOpen")) + "</button>"
        : '<span class="dashboard-role-badge">' + escapeHtml(t("readOnly")) + "</span>",
      "</div>",
      '<p class="dashboard-readonly-note">' + escapeHtml(authStore.isAdmin(currentAccount) ? t("scheduleHintAdmin") : t("scheduleHintViewer")) + "</p>",
      '<label class="dashboard-form-label" for="dashboardScheduleMonth">' + escapeHtml(t("scheduleMonth")) + '<select id="dashboardScheduleMonth" class="dashboard-select">' + (monthKeys.length ? monthKeys : [fallbackKey]).map(function (key) {
        return '<option value="' + escapeHtml(key) + '"' + (key === uiState.scheduleMonthKey ? " selected" : "") + ">" + escapeHtml(key) + "</option>";
      }).join("") + "</select></label>",
      rows.length
        ? '<div class="dashboard-schedule-list">' + rows.slice(0, 14).map(function (row) {
            const snapshot = row.employeeSnapshot || {};
            const shifts = row.shifts || {};
            return [
              '<article class="dashboard-schedule-card">',
              '<strong>' + escapeHtml(snapshot.engName || snapshot.vieName || snapshot.ydiId || row.id) + "</strong>",
              '<span>' + escapeHtml((snapshot.department || "") + " · " + (snapshot.position || "")) + "</span>",
              '<span>' + escapeHtml(t("scheduleAssignedDays", { count: Object.keys(shifts).length })) + "</span>",
              "</article>"
            ].join("");
          }).join("") + "</div>"
        : '<div class="dashboard-empty">' + escapeHtml(t("scheduleEmpty")) + "</div>",
      "</section>",
      "</section>"
    ].join("");
  }

  function renderSalaryPanel() {
    const monthKey = uiState.salaryTableMonthKey;
    const monthOptions = buildSalaryMonthOptions();
    const rows = getSalaryTableRows(monthKey);
    const totals = rows.reduce(function (acc, row) {
      const calc = computeSalaryRow(row);
      acc.payTotal += calc.actualPay;
      acc.headcount += 1;
      return acc;
    }, { payTotal: 0, headcount: 0 });

    const headerCells = getSalaryTableColumns().map(function (col) {
      return '<th class="salary-table__th salary-table__th--' + col.key + '">' + escapeHtml(col.label) + "</th>";
    }).join("");

    const bodyRows = rows.map(function (row, index) {
      return renderSalaryRow(row, index);
    }).join("");

    return [
      '<section class="salary-board">',
      '<header class="salary-board__bar">',
      '<label class="salary-board__period"><span>Tháng</span>',
      '<select id="salaryMonthSelect" class="salary-board__select">' + monthOptions.map(function (opt) {
        return '<option value="' + escapeHtml(opt.value) + '"' + (opt.value === monthKey ? " selected" : "") + ">" + escapeHtml(opt.label) + "</option>";
      }).join("") + "</select></label>",
      '<div class="salary-board__totals">',
      '<span class="salary-board__total-chip"><em>Số nhân sự</em><strong>' + String(totals.headcount) + "</strong></span>",
      '<span class="salary-board__total-chip"><em>Tổng thực phát</em><strong>' + escapeHtml(formatVnd(totals.payTotal)) + "</strong></span>",
      "</div>",
      "</header>",
      '<div class="salary-table-scroll">',
      '<table class="salary-table">',
      "<thead><tr>" + headerCells + "</tr></thead>",
      '<tbody id="salaryTableBody">' + (bodyRows || ('<tr><td class="salary-table__empty" colspan="' + getSalaryTableColumns().length + '">Chưa có nhân viên nào trong bảng Ca làm cho tháng ' + escapeHtml(monthKey) + '. Mở "Ca làm" để thêm nhân viên — bảng lương sẽ tự cập nhật.</td></tr>')) + "</tbody>",
      "</table>",
      "</div>",
      "</section>"
    ].join("");
  }

  function renderSalaryRow(row, index) {
    const calc = computeSalaryRow(row);
    return "<tr data-salary-row=\"" + escapeHtml(row.uid) + "\">" + getSalaryTableColumns().map(function (col) {
      const isAuto = col.kind === "auto";
      const isIdentity = col.kind === "identity";
      let value;
      if (isAuto) {
        value = calc[col.key];
      } else {
        value = row[col.key] != null ? row[col.key] : "";
      }
      const display = col.format ? col.format(value, row, calc) : (value === 0 || value ? String(value) : "");
      const cellClass = "salary-table__td salary-table__td--" + col.key + (isAuto ? " salary-table__td--auto" : "") + (isIdentity ? " salary-table__td--identity" : "");
      if (isAuto || isIdentity) {
        return '<td class="' + cellClass + '">' + escapeHtml(display) + "</td>";
      }
      return '<td class="' + cellClass + '"><input class="salary-table__input" type="text" inputmode="' + (col.numeric ? "decimal" : "text") + '" data-salary-field="' + escapeHtml(col.key) + '" data-salary-uid="' + escapeHtml(row.uid) + '" value="' + escapeHtml(display) + '"></td>';
    }).join("") + "</tr>";
  }

  // ─── Salary table (replaces legacy tool) ───────────────────────────────
  function getSalaryStorageKey() { return "yiding_salary_table_v1"; }
  var _SALARY_TABLE_COLUMNS_CACHE = null;
  function getSalaryTableColumns() {
    if (!_SALARY_TABLE_COLUMNS_CACHE) {
      _SALARY_TABLE_COLUMNS_CACHE = buildSalaryTableColumns();
    }
    return _SALARY_TABLE_COLUMNS_CACHE;
  }
  function buildSalaryTableColumns() {
    return [
      { key: "ydiId",         label: "Mã YDI",         kind: "identity" },
      { key: "vieName",       label: "Họ tên",         kind: "identity" },
      { key: "engName",       label: "Tên EN",         kind: "identity" },
      { key: "department",    label: "Bộ phận",        kind: "identity" },
      { key: "monthly",       label: "Lương tháng",    kind: "edit",  numeric: true, format: function (v) { return v ? formatVnd(v) : ""; } },
      { key: "dailySalary",   label: "Lương ngày",     kind: "auto",  format: function (v) { return formatVnd(v); } },
      { key: "hourlySalary",  label: "Lương giờ",      kind: "auto",  format: function (v) { return formatVnd(v); } },
      { key: "nightHourly",   label: "Lương giờ đêm",  kind: "auto",  format: function (v) { return formatVnd(v); } },
      { key: "insurance",     label: "Bảo hiểm",       kind: "edit",  numeric: true, format: function (v) { return v ? formatVnd(v) : ""; } },
      { key: "transfer",      label: "Chuyển khoản",   kind: "edit",  numeric: true, format: function (v) { return v ? formatVnd(v) : ""; } },
      { key: "meal",          label: "Tiền ăn",        kind: "edit",  numeric: true, format: function (v) { return v ? formatVnd(v) : ""; } },
      { key: "deductDays",    label: "Ngày khấu trừ",  kind: "edit",  numeric: true },
      { key: "deductAmount",  label: "Tiền khấu trừ",  kind: "auto",  format: function (v) { return formatVnd(v); } },
      { key: "holidayDays",   label: "Ngày làm lễ",    kind: "edit",  numeric: true },
      { key: "holidayAmount", label: "Tiền làm lễ",    kind: "auto",  format: function (v) { return formatVnd(v); } },
      { key: "overtimeHours", label: "Giờ tăng ca",    kind: "edit",  numeric: true },
      { key: "overtimePay",   label: "Tiền tăng ca",   kind: "auto",  format: function (v) { return formatVnd(v); } },
      { key: "nightHours",    label: "Giờ ca đêm",     kind: "edit",  numeric: true },
      { key: "nightPay",      label: "Tiền ca đêm",    kind: "auto",  format: function (v) { return formatVnd(v); } },
      { key: "otherDeduct",   label: "Khấu trừ khác",  kind: "edit",  numeric: true, format: function (v) { return v ? formatVnd(v) : ""; } },
      { key: "otherBonus",    label: "Bù khác",        kind: "edit",  numeric: true, format: function (v) { return v ? formatVnd(v) : ""; } },
      { key: "actualPay",     label: "Thực phát",      kind: "auto",  format: function (v) { return formatVnd(v); } }
    ];
  }

  function defaultSalaryTableMonthKey() {
    const now = new Date();
    return buildMonthKey(now.getFullYear(), now.getMonth() + 1);
  }

  function getSalaryTableState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(getSalaryStorageKey()) || "null");
      if (parsed && typeof parsed === "object" && parsed.months && typeof parsed.months === "object") {
        return parsed;
      }
    } catch (error) {}
    return { months: {} };
  }

  function saveSalaryTableState(state) {
    try {
      localStorage.setItem(getSalaryStorageKey(), JSON.stringify(state));
    } catch (error) {}
  }

  function buildSalaryMonthOptions() {
    const set = {};
    set[uiState.salaryTableMonthKey] = true;
    set[defaultSalaryTableMonthKey()] = true;
    const scheduleState = getScheduleState();
    Object.keys((scheduleState && scheduleState.months) || {}).forEach(function (k) { set[k] = true; });
    const salaryState = getSalaryTableState();
    Object.keys(salaryState.months || {}).forEach(function (k) { set[k] = true; });
    return Object.keys(set).sort().reverse().map(function (key) {
      return { value: key, label: key };
    });
  }

  function getSalaryEditableFields(salaryMonth, rowKey) {
    const month = salaryMonth && salaryMonth.byRowKey ? salaryMonth.byRowKey : {};
    return month[rowKey] || {};
  }

  function getSalaryTableRows(monthKey) {
    const account = authStore.getCurrentAccount() || currentAccount;
    const monthState = getVisibleMonthState(getScheduleState(), monthKey, account);
    const scheduleRows = (monthState && monthState.rows) || [];
    const salaryState = getSalaryTableState();
    const salaryMonth = salaryState.months && salaryState.months[monthKey];
    return scheduleRows.map(function (row) {
      const snapshot = (row && row.employeeSnapshot) || {};
      const rowKey = String(row.id || row.employeeId || snapshot.ydiId || "");
      const edits = getSalaryEditableFields(salaryMonth, rowKey);
      return {
        uid: rowKey,
        ydiId: snapshot.ydiId || "",
        vieName: snapshot.vieName || "",
        engName: snapshot.engName || "",
        department: snapshot.department || "",
        monthly: edits.monthly != null ? edits.monthly : 0,
        insurance: edits.insurance != null ? edits.insurance : 0,
        transfer: edits.transfer != null ? edits.transfer : 0,
        meal: edits.meal != null ? edits.meal : 0,
        deductDays: edits.deductDays != null ? edits.deductDays : 0,
        holidayDays: edits.holidayDays != null ? edits.holidayDays : 0,
        overtimeHours: edits.overtimeHours != null ? edits.overtimeHours : 0,
        nightHours: edits.nightHours != null ? edits.nightHours : 0,
        otherDeduct: edits.otherDeduct != null ? edits.otherDeduct : 0,
        otherBonus: edits.otherBonus != null ? edits.otherBonus : 0
      };
    });
  }

  function findSalaryRow(monthKey, rowKey) {
    return getSalaryTableRows(monthKey).find(function (r) { return r.uid === rowKey; }) || null;
  }

  function computeSalaryRow(row) {
    const monthly = Number(row.monthly) || 0;
    const dailySalary = monthly / 26;
    const hourlySalary = dailySalary / 8;
    const nightHourly = hourlySalary * 0.3;
    const insurance = Number(row.insurance) || 0;
    const transfer = Number(row.transfer) || 0;
    const meal = Number(row.meal) || 0;
    const deductDays = Number(row.deductDays) || 0;
    const holidayDays = Number(row.holidayDays) || 0;
    const overtimeHours = Number(row.overtimeHours) || 0;
    const nightHours = Number(row.nightHours) || 0;
    const otherDeduct = Number(row.otherDeduct) || 0;
    const otherBonus = Number(row.otherBonus) || 0;
    const deductAmount = -dailySalary * deductDays;
    const holidayAmount = dailySalary * holidayDays * 2;
    const overtimePay = hourlySalary * overtimeHours;
    const nightPay = nightHourly * nightHours;
    const actualPay = monthly + insurance + transfer + meal + deductAmount + holidayAmount + overtimePay + nightPay + otherDeduct + otherBonus;
    return {
      dailySalary: dailySalary,
      hourlySalary: hourlySalary,
      nightHourly: nightHourly,
      deductAmount: deductAmount,
      holidayAmount: holidayAmount,
      overtimePay: overtimePay,
      nightPay: nightPay,
      actualPay: actualPay
    };
  }

  function formatVnd(value) {
    const n = Number(value) || 0;
    const rounded = Math.round(n);
    const sign = rounded < 0 ? "-" : "";
    const abs = String(Math.abs(rounded));
    const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + grouped;
  }

  function parseSalaryNumber(text) {
    if (text == null) { return 0; }
    const cleaned = String(text).replace(/[,\s]/g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  function handleSalaryTableInput(input) {
    const uid = input.getAttribute("data-salary-uid");
    const field = input.getAttribute("data-salary-field");
    if (!uid || !field) { return; }
    const col = getSalaryTableColumns().find(function (c) { return c.key === field; });
    if (!col || col.kind !== "edit") { return; }
    const monthKey = uiState.salaryTableMonthKey;
    const state = getSalaryTableState();
    if (!state.months[monthKey]) { state.months[monthKey] = { byRowKey: {} }; }
    if (!state.months[monthKey].byRowKey) { state.months[monthKey].byRowKey = {}; }
    const bucket = state.months[monthKey].byRowKey;
    if (!bucket[uid]) { bucket[uid] = {}; }
    bucket[uid][field] = col.numeric ? parseSalaryNumber(input.value) : input.value;
    saveSalaryTableState(state);
    refreshSalaryRow(uid);
    refreshSalaryTotals();
  }

  function refreshSalaryRow(uid) {
    const tr = document.querySelector('tr[data-salary-row="' + cssEscape(uid) + '"]');
    if (!tr) { return; }
    const monthKey = uiState.salaryTableMonthKey;
    const rows = getSalaryTableRows(monthKey);
    const row = rows.find(function (r) { return r.uid === uid; });
    if (!row) { return; }
    const calc = computeSalaryRow(row);
    getSalaryTableColumns().forEach(function (col) {
      if (col.kind !== "auto") { return; }
      const td = tr.querySelector(".salary-table__td--" + col.key);
      if (!td) { return; }
      const value = calc[col.key];
      const display = col.format ? col.format(value, row, calc) : String(value);
      td.textContent = display;
    });
  }

  function refreshSalaryTotals() {
    const monthKey = uiState.salaryTableMonthKey;
    const rows = getSalaryTableRows(monthKey);
    const totals = rows.reduce(function (acc, row) {
      acc.payTotal += computeSalaryRow(row).actualPay;
      acc.headcount += 1;
      return acc;
    }, { payTotal: 0, headcount: 0 });
    const chips = document.querySelectorAll(".salary-board__total-chip strong");
    if (chips.length >= 2) {
      chips[0].textContent = String(totals.headcount);
      chips[1].textContent = formatVnd(totals.payTotal);
    }
  }

  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) { return window.CSS.escape(value); }
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function handleSalaryTableMonthChange(value) {
    uiState.salaryTableMonthKey = value;
    renderChatPanel();
  }


  function renderSalaryShiftEditor() {
    const rows = uiState.salaryShiftDraft.length ? uiState.salaryShiftDraft : cloneSalaryShiftDefinitions(getSalaryShiftDefinitions());

    return [
      '<form id="dashboardSalaryEditForm" class="dashboard-salary-editor" autocomplete="off">',
      '<div class="dashboard-salary-editor__head">',
      '<strong>' + escapeHtml(t("salaryEditTitle")) + "</strong>",
      '<div class="dashboard-salary-editor__actions">',
      '<button type="button" class="dashboard-button dashboard-button--ghost" data-salary-action="cancel-edit">' + escapeHtml(t("salaryCancel")) + "</button>",
      '<button type="submit" class="dashboard-button dashboard-button--accent">' + escapeHtml(t("salarySave")) + "</button>",
      "</div>",
      "</div>",
      '<div class="dashboard-salary-editor__grid">',
      '<span>' + escapeHtml(t("salaryCode")) + "</span>",
      '<span>' + escapeHtml(t("salaryStart")) + "</span>",
      '<span>' + escapeHtml(t("salaryEnd")) + "</span>",
      rows.map(function (shift, index) {
        return [
          '<input class="dashboard-salary-editor__input" name="code" data-salary-shift-index="' + index + '" value="' + escapeHtml(shift.code) + '">',
          '<input class="dashboard-salary-editor__input" name="start" data-salary-shift-index="' + index + '" value="' + escapeHtml(shift.start) + '">',
          '<input class="dashboard-salary-editor__input" name="end" data-salary-shift-index="' + index + '" value="' + escapeHtml(shift.end) + '">'
        ].join("");
      }).join(""),
      "</div>",
      '<p class="dashboard-salary-editor__feedback">' + escapeHtml(uiState.salaryEditFeedback || "") + "</p>",
      "</form>"
    ].join("");
  }

  function renderSalaryMetric(key, label, value) {
    return [
      '<div class="dashboard-salary-metric">',
      '<span>' + escapeHtml(label) + "</span>",
      '<strong data-salary-metric="' + escapeHtml(key) + '">' + escapeHtml(value) + "</strong>",
      "</div>"
    ].join("");
  }

  function renderAccountsPanel() {
    const accounts = authStore.getAccounts();
    const departments = getDepartmentCatalog();
    const formValues = getAccountFormValues();
    const feedbackClass = uiState.accountFeedback.type ? " is-" + uiState.accountFeedback.type : "";

    return [
      '<section class="dashboard-surface-stack">',
      '<section class="dashboard-surface-card">',
      '<div class="dashboard-account-toolbar">',
      '<div>',
      '<h3 class="dashboard-panel__title">' + escapeHtml(t("accountsTitle")) + "</h3>",
      '<p class="dashboard-readonly-note">' + escapeHtml(t("accountsHint")) + "</p>",
      "</div>",
      '<button type="button" class="dashboard-button" data-account-action="toggle-form">' + escapeHtml(uiState.accountFormOpen ? t("accountsHide") : t("accountsAdd")) + "</button>",
      "</div>",
      '<p class="dashboard-feedback' + feedbackClass + '">' + escapeHtml(uiState.accountFeedback.text || "") + "</p>",
      renderAccountForm(formValues, departments),
      '<div class="dashboard-account-list">' + accounts.map(function (account) {
        const employeePermission = authStore.getModulePermission(account, "employees");
        const schedulePermission = authStore.getModulePermission(account, "schedule");
        return [
          '<article class="dashboard-account-card">',
          '<div class="dashboard-account-card__top">',
          "<strong>" + escapeHtml(account.username) + "</strong>",
          '<span class="dashboard-role-badge">' + escapeHtml(account.role === "admin" ? t("roleAdmin") : t("accountViewer")) + "</span>",
          "</div>",
          '<div class="dashboard-account-card__meta">',
          "<span>" + escapeHtml(t("accountWelcome") + ": " + (account.welcomeMessage || account.username)) + "</span>",
          "<span>" + escapeHtml(t("accountPhone") + ": " + (account.phoneNumber || t("phoneEmpty"))) + "</span>",
          "<span>" + escapeHtml(t("accountEmployeesPermission") + ": " + describePermission(employeePermission, departments)) + "</span>",
          "<span>" + escapeHtml(t("accountSchedulePermission") + ": " + describePermission(schedulePermission, departments)) + "</span>",
          account.username === currentAccount.username ? '<span>' + escapeHtml(t("accountCurrent")) + "</span>" : "",
          "</div>",
          '<div class="dashboard-account-card__actions"><button type="button" class="dashboard-button dashboard-button--ghost" data-account-action="edit-account" data-account-username="' + escapeHtml(account.username) + '">' + escapeHtml(t("accountEdit")) + "</button></div>",
          "</article>"
        ].join("");
      }).join("") + "</div>",
      "</section>",
      "</section>"
    ].join("");
  }

  function renderChiChiDetailPanel() {
    const freshAccount = authStore.getCurrentAccount() || currentAccount;
    return [
      '<section class="dashboard-surface-card">',
      '<h3 class="dashboard-panel__title">' + escapeHtml(t("chiChiTitle")) + "</h3>",
      '<p class="dashboard-readonly-note">' + escapeHtml(t("chiChiBody")) + "</p>",
      '<div class="dashboard-info-grid">',
      renderInfoCard("Account", freshAccount.username),
      renderInfoCard(t("accountPhone"), freshAccount.phoneNumber || t("phoneEmpty")),
      renderInfoCard("Mode", authStore.isAdmin(freshAccount) ? ROLE_OWNER : "user"),
      "</div>",
      '<button type="button" class="dashboard-button dashboard-button--accent" data-chat-action="open-external">' + escapeHtml(t("chiChiOpen")) + "</button>",
      '<div class="dashboard-empty">' + escapeHtml(t("chiChiWarning")) + "</div>",
      "</section>"
    ].join("");
  }

  function renderPdfMainPanel() {
    return [
      '<div class="dashboard-pdf-workspace">',
      '<section class="dashboard-pdf-main-panel">',
      '<div class="dashboard-pdf-toolbar">',
      '<div><strong>' + escapeHtml(t("pdfDropTitle")) + '</strong><span>' + escapeHtml(t("pdfDropHint")) + '</span></div>',
      '<div class="dashboard-pdf-zoom">',
      '<button type="button" data-pdf-zoom="out" aria-label="Zoom out">-</button>',
      '<span data-pdf-zoom-label>' + Math.round(uiState.pdfZoom * 100) + '%</span>',
      '<button type="button" data-pdf-zoom="in" aria-label="Zoom in">+</button>',
      '</div>',
      '<button type="button" class="dashboard-button dashboard-button--accent dashboard-pdf-export" data-pdf-export>Xuất PDF</button>',
      '</div>',
      '<div class="dashboard-pdf-viewer" id="dashboardPdfViewer" aria-label="' + escapeHtml(t("pdfDropTitle")) + '">',
      '<div class="dashboard-pdf-loading">' + escapeHtml(t("pdfStatusReady")) + '</div>',
      '</div>',
      '</section>',
      '</div>'
    ].join("");
  }

  function renderPdfSidePanel() {
    return [
      '<section class="dashboard-surface-card dashboard-pdf-side-panel">',
      '<div class="dashboard-panel__meta">',
      '<h3 class="dashboard-panel__title">' + escapeHtml(t("pdfSideTitle")) + '</h3>',
      '<span class="dashboard-role-badge">' + escapeHtml(t("pdfStatusReady")) + '</span>',
      '</div>',
      '<p class="dashboard-readonly-note">' + escapeHtml(t("pdfSideHint")) + '</p>',
      '<form class="dashboard-pdf-form" autocomplete="off">' + PDF_FIELD_GROUPS.map(renderPdfFieldGroup).join("") + '</form>',
      '</section>'
    ].join("");
  }

  function renderPdfFieldGroup(group) {
    return [
      '<fieldset class="dashboard-pdf-fieldset">',
      '<legend>' + escapeHtml(group.title) + '</legend>',
      group.fields.map(renderPdfField).join(""),
      '</fieldset>'
    ].join("");
  }

  function renderPdfField(field) {
    const value = getPdfValue(field.key);
    if (field.type === "checkbox") {
      return [
        '<label class="dashboard-pdf-check">',
        '<input type="checkbox" data-pdf-field="' + escapeHtml(field.key) + '"' + (value ? " checked" : "") + '>',
        '<span>' + escapeHtml(field.label) + '</span>',
        '</label>'
      ].join("");
    }

    if (field.type === "choice") {
      return [
        '<label class="dashboard-form-label dashboard-pdf-label">',
        escapeHtml(field.label),
        '<select class="dashboard-select" data-pdf-field="' + escapeHtml(field.key) + '">',
        '<option value=""></option>',
        field.options.map(function (option) {
          return '<option value="' + escapeHtml(option) + '"' + (value === option ? " selected" : "") + '>' + escapeHtml(option) + '</option>';
        }).join(""),
        '</select>',
        '</label>'
      ].join("");
    }

    return [
      '<label class="dashboard-form-label dashboard-pdf-label">',
      escapeHtml(field.label),
      '<input class="dashboard-input" data-pdf-field="' + escapeHtml(field.key) + '" type="text" value="' + escapeHtml(value) + '" placeholder="' + (field.type === "date" ? "DD/MM/YYYY" : "") + '">',
      '</label>'
    ].join("");
  }

  function handlePdfFieldInput(input) {
    const key = input.getAttribute("data-pdf-field");
    if (!key) return;
    uiState.pdfValues[key] = input.type === "checkbox" ? input.checked : input.value;
    updatePdfOverlayValues();
  }

  function getPdfValue(key) {
    return uiState.pdfValues[key] === undefined ? "" : uiState.pdfValues[key];
  }

  async function getPdfDocument() {
    if (!pdfDocumentPromise) {
      pdfDocumentPromise = pdfjsLib.getDocument({ url: PDF_FORM_URL }).promise;
    }
    return pdfDocumentPromise;
  }

  async function renderPdfDocument() {
    const viewer = document.getElementById("dashboardPdfViewer");
    if (!viewer || uiState.activeTab !== "pdfMaker") return;

    const token = ++pdfRenderToken;
    viewer.innerHTML = '<div class="dashboard-pdf-loading">' + escapeHtml(t("pdfStatusReady")) + '</div>';

    try {
      const doc = await getPdfDocument();
      if (token !== pdfRenderToken) return;
      viewer.innerHTML = "";

      for (let pageNo = 1; pageNo <= doc.numPages; pageNo += 1) {
        const page = await doc.getPage(pageNo);
        if (token !== pdfRenderToken) return;

        const viewport = page.getViewport({ scale: uiState.pdfZoom });
        const outputScale = window.devicePixelRatio || 1;
        const pageEl = document.createElement("div");
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        const overlay = document.createElement("div");

        pageEl.className = "dashboard-pdf-page";
        pageEl.style.width = viewport.width + "px";
        pageEl.style.height = viewport.height + "px";
        pageEl.setAttribute("data-pdf-page", String(pageNo));

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = viewport.width + "px";
        canvas.style.height = viewport.height + "px";

        overlay.className = "dashboard-pdf-overlay";
        PDF_PREVIEW_FIELDS.filter(function (field) { return field.page === pageNo; }).forEach(function (field) {
          const item = document.createElement("span");
          item.className = "dashboard-pdf-fill" + (field.mark ? " dashboard-pdf-fill--mark" : "");
          item.setAttribute("data-pdf-preview-field", field.key);
          if (field.value) item.setAttribute("data-pdf-preview-value", field.value);
          item.style.left = field.x + "%";
          item.style.top = field.y + "%";
          item.style.width = field.w + "%";
          item.style.height = field.h + "%";
          overlay.appendChild(item);
        });

        pageEl.appendChild(canvas);
        pageEl.appendChild(overlay);
        viewer.appendChild(pageEl);

        await page.render({
          canvasContext: context,
          viewport: viewport,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null
        }).promise;
      }

      updatePdfOverlayValues();
    } catch (error) {
      viewer.innerHTML = '<div class="dashboard-empty">' + escapeHtml(String(error && error.message || error)) + '</div>';
    }
  }

  function updatePdfOverlayValues() {
    document.querySelectorAll("[data-pdf-preview-field]").forEach(function (item) {
      const key = item.getAttribute("data-pdf-preview-field");
      const expected = item.getAttribute("data-pdf-preview-value");
      const value = getPdfValue(key);

      if (item.classList.contains("dashboard-pdf-fill--mark")) {
        const shouldShow = expected ? value === expected : Boolean(value);
        item.classList.toggle("is-visible", shouldShow);
        item.textContent = "";
        return;
      }

      item.textContent = formatPdfPreviewValue(value);
    });
  }

  function formatPdfPreviewValue(value) {
    if (value === true) return "✓";
    if (!value) return "";
    return String(value);
  }

  async function exportFilledPdf(button) {
    const originalLabel = button ? button.textContent : "";
    if (button) {
      button.disabled = true;
      button.textContent = "Đang xuất...";
    }

    try {
      const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
      const response = await fetch(PDF_FORM_URL);
      const bytes = await response.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();
      const ink = rgb(0.02, 0.05, 0.1);
      const markInk = rgb(0.02, 0.48, 0.18);

      PDF_PREVIEW_FIELDS.forEach(function (field) {
        const page = pages[field.page - 1];
        if (!page) return;

        const value = getPdfValue(field.key);
        const expected = field.value;
        const shouldMark = field.mark && (expected ? value === expected : Boolean(value));
        const text = field.mark ? "" : formatPdfPreviewValue(value);
        if (!shouldMark && !text) return;

        const width = page.getWidth();
        const height = page.getHeight();
        const x = (field.x / 100) * width;
        const yTop = (field.y / 100) * height;

        if (field.mark) {
          drawPdfCheck(page, {
            x: x + 1.5,
            y: height - yTop - ((field.h / 100) * height * 0.58),
            width: (field.w / 100) * width,
            color: markInk
          });
          return;
        }

        const fontSize = field.fontSize || 7.4;
        page.drawText(toPdfSafeText(text), {
          x: x,
          y: height - yTop - fontSize,
          size: fontSize,
          font: font,
          color: ink,
          maxWidth: (field.w / 100) * width
        });
      });

      const outputBytes = await pdfDoc.save();
      const blob = new Blob([outputBytes], { type: "application/pdf" });
      const fileName = "ITO Representative Application Form - filled.pdf";
      downloadBlob(blob, fileName);
    } catch (error) {
      window.alert("Không thể xuất PDF: " + String(error && error.message || error));
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel || "Xuất PDF";
      }
    }
  }

  function drawPdfCheck(page, options) {
    const x = options.x;
    const y = options.y;
    const size = Math.max(options.width || 8, 8);
    page.drawLine({
      start: { x: x, y: y },
      end: { x: x + size * 0.34, y: y - size * 0.33 },
      thickness: 1.4,
      color: options.color
    });
    page.drawLine({
      start: { x: x + size * 0.34, y: y - size * 0.33 },
      end: { x: x + size * 0.94, y: y + size * 0.42 },
      thickness: 1.4,
      color: options.color
    });
  }

  function toPdfSafeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "");
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function renderStaticPanel(title, bodyText) {
    return [
      '<section class="dashboard-surface-card">',
      '<h3 class="dashboard-panel__title">' + escapeHtml(title) + "</h3>",
      '<div class="dashboard-empty">' + escapeHtml(bodyText) + "</div>",
      "</section>"
    ].join("");
  }

  function renderAccountForm(formValues, departments) {
    if (!uiState.accountFormOpen) {
      return "";
    }

    return [
      '<form id="dashboardAccountForm" class="dashboard-account-form">',
      '<div class="dashboard-form-grid">',
      renderTextField(t("accountUsername"), "username", formValues.username),
      renderTextField(t("accountPassword"), "password", formValues.password),
      renderTextField(t("accountWelcome"), "welcomeMessage", formValues.welcomeMessage),
      renderTextField(t("accountPhone"), "phoneNumber", formValues.phoneNumber),
      "</div>",
      renderPermissionBlock("employees", t("accountEmployeesPermission"), formValues.permissions.employees, departments),
      renderPermissionBlock("schedule", t("accountSchedulePermission"), formValues.permissions.schedule, departments),
      '<div class="dashboard-form-actions">',
      '<button type="submit" class="dashboard-button dashboard-button--accent">' + escapeHtml(uiState.accountFormMode === "edit" ? t("accountSave") : t("accountCreate")) + "</button>",
      '<button type="button" class="dashboard-button dashboard-button--ghost" data-account-action="cancel-form">' + escapeHtml(t("accountCancel")) + "</button>",
      "</div>",
      "</form>"
    ].join("");
  }

  function renderPermissionBlock(moduleKey, title, permission, departments) {
    return [
      '<fieldset class="dashboard-permission-block">',
      '<legend class="dashboard-form-legend">' + escapeHtml(title) + "</legend>",
      '<div class="dashboard-form-grid dashboard-form-grid--permissions">',
      '<label class="dashboard-form-label">' + escapeHtml(t("permissionAccess")) + '<select class="dashboard-select" name="' + moduleKey + 'Access"><option value="view"' + (permission.access === "view" ? " selected" : "") + '>' + escapeHtml(t("accountModuleView")) + '</option><option value="edit"' + (permission.access === "edit" ? " selected" : "") + '>' + escapeHtml(t("accountModuleEdit")) + "</option></select></label>",
      '<label class="dashboard-form-label">' + escapeHtml(t("permissionScope")) + '<select class="dashboard-select" name="' + moduleKey + 'Scope"><option value="all"' + (permission.scope === "all" ? " selected" : "") + '>' + escapeHtml(t("allDepartments")) + '</option><option value="selected"' + (permission.scope === "selected" ? " selected" : "") + '>' + escapeHtml(t("selectedDepartments")) + "</option></select></label>",
      "</div>",
      '<div class="dashboard-department-checks">',
      departments.map(function (department) {
        const checked = permission.departmentIds.indexOf(department.id) >= 0 ? " checked" : "";
        return '<label class="dashboard-check-chip"><input type="checkbox" name="' + moduleKey + 'Departments" value="' + escapeHtml(department.id) + '"' + checked + '><span>' + escapeHtml(department.name) + "</span></label>";
      }).join(""),
      "</div>",
      "</fieldset>"
    ].join("");
  }

  function renderTextField(label, name, value) {
    return '<label class="dashboard-form-label">' + escapeHtml(label) + '<input class="dashboard-input" name="' + escapeHtml(name) + '" type="text" autocomplete="off" value="' + escapeHtml(value) + '"></label>';
  }

  function renderStatCard(label, value) {
    return [
      '<article class="dashboard-stat-card">',
      '<span class="dashboard-stat-card__label">' + escapeHtml(label) + "</span>",
      '<strong class="dashboard-stat-card__value">' + escapeHtml(value) + "</strong>",
      "</article>"
    ].join("");
  }

  function renderInfoCard(label, value) {
    return [
      '<article class="dashboard-info-card">',
      '<span class="dashboard-info-card__label">' + escapeHtml(label) + "</span>",
      '<strong class="dashboard-info-card__value">' + escapeHtml(value) + "</strong>",
      "</article>"
    ].join("");
  }

  function handleSalaryAction(button) {
    const action = button.getAttribute("data-salary-action");

    if (action === "edit") {
      uiState.salaryEditing = true;
      uiState.salaryEditFeedback = "";
      uiState.salaryShiftDraft = cloneSalaryShiftDefinitions(getSalaryShiftDefinitions());
      renderChatPanel();
      return;
    }

    if (action === "cancel-edit") {
      uiState.salaryEditing = false;
      uiState.salaryEditFeedback = "";
      uiState.salaryShiftDraft = [];
      renderChatPanel();
    }
  }

  function saveSalaryShiftEditForm(form) {
    const nextDefinitions = collectSalaryShiftEditForm(form);

    if (!nextDefinitions.length) {
      uiState.salaryEditFeedback = t("salaryEditInvalid");
      renderChatPanel();
      return;
    }

    uiState.salaryShiftDefinitions = nextDefinitions;
    uiState.salaryShiftDraft = [];
    uiState.salaryEditing = false;
    uiState.salaryEditFeedback = t("salaryEditSaved");
    storeSalaryShiftDefinitions(nextDefinitions);

    if (!getSalaryShift(uiState.salaryShiftCode)) {
      uiState.salaryShiftCode = nextDefinitions[0].code;
    }

    if (parseCurrencyInput(uiState.salaryMonthlyInput) > 0) {
      uiState.salaryResult = calculateSalaryAllowance(parseCurrencyInput(uiState.salaryMonthlyInput), uiState.salaryShiftCode, new Date());
    }

    renderChatPanel();
  }

  function collectSalaryShiftEditForm(form) {
    const rows = [];
    const seenCodes = Object.create(null);
    const rowCount = form.querySelectorAll("[name='code']").length;

    for (let index = 0; index < rowCount; index += 1) {
      const raw = {
        code: form.querySelector("[name='code'][data-salary-shift-index='" + index + "']"),
        start: form.querySelector("[name='start'][data-salary-shift-index='" + index + "']"),
        end: form.querySelector("[name='end'][data-salary-shift-index='" + index + "']")
      };
      const shift = normalizeSalaryShiftDefinition({
        code: raw.code ? raw.code.value : "",
        start: raw.start ? raw.start.value : "",
        end: raw.end ? raw.end.value : ""
      });

      if (!shift || seenCodes[shift.code]) {
        return [];
      }

      seenCodes[shift.code] = true;
      rows.push(shift);
    }

    return rows;
  }

  function submitSalaryForm(form) {
    updateSalaryFromForm(form, true);
  }

  function updateSalaryFromForm(form, shouldRender) {
    const monthlySalary = parseCurrencyInput(form.querySelector("[name='monthlySalary']").value);
    const shiftCode = normalizeShiftCode(form.querySelector("[name='shiftCode']").value);

    uiState.salaryMonthlyInput = form.querySelector("[name='monthlySalary']").value;
    uiState.salaryShiftCode = shiftCode;

    if (!monthlySalary || monthlySalary <= 0) {
      uiState.salaryResult = null;
      uiState.salaryFeedback = uiState.salaryMonthlyInput ? t("salaryMissing") : "";
      updateSalaryFormOutput(form);
      if (shouldRender) {
        renderChatPanel();
      }
      return;
    }

    uiState.salaryFeedback = "";
    uiState.salaryResult = calculateSalaryAllowance(monthlySalary, shiftCode, new Date());
    updateSalaryFormOutput(form);
    if (shouldRender) {
      renderChatPanel();
    }
  }

  function updateSalaryFormOutput(form) {
    const result = uiState.salaryResult;
    const output = form.querySelector("[name='salaryResult']");
    const feedback = form.querySelector("[data-salary-feedback]");
    const hourly = form.querySelector("[data-salary-metric='hourly']");
    const nightHours = form.querySelector("[data-salary-metric='nightHours']");
    const workingDays = form.querySelector("[data-salary-metric='workingDays']");

    if (output) output.value = result ? formatCurrency(result.allowance) : "";
    if (feedback) feedback.textContent = uiState.salaryFeedback || "";
    if (hourly) hourly.textContent = result ? formatCurrency(result.hourlySalary) : "--";
    if (nightHours) nightHours.textContent = result ? formatHours(result.nightHours) : "--";
    if (workingDays) workingDays.textContent = result ? String(result.workingDays) : String(getSalaryMonthRules(new Date()).workingDays);
  }

  function calculateSalaryAllowance(monthlySalary, shiftCode, date) {
    const rules = getSalaryMonthRules(date);
    const nightHours = getSalaryNightHours(shiftCode);
    const hourlySalary = monthlySalary / (rules.workingDays * STANDARD_HOURS_PER_DAY);
    const allowance = nightHours * hourlySalary * NIGHT_ALLOWANCE_RATE;

    return {
      monthlySalary: monthlySalary,
      shiftCode: shiftCode,
      daysInMonth: rules.daysInMonth,
      workingDays: rules.workingDays,
      hourlySalary: hourlySalary,
      nightHours: nightHours,
      allowance: allowance
    };
  }

  function getSalaryMonthRules(date) {
    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    return {
      daysInMonth: daysInMonth,
      workingDays: Math.max(daysInMonth - MONTHLY_OFF_DAYS, 1)
    };
  }

  function getStoredSalaryShiftDefinitions() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SALARY_SHIFT_STORAGE_KEY) || "null");
      if (Array.isArray(parsed)) {
        const normalized = normalizeSalaryShiftDefinitions(parsed);
        if (normalized.length) {
          return normalized;
        }
      }
    } catch (error) {}

    return cloneSalaryShiftDefinitions(DEFAULT_SALARY_SHIFT_DEFINITIONS);
  }

  function storeSalaryShiftDefinitions(definitions) {
    localStorage.setItem(SALARY_SHIFT_STORAGE_KEY, JSON.stringify(definitions));
  }

  function getSalaryShiftDefinitions() {
    return uiState.salaryShiftDefinitions && uiState.salaryShiftDefinitions.length
      ? uiState.salaryShiftDefinitions
      : DEFAULT_SALARY_SHIFT_DEFINITIONS;
  }

  function cloneSalaryShiftDefinitions(definitions) {
    return (definitions || []).map(function (shift) {
      return {
        code: shift.code,
        start: shift.start,
        end: shift.end
      };
    });
  }

  function normalizeSalaryShiftDefinitions(definitions) {
    const seenCodes = Object.create(null);
    const normalized = [];

    (definitions || []).forEach(function (definition) {
      const shift = normalizeSalaryShiftDefinition(definition);
      if (!shift || seenCodes[shift.code]) {
        return;
      }

      seenCodes[shift.code] = true;
      normalized.push(shift);
    });

    return normalized;
  }

  function normalizeSalaryShiftDefinition(definition) {
    const code = normalizeShiftCode(definition && definition.code);
    const start = formatSalaryClock(definition && definition.start);
    const end = formatSalaryClock(definition && definition.end);

    if (!code || !start || !end) {
      return null;
    }

    return {
      code: code,
      start: start,
      end: end
    };
  }

  function formatSalaryClock(value) {
    const raw = normalizeString(value);
    if (!raw) {
      return "";
    }

    const parts = raw.indexOf(":") >= 0 ? raw.split(":") : [raw, "0"];
    const hours = Number(parts[0]);
    const minutes = Number(parts[1] || 0);

    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return "";
    }

    return String(hours).padStart(2, "0") + ":" + String(minutes).padStart(2, "0");
  }

  function getSalaryNightHours(shiftCode) {
    const shift = getSalaryShift(shiftCode);
    if (!shift) {
      return 0;
    }

    const start = parseClockMinutes(shift.start);
    const end = parseClockMinutes(shift.end);
    if (start === null || end === null) {
      return 0;
    }

    const shiftStart = start;
    const shiftEnd = end <= start ? end + 24 * 60 : end;
    const nightWindows = [
      { start: 0, end: NIGHT_SHIFT_END_MINUTES },
      { start: NIGHT_SHIFT_START_MINUTES, end: 24 * 60 + NIGHT_SHIFT_END_MINUTES }
    ];

    const nightMinutes = nightWindows.reduce(function (total, window) {
      const overlapStart = Math.max(shiftStart, window.start);
      const overlapEnd = Math.min(shiftEnd, window.end);
      return total + Math.max(overlapEnd - overlapStart, 0);
    }, 0);

    return nightMinutes / 60;
  }

  function getSalaryShift(shiftCode) {
    const code = normalizeShiftCode(shiftCode);
    return getSalaryShiftDefinitions().find(function (shift) {
      return shift.code === code;
    }) || null;
  }

  function getSalaryShiftLabel(shiftCode) {
    const shift = getSalaryShift(shiftCode);
    return shift ? shift.code + ": " + shift.start + " - " + shift.end : shiftCode;
  }

  function parseClockMinutes(value) {
    const parts = String(value || "").split(":");
    const hours = Number(parts[0]);
    const minutes = Number(parts[1] || 0);

    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      return null;
    }

    return hours * 60 + minutes;
  }

  function parseCurrencyInput(value) {
    const digits = String(value || "").replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
  }

  function formatCurrency(value) {
    return Math.round(Number(value || 0)).toLocaleString("vi-VN") + " VND";
  }

  function formatHours(value) {
    const rounded = Math.round(Number(value || 0) * 100) / 100;
    return rounded.toLocaleString("vi-VN") + "h";
  }

  function renderChatChip(label, value, options) {
    const liveAttr = options && options.liveClock ? ' data-live-clock-value="true"' : "";
    return [
      '<article class="dashboard-chat-chip">',
      '<span class="dashboard-chat-chip__label">' + escapeHtml(label) + "</span>",
      '<strong class="dashboard-chat-chip__value"' + liveAttr + ">" + escapeHtml(value) + "</strong>",
      "</article>"
    ].join("");
  }

  function renderShiftCard(member) {
    const status = member.status === "ended" ? "ended" : (member.status === "ending" ? "ending" : "active");
    const engName = member.engName || member.name || "";
    const vieName = member.vieName || "";
    const position = member.position || "";
    const ydiId = member.ydiId || "";
    const meta = [position, ydiId].filter(function (part) { return part; }).join(" · ");
    const initial = (engName || vieName || ydiId || "?").trim().charAt(0).toUpperCase();
    const avatarMarkup = member.avatarSrc
      ? '<img class="dashboard-shift-card__avatar-img" src="' + escapeHtml(member.avatarSrc) + '" alt="' + escapeHtml(engName || vieName || ydiId) + '">'
      : '<span class="dashboard-shift-card__avatar-fallback">' + escapeHtml(initial) + '</span>';
    return [
      '<article class="dashboard-shift-card dashboard-shift-card--' + status + '">',
      '<span class="dashboard-shift-card__status" aria-hidden="true"></span>',
      '<div class="dashboard-shift-card__avatar">' + avatarMarkup + '</div>',
      '<div class="dashboard-shift-card__info">',
      '<strong class="dashboard-shift-card__name">' + escapeHtml(engName || vieName || ydiId || member.id) + '</strong>',
      vieName && vieName !== engName ? '<span class="dashboard-shift-card__vie">' + escapeHtml(vieName) + '</span>' : '',
      meta ? '<span class="dashboard-shift-card__meta">' + escapeHtml(meta) + '</span>' : '',
      '<span class="dashboard-shift-card__shift">' + escapeHtml(member.code || "") + '</span>',
      '</div>',
      '</article>'
    ].join("");
  }

  function submitAccountForm(form) {
    const values = {
      username: normalizeString(form.querySelector("[name='username']").value),
      password: normalizeString(form.querySelector("[name='password']").value),
      welcomeMessage: normalizeString(form.querySelector("[name='welcomeMessage']").value),
      phoneNumber: normalizeString(form.querySelector("[name='phoneNumber']").value),
      permissions: {
        employees: collectPermissionValues(form, "employees"),
        schedule: collectPermissionValues(form, "schedule")
      }
    };

    if (!values.username || !values.password || !values.welcomeMessage) {
      uiState.accountFeedback = { text: t("accountMissing"), type: "error" };
      renderDetailPanel();
      return;
    }

    if (
      (values.permissions.employees.scope === "selected" && !values.permissions.employees.departmentIds.length) ||
      (values.permissions.schedule.scope === "selected" && !values.permissions.schedule.departmentIds.length)
    ) {
      uiState.accountFeedback = { text: t("accountNoDepartments"), type: "error" };
      renderDetailPanel();
      return;
    }

    const result = uiState.accountFormMode === "edit"
      ? authStore.updateAccount(uiState.editingAccountUsername, values)
      : authStore.createAccount(values);

    if (!result.ok) {
      uiState.accountFeedback = {
        text: result.error === "duplicate-account" ? t("accountDuplicate") : t("accountMissing"),
        type: "error"
      };
      renderDetailPanel();
      return;
    }

    uiState.accountFeedback = {
      text: uiState.accountFormMode === "edit" ? t("accountUpdateSuccess") : t("accountSuccess"),
      type: "success"
    };
    uiState.accountFormOpen = false;
    uiState.accountFormMode = "create";
    uiState.editingAccountUsername = "";
    renderAll();
  }

  function collectPermissionValues(form, moduleKey) {
    return {
      access: form.querySelector("[name='" + moduleKey + "Access']").value,
      scope: form.querySelector("[name='" + moduleKey + "Scope']").value,
      departmentIds: Array.prototype.slice.call(form.querySelectorAll("[name='" + moduleKey + "Departments']:checked")).map(function (input) {
        return input.value;
      })
    };
  }

  function getAccountFormValues() {
    const editingAccount = uiState.accountFormMode === "edit" && uiState.editingAccountUsername
      ? authStore.getAccountByUsername(uiState.editingAccountUsername)
      : null;

    if (!editingAccount) {
      return {
        username: "",
        password: "",
        welcomeMessage: "",
        phoneNumber: "",
        permissions: {
          employees: authStore.getModulePermission({ role: "viewer", permissions: null }, "employees"),
          schedule: authStore.getModulePermission({ role: "viewer", permissions: null }, "schedule")
        }
      };
    }

    return {
      username: editingAccount.username,
      password: editingAccount.password,
      welcomeMessage: editingAccount.welcomeMessage,
      phoneNumber: editingAccount.phoneNumber || "",
      permissions: {
        employees: authStore.getModulePermission(editingAccount, "employees"),
        schedule: authStore.getModulePermission(editingAccount, "schedule")
      }
    };
  }

  function getEmployeesState() {
    if (!employeesDataApi || !employeesDataApi.createInitialState) {
      return { departments: [], employees: [] };
    }

    try {
      const parsed = JSON.parse(localStorage.getItem(employeesDataApi.STORAGE_KEY) || "null");
      if (parsed && Array.isArray(parsed.employees)) {
        const mergedState = employeesDataApi.mergeStateWithSeedData
          ? employeesDataApi.mergeStateWithSeedData(parsed)
          : parsed;

        return {
          departments: Array.isArray(mergedState.departments) ? mergedState.departments : employeesDataApi.DEFAULT_DEPARTMENTS,
          employees: mergedState.employees
        };
      }
    } catch (error) {}

    const initial = employeesDataApi.createInitialState();
    return {
      departments: initial.departments || [],
      employees: initial.employees || []
    };
  }

  function getScheduleState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SCHEDULE_STORAGE_KEY) || "null");
      if (parsed && typeof parsed === "object") {
        return {
          selectedYear: parsed.selectedYear || new Date().getFullYear(),
          selectedMonth: parsed.selectedMonth || (new Date().getMonth() + 1),
          months: parsed.months && typeof parsed.months === "object" ? parsed.months : {}
        };
      }
    } catch (error) {}

    return {
      selectedYear: new Date().getFullYear(),
      selectedMonth: new Date().getMonth() + 1,
      months: {}
    };
  }

  function getDepartmentCatalog() {
    const state = getEmployeesState();
    return getAccessibleDepartments(currentAccount, "employees", state, false);
  }

  function getAccessibleDepartments(account, moduleKey, employeesState, includeRetired) {
    const state = employeesState || getEmployeesState();
    const departments = (state.departments || []).filter(function (department) {
      return includeRetired || !department.fixed;
    });
    const ids = departments.map(function (department) { return department.id; });
    const allowedIds = authStore.getAccessibleDepartmentIds(account, moduleKey, ids);

    return departments.filter(function (department) {
      return allowedIds.indexOf(department.id) >= 0;
    });
  }

  function getAccessibleEmployees(account, employeesState) {
    const state = employeesState || getEmployeesState();
    const allowedIds = getAccessibleDepartments(account, "employees", state, false).map(function (department) {
      return department.id;
    });

    return (state.employees || []).filter(function (employee) {
      return allowedIds.indexOf(employee.departmentId) >= 0;
    });
  }

  function getVisibleMonthState(scheduleState, monthKey, account) {
    const state = scheduleState || getScheduleState();
    const monthState = state.months && state.months[monthKey] ? state.months[monthKey] : { rows: [] };
    const employeesState = getEmployeesState();
    const departments = getAccessibleDepartments(account, "schedule", employeesState, false);
    const allowedIds = departments.map(function (department) { return department.id; });
    const allowedDepartmentNames = departments.map(function (department) { return department.name; });
    const employeesById = {};

    (employeesState.employees || []).forEach(function (employee) {
      employeesById[String(employee.id || "")] = employee;
    });

    if (authStore.getModulePermission(account, "schedule").scope === "all") {
      return {
        rows: Array.isArray(monthState.rows) ? monthState.rows : []
      };
    }

    return {
      rows: (monthState.rows || []).filter(function (row) {
        const snapshot = row.employeeSnapshot || {};
        const employee = employeesById[String(row.employeeId || snapshot.employeeId || "")] || null;
        if (employee && allowedIds.indexOf(employee.departmentId) >= 0) {
          return true;
        }
        return allowedDepartmentNames.indexOf(snapshot.department) >= 0;
      })
    };
  }

  function getVisibleScheduleDepartmentCount(rows) {
    const names = {};
    (rows || []).forEach(function (row) {
      const name = row && row.employeeSnapshot ? row.employeeSnapshot.department : "";
      if (name) {
        names[name] = true;
      }
    });
    return Object.keys(names).length;
  }

  function normalizeShiftCode(value) {
    return normalizeString(value).toUpperCase();
  }

  function parseShiftHour(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getShiftWindow(code) {
    const definition = SHIFT_CODE_MAP[normalizeShiftCode(code)];
    if (!definition || Number(definition.hoursPay || 0) <= 0) {
      return null;
    }

    const startHour = parseShiftHour(definition.checkIn);
    const endHour = parseShiftHour(definition.checkOut);

    if (startHour === null || endHour === null) {
      return null;
    }

    return {
      code: definition.code,
      startMinutes: startHour * 60,
      endMinutes: endHour * 60,
      overnight: endHour <= startHour
    };
  }

  function formatClock(date) {
    return String(date.getHours()).padStart(2, "0") + ":" +
      String(date.getMinutes()).padStart(2, "0") + ":" +
      String(date.getSeconds()).padStart(2, "0");
  }

  function formatDateLabel(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function classifyShiftStatus(window, currentMinutes, isOvernightCarry) {
    if (!window) {
      return null;
    }
    if (isOvernightCarry) {
      if (!window.overnight) { return null; }
      const remaining = window.endMinutes - currentMinutes;
      if (remaining > 120) { return { status: "active", remainingMinutes: remaining }; }
      if (remaining > 0) { return { status: "ending", remainingMinutes: remaining }; }
      if (-remaining <= 120) { return { status: "ended", remainingMinutes: remaining }; }
      return null;
    }
    if (window.overnight) {
      if (currentMinutes < window.startMinutes) { return null; }
      const remaining = (24 * 60 - currentMinutes) + window.endMinutes;
      if (remaining > 120) { return { status: "active", remainingMinutes: remaining }; }
      return { status: "ending", remainingMinutes: remaining };
    }
    if (currentMinutes < window.startMinutes) { return null; }
    if (currentMinutes >= window.endMinutes) {
      const since = currentMinutes - window.endMinutes;
      if (since <= 120) { return { status: "ended", remainingMinutes: -since }; }
      return null;
    }
    const remaining = window.endMinutes - currentMinutes;
    if (remaining > 120) { return { status: "active", remainingMinutes: remaining }; }
    return { status: "ending", remainingMinutes: remaining };
  }

  function collectLiveMembers(liveMap, monthState, dayNumber, currentMinutes, isOvernightCarry) {
    (monthState.rows || []).forEach(function (row) {
      const shifts = row && row.shifts ? row.shifts : {};
      const code = normalizeShiftCode(shifts[String(dayNumber)]);
      const window = getShiftWindow(code);
      const snapshot = row && row.employeeSnapshot ? row.employeeSnapshot : {};
      const classification = classifyShiftStatus(window, currentMinutes, isOvernightCarry);
      if (!classification) { return; }

      const memberKey = String(row.employeeId || snapshot.employeeId || snapshot.ydiId || row.id || "");
      const existing = liveMap[memberKey];
      const incoming = {
        id: memberKey,
        code: window.code,
        ydiId: normalizeString(snapshot.ydiId),
        department: normalizeString(snapshot.department),
        engName: normalizeString(snapshot.engName),
        vieName: normalizeString(snapshot.vieName),
        name: normalizeString(snapshot.engName) || normalizeString(snapshot.vieName) || normalizeString(snapshot.ydiId) || memberKey,
        secondaryName: normalizeString(snapshot.vieName),
        position: normalizeString(snapshot.position),
        status: classification.status,
        remainingMinutes: classification.remainingMinutes,
        sourceType: isOvernightCarry ? "carry" : "current"
      };
      if (!existing) {
        liveMap[memberKey] = incoming;
        return;
      }
      const rank = { active: 3, ending: 2, ended: 1 };
      if ((rank[incoming.status] || 0) > (rank[existing.status] || 0)) {
        liveMap[memberKey] = incoming;
      }
    });
  }

  function buildEmployeeAvatarMap() {
    const employeesState = getEmployeesState();
    const byYdiId = {};
    const byEngName = {};
    const byVieName = {};
    (employeesState.employees || []).forEach(function (emp) {
      const basic = emp.basic || {};
      if (basic.ydiId) { byYdiId[String(basic.ydiId).trim().toUpperCase()] = emp; }
      if (basic.engName) { byEngName[String(basic.engName).trim().toUpperCase()] = emp; }
      if (basic.vieName) { byVieName[String(basic.vieName).trim().toUpperCase()] = emp; }
    });
    return { byYdiId: byYdiId, byEngName: byEngName, byVieName: byVieName };
  }

  function findEmployeeForMember(member, avatarMap) {
    const ydiKey = String(member.ydiId || "").trim().toUpperCase();
    const engKey = String(member.engName || "").trim().toUpperCase();
    const vieKey = String(member.vieName || "").trim().toUpperCase();
    return (ydiKey && avatarMap.byYdiId[ydiKey])
      || (engKey && avatarMap.byEngName[engKey])
      || (vieKey && avatarMap.byVieName[vieKey])
      || null;
  }

  function getCurrentLiveSchedule(account) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentMonthKey = buildMonthKey(now.getFullYear(), now.getMonth() + 1);
    const previousDate = new Date(now.getTime());
    previousDate.setDate(now.getDate() - 1);
    const previousMonthKey = buildMonthKey(previousDate.getFullYear(), previousDate.getMonth() + 1);
    const liveMap = {};

    collectLiveMembers(liveMap, getVisibleMonthState(getScheduleState(), previousMonthKey, account), previousDate.getDate(), currentMinutes, true);
    collectLiveMembers(liveMap, getVisibleMonthState(getScheduleState(), currentMonthKey, account), now.getDate(), currentMinutes, false);

    const avatarMap = buildEmployeeAvatarMap();
    const statusRank = { active: 0, ending: 1, ended: 2 };
    const staff = Object.keys(liveMap).map(function (key) {
      const member = liveMap[key];
      const employee = findEmployeeForMember(member, avatarMap);
      member.avatarSrc = employee && employee.avatarSrc ? employee.avatarSrc : "";
      if (employee) {
        const basic = employee.basic || {};
        const work = employee.work || {};
        if (!member.engName && basic.engName) { member.engName = basic.engName; }
        if (!member.vieName && basic.vieName) { member.vieName = basic.vieName; }
        if (!member.position && work.position) { member.position = work.position; }
        if (!member.ydiId && basic.ydiId) { member.ydiId = basic.ydiId; }
        if (!member.department && work.departmentName) { member.department = work.departmentName; }
        member.name = member.engName || member.vieName || member.name;
      }
      return member;
    }).sort(function (left, right) {
      const statusCompare = (statusRank[left.status] || 0) - (statusRank[right.status] || 0);
      if (statusCompare !== 0) { return statusCompare; }
      const departmentCompare = String(left.department || "").localeCompare(String(right.department || ""));
      return departmentCompare || String(left.name || "").localeCompare(String(right.name || ""));
    });

    const groupedDepartments = {};
    staff.forEach(function (member) {
      const departmentName = member.department || t("noDepartmentPermission");
      if (!groupedDepartments[departmentName]) {
        groupedDepartments[departmentName] = [];
      }
      groupedDepartments[departmentName].push(member);
    });

    return {
      now: now,
      timeLabel: formatClock(now),
      dateLabel: formatDateLabel(now),
      staff: staff,
      activeStaffCount: staff.filter(function (m) { return m.status !== "ended"; }).length,
      departments: Object.keys(groupedDepartments).sort().map(function (name) {
        return {
          name: name,
          members: groupedDepartments[name]
        };
      })
    };
  }

  function getResolvedScheduleMonthKey(scheduleState) {
    const monthKeys = Object.keys(scheduleState.months || {}).sort();
    return monthKeys[0] || buildMonthKey(scheduleState.selectedYear, scheduleState.selectedMonth);
  }

  function getStoredActiveTab(account) {
    const stored = sessionStorage.getItem(HOME_TAB_STORAGE_KEY + ":" + account.username);
    if (stored) {
      return stored;
    }
    return authStore.isAdmin(account) ? "accounts" : "operationTraining";
  }

  function storeActiveTab(account, nextTab) {
    sessionStorage.setItem(HOME_TAB_STORAGE_KEY + ":" + account.username, nextTab);
  }

  function describePermission(permission, departments) {
    const accessText = permission.access === "edit" ? t("summaryEditor") : t("summaryViewer");
    const scopeText = permission.scope === "all"
      ? t("summaryAll")
      : (
        permission.departmentIds.length
          ? permission.departmentIds.map(function (departmentId) {
              const match = departments.find(function (department) {
                return department.id === departmentId;
              });
              return match ? match.name : departmentId;
            }).join(", ")
          : t("noDepartmentPermission")
      );
    return accessText + " · " + scopeText;
  }

  function resolveActionTooltip(key) {
    if (key.indexOf("common.") === 0) {
      return i18n.t(key);
    }
    return t(key);
  }

  function buildMonthKey(year, month) {
    return String(year) + "-" + String(month).padStart(2, "0");
  }

  function t(key, params) {
    const locale = i18n.getLocale();
    const bucket = customText[locale] || customText["zh-Hant"];
    const template = bucket[key] || customText["zh-Hant"][key] || key;
    if (!params) {
      return template;
    }
    return String(template).replace(/\{([^}]+)\}/g, function (_, token) {
      return params[token] !== undefined ? String(params[token]) : "";
    });
  }

  function normalizeString(value) {
    return String(value || "").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
