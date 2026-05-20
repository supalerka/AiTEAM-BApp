// Netlify serverless function — ส่ง invite email ผ่าน Supabase Admin API
// ต้องใช้ SUPABASE_SERVICE_ROLE_KEY (ไม่ใช่ anon key) จึงต้องอยู่ใน server side
// ตั้งค่าใน Netlify → Site → Environment variables:
//   SUPABASE_URL = https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY = eyJ...

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;

  if (!serviceKey || !supabaseUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY ยังไม่ได้ตั้งค่าใน Netlify Environment" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { email, full_name, role, position } = body;
  if (!email || !full_name || !role) {
    return { statusCode: 400, body: JSON.stringify({ error: "email, full_name และ role จำเป็นต้องมี" }) };
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/invite`, {
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

    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: data.msg || data.message || "ส่งคำเชิญไม่สำเร็จ" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, user: data }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "เกิดข้อผิดพลาด: " + err.message }),
    };
  }
};
