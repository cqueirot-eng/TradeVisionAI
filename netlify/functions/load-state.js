const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  }
});

export default async (request) => {
  if (request.method !== "GET") return json({ error: "Método no permitido" }, 405);

  const url = Netlify.env.get("SUPABASE_URL");
  const key = Netlify.env.get("SUPABASE_SECRET_KEY");
  if (!url || !key) return json({ error: "Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en Netlify." }, 500);

  try {
    const headers = { apikey: key, Accept: "application/json" };
    if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;

    const response = await fetch(`${url}/rest/v1/app_state?storage_key=eq.main&select=storage_value,updated_at&limit=1`, {
      headers
    });
    const data = await response.json();
    if (!response.ok) return json({ error: data.message || "No se pudo leer Supabase.", details: data }, response.status);

    if (!Array.isArray(data) || data.length === 0) return json({ found: false, state: null });
    return json({ found: true, state: data[0].storage_value, updatedAt: data[0].updated_at });
  } catch (error) {
    return json({ error: error.message || "Error inesperado al cargar." }, 500);
  }
};
