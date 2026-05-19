# BizSystem Deploy

## วิธีอัปเดต App
1. copy `App2_fixed.jsx` จาก bizsystem-dev มาวางที่ `src/App.jsx`
2. push ขึ้น GitHub
3. Cloudflare Pages / Vercel deploy อัตโนมัติ

## การตั้งค่า Environment Variables
ตั้งค่าใน Cloudflare Pages หรือ Vercel dashboard:
- `VITE_SUPABASE_URL` = Supabase project URL
- `VITE_SUPABASE_ANON_KEY` = Supabase anon key
