export default async (request) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), { status: 405 });
  }

  try {
    const apiKey = Netlify.env.get("RESEND_API_KEY");
    const fromEmail = Netlify.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Falta configurar RESEND_API_KEY en Netlify." }), {
        status: 500, headers: { "Content-Type": "application/json" }
      });
    }

    const { to, senderName = "TradeVision AI", alerts = [], test = false } = await request.json();
    if (!to || !Array.isArray(alerts)) {
      return new Response(JSON.stringify({ error: "Datos de envío incompletos." }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    const rows = alerts.map(a => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(a.ticker || "-")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(a.horizon || "-")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(a.level || "Info")}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd">${escapeHtml(a.text || "")}</td>
      </tr>`).join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:760px;margin:auto">
        <h2>${test ? "Prueba de correo" : "Alertas consolidadas"} — TradeVision AI</h2>
        <p>Destinatario configurado: ${escapeHtml(to)}</p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr><th align="left">Ticker</th><th align="left">Horizonte</th><th align="left">Señal</th><th align="left">Detalle</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="color:#666;font-size:12px;margin-top:20px">Información educativa. No constituye asesoramiento financiero.</p>
      </div>`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: `${senderName} <${fromEmail}>`,
        to: [to],
        subject: test ? "TradeVision AI — Correo de prueba" : `TradeVision AI — ${alerts.length} alertas`,
        html
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.message || "Resend rechazó el envío.", details: data }), {
        status: response.status, headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || "Error inesperado." }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[c]);
}
