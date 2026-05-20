// Vercel Serverless Function — ส่ง invite email ผ่าน Supabase Admin API
// ต้องใช้ SUPABASE_SERVICE_ROLE_KEY (ไม่ใช่ anon key) จึงต้องอยู่ใน server side
// ตั้งค่าใน Vercel → Project → Settings → Environment Variables:
//   SUPABASE_URL              = https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY = eyJ...

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    return res.status(500).json({
      error: "SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ยังไม่ได้ตั้งค่าใน Vercel Environment Variables\n" +
             "ไปที่ Vercel → Project → Settings → Environment Variables",
    });
  }

  // Vercel parse req.body อัตโนมัติเมื่อ Content-Type: application/json
  const { email, full_name, role, position } = req.body || {};
  if (!email || !full_name || !role) {
    return res.status(400).json({ error: "email, full_name และ role จำเป็นต้องมี" });
  }

  try {
    // Step 1: สร้าง invited user ใน Supabase Auth
    const inviteRes = await fetch(`${supabaseUrl}/auth/v1/invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email,
        data: { full_name, role, position: position || "" },
      }),
    });

    const data = await inviteRes.json();

    if (!inviteRes.ok) {
      return res.status(inviteRes.status).json({
        error: data.msg || data.message || "ส่งคำเชิญไม่สำเร็จ",
      });
    }

    // Step 2: สร้าง user_profiles ทันที (ใช้ service key ข้าม RLS)
    // admin เห็น user ใหม่ในหน้าจัดการได้เลย ก่อน user จะ accept invite
    try {
      await fetch(`${supabaseUrl}/rest/v1/user_profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceKey,
          "Authorization": `Bearer ${serviceKey}`,
          "Prefer": "resolution=ignore-duplicates,return=minimal",
        },
        body: JSON.stringify({
          id: data.id,
          full_name,
          role,
          position: position || "",
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (_) { /* ไม่ block ถ้า insert profile ล้มเหลว */ }

    return res.status(200).json({ success: true, user: data });
  } catch (err) {
    return res.status(500).json({ error: "เกิดข้อผิดพลาด: " + err.message });
  }
}
