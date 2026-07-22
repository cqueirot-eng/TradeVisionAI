const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  }
});

export default async (request) => {
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return json({ error: "Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en Netlify." }, 500);

  try {
    const { state } = await request.json();
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      return json({ error: "El estado recibido no es válido." }, 400);
    }

    const serialized = JSON.stringify(state);
    if (serialized.length > 2_000_000) return json({ error: "El estado supera el límite permitido." }, 413);

    const headers = {
      apikey: key,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    };
    if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;

    const response = await fetch(`${url}/rest/v1/app_state?on_conflict=storage_key`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        storage_key: "main",
        storage_value: state,
        updated_at: new Date().toISOString()
      })
    });
    const data = await response.json();
    if (!response.ok) return json({ error: data.message || "No se pudo guardar en Supabase.", details: data }, response.status);

    return json({ ok: true, updatedAt: data?.[0]?.updated_at || new Date().toISOString() });
  } catch (error) {
    return json({ error: error.message || "Error inesperado al guardar." }, 500);
  }
};
