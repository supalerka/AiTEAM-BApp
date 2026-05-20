// Vercel Serverless Function — proxies AI chat ไปยัง Google Gemini API
// ตั้งค่าใน Vercel → Project → Settings → Environment Variables:
//   GEMINI_API_KEY = AIza... (จาก https://aistudio.google.com/app/apikey)

export default async function handler(req, res) {
  // CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY ยังไม่ได้ตั้งค่าใน Vercel Environment Variables\n" +
             "ไปที่ Vercel → Project → Settings → Environment Variables",
    });
  }

  const { system, messages, max_tokens } = req.body || {};
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  // แปลง Anthropic format → Gemini format
  const geminiContents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content || "" }],
  }));

  const systemText = system || "คุณคือ AI Assistant สำหรับระบบบริหารธุรกิจ ตอบเป็นภาษาไทยเสมอ กระชับและตรงประเด็น";
  const contentsWithSystem = [
    { role: "user",  parts: [{ text: `[System]: ${systemText}` }] },
    { role: "model", parts: [{ text: "เข้าใจแล้ว พร้อมช่วยเหลือครับ" }] },
    ...geminiContents,
  ];

  const geminiBody = {
    contents: contentsWithSystem,
    generationConfig: {
      maxOutputTokens: max_tokens || 1000,
      temperature: 0.7,
    },
  };

  try {
    const model = "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const errMsg = data.error?.message || `Gemini API error ${geminiRes.status}`;
      return res.status(geminiRes.status).json({ error: errMsg });
    }

    // แปลง Gemini response → Anthropic-compatible format (frontend ใช้ data.content[0].text)
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "ขออภัย ไม่สามารถตอบได้ในขณะนี้";
    return res.status(200).json({
      content: [{ type: "text", text }],
    });
  } catch (err) {
    return res.status(500).json({ error: "ไม่สามารถเชื่อมต่อ Gemini API ได้: " + err.message });
  }
}
