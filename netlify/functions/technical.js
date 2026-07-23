exports.handler = async (event) => {
  try {
    const symbol = event.queryStringParameters?.symbol || "QQQ";

    const apiKey = process.env.ALPHAVANTAGE_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Falta la variable ALPHAVANTAGE_API_KEY"
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        symbol,
        message: "technical.js funcionando correctamente"
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message
      })
    };
  }
};