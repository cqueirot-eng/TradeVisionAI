const ALPHA_VANTAGE_URL = "https://www.alphavantage.co/query";

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(data)
  };
}

async function fetchIndicator({
  apiKey,
  symbol,
  functionName,
  timePeriod
}) {
  const params = new URLSearchParams({
    function: functionName,
    symbol,
    interval: "daily",
    series_type: "close",
    apikey: apiKey
  });

  if (timePeriod) {
    params.set("time_period", String(timePeriod));
  }

  const response = await fetch(
    `${ALPHA_VANTAGE_URL}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      `Alpha Vantage respondió HTTP ${response.status}`
    );
  }

  const data = await response.json();

  if (data["Error Message"]) {
    throw new Error(data["Error Message"]);
  }

  if (data.Information) {
    throw new Error(data.Information);
  }

  if (data.Note) {
    throw new Error(data.Note);
  }

  const analysisKey =
    functionName === "RSI"
      ? "Technical Analysis: RSI"
      : "Technical Analysis: SMA";

  const analysis = data[analysisKey];

  if (!analysis || typeof analysis !== "object") {
    throw new Error(
      `No se recibió ${functionName}${timePeriod || ""} para ${symbol}`
    );
  }

  const latestDate = Object.keys(analysis).sort().reverse()[0];

  if (!latestDate) {
    throw new Error(
      `No hay datos disponibles para ${symbol}`
    );
  }

  const fieldName = functionName === "RSI" ? "RSI" : "SMA";
  const value = Number(analysis[latestDate][fieldName]);

  if (!Number.isFinite(value)) {
    throw new Error(
      `Valor inválido de ${functionName} para ${symbol}`
    );
  }

  return {
    value,
    date: latestDate
  };
}

exports.handler = async (event) => {
  try {
    const apiKey = process.env.ALPHAVANTAGE_API_KEY;

    if (!apiKey) {
      return jsonResponse(500, {
        ok: false,
        error: "Falta la variable ALPHAVANTAGE_API_KEY"
      });
    }

    const requestedSymbol =
      event.queryStringParameters?.symbol || "QQQ";

    const symbol = requestedSymbol
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9.-]/g, "");

    if (!symbol) {
      return jsonResponse(400, {
        ok: false,
        error: "Ticker inválido"
      });
    }

    /*
     * Las solicitudes se realizan en paralelo para reducir
     * el tiempo total de ejecución de la función.
     */
    const [
      sma20,
      sma50,
      sma100,
      sma200,
      sma400,
      rsi14
    ] = await Promise.all([
      fetchIndicator({
        apiKey,
        symbol,
        functionName: "SMA",
        timePeriod: 20
      }),
      fetchIndicator({
        apiKey,
        symbol,
        functionName: "SMA",
        timePeriod: 50
      }),
      fetchIndicator({
        apiKey,
        symbol,
        functionName: "SMA",
        timePeriod: 100
      }),
      fetchIndicator({
        apiKey,
        symbol,
        functionName: "SMA",
        timePeriod: 200
      }),
      fetchIndicator({
        apiKey,
        symbol,
        functionName: "SMA",
        timePeriod: 400
      }),
      fetchIndicator({
        apiKey,
        symbol,
        functionName: "RSI",
        timePeriod: 14
      })
    ]);

    return jsonResponse(200, {
      ok: true,
      symbol,
      lastUpdated: sma20.date,
      indicators: {
        sma20: sma20.value,
        sma50: sma50.value,
        sma100: sma100.value,
        sma200: sma200.value,
        sma400: sma400.value,
        rsi14: rsi14.value
      }
    });
  } catch (error) {
    console.error("technical.js:", error);

    return jsonResponse(500, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Error desconocido"
    });
  }
};