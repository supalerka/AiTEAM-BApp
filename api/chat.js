// Vercel Serverless Function — proxies AI chat ไปยัง Groq API
// ตั้งค่าใน Vercel → Project → Settings → Environment Variables:
//   GROQ_API_KEY = gsk_... (จาก https://console.groq.com → API Keys)

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GROQ_API_KEY ยังไม่ได้ตั้งค่าใน Vercel Environment Variables\n" +
             "ไปที่ Vercel → Project → Settings → Environment Variables",
    });
  }

  const { system, messages, max_tokens } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  const systemText = system || "คุณคือ AI Assistant สำหรับระบบบริหารธุรกิจ ตอบเป็นภาษาไทยเสมอ กระชับและตรงประเด็น";

  const groqBody = {
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: systemText },
      ...messages.map(m => ({ role: m.role, content: m.content || "" })),
    ],
    max_tokens: max_tokens || 1000,
    temperature: 0.7,
  };

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(groqBody),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      const errMsg = data.error?.message || `Groq API error ${groqRes.status}`;
      return res.status(groqRes.status).json({ error: errMsg });
    }

    const text = data.choices?.[0]?.message?.content || "ขออภัย ไม่สามารถตอบได้ในขณะนี้";
    return res.status(200).json({
      content: [{ type: "text", text }],
    });
  } catch (err) {
    return res.status(500).json({ error: "ไม่สามารถเชื่อมต่อ Groq API ได้: " + err.message });
  }
}
