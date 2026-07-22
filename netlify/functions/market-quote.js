const ALLOWED_SYMBOL_PATTERN = /^[A-Z0-9.\-:]{1,20}$/;

function createResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "GET") {
    return createResponse(405, {
      ok: false,
      error: "Método no permitido.",
    });
  }

  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    console.error("FINNHUB_API_KEY no está configurada.");

    return createResponse(500, {
      ok: false,
      error: "La API financiera no está configurada.",
    });
  }

  const rawSymbol = event.queryStringParameters?.symbol || "";
  const symbol = rawSymbol.trim().toUpperCase();

  if (!symbol) {
    return createResponse(400, {
      ok: false,
      error: "Falta el símbolo del activo.",
    });
  }

  if (!ALLOWED_SYMBOL_PATTERN.test(symbol)) {
    return createResponse(400, {
      ok: false,
      error: "El símbolo tiene un formato inválido.",
    });
  }

  try {
    const url = new URL("https://finnhub.io/api/v1/quote");
    url.searchParams.set("symbol", symbol);

    const response = await fetch(url, {
      headers: {
        "X-Finnhub-Token": apiKey,
        Accept: "application/json",
      },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("Finnhub respondió con error:", response.status, data);

      return createResponse(response.status, {
        ok: false,
        error: "No se pudo obtener la cotización.",
        providerStatus: response.status,
      });
    }

    if (!data || typeof data.c !== "number") {
      console.error("Respuesta inválida de Finnhub:", data);

      return createResponse(502, {
        ok: false,
        error: "La fuente de mercado devolvió datos inválidos.",
      });
    }

    if (data.c === 0 && data.pc === 0) {
      return createResponse(404, {
        ok: false,
        error: `No se encontró una cotización válida para ${symbol}.`,
      });
    }

    return createResponse(200, {
      ok: true,
      provider: "Finnhub",
      currency: "USD",
      market: "US",
      quote: {
        symbol,
        currentPrice: data.c,
        change: data.d,
        changePercent: data.dp,
        high: data.h,
        low: data.l,
        open: data.o,
        previousClose: data.pc,
        timestamp: data.t,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error en market-quote:", error);

    return createResponse(500, {
      ok: false,
      error: "Error interno al consultar la cotización.",
    });
  }
};