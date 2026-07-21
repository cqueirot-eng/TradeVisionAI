# TradeVision AI V2

## Novedades
- Carga manual de cotizaciones.
- Importación CSV.
- Fuente y fecha de actualización.
- Indicador de precio desactualizado.
- Enlace directo a BYMADATA Open.
- Envío real de alertas por Resend usando Netlify Functions.
- Correo de prueba.

## Publicar como actualización del proyecto existente
1. Descomprimí `TradeVisionAI_V2_Netlify.zip`.
2. En Netlify abrí tu proyecto actual.
3. Entrá en **Deploys**.
4. Arrastrá la carpeta `tradevision-ai-v2` a la zona de despliegue manual.
5. Netlify conservará el mismo proyecto y la misma dirección.

## Configurar Resend
En Netlify:
1. Abrí **Project configuration**.
2. Entrá en **Environment variables**.
3. Agregá:
   - `RESEND_API_KEY`: la API key creada en Resend.
   - `RESEND_FROM_EMAIL`: opcional. Usá una dirección de un dominio verificado en Resend.
4. Volvé a desplegar la aplicación.

### Prueba inicial
Si todavía no verificaste un dominio:
- Podés dejar `RESEND_FROM_EMAIL` sin configurar.
- La función usará `onboarding@resend.dev`.
- Resend normalmente limita este modo de prueba al email asociado a tu propia cuenta.

## Cotizaciones
La aplicación no extrae automáticamente datos de BYMADATA. Permite:
- abrir BYMADATA;
- copiar precios manualmente;
- importar un CSV;
- guardar fuente, moneda, fecha y hora;
- detectar precios desactualizados.

Formato:
`ticker,precio,moneda,fecha,fuente`

## Persistencia
Las carteras siguen guardándose en `localStorage` del navegador. Si cambiás de computadora o navegador, usá el botón Backup JSON. Para persistencia multiusuario y alertas automáticas con la página cerrada, la siguiente mejora debe incorporar una base de datos.


## Versión 3: memoria permanente

Esta versión agrega almacenamiento en Supabase mediante las Netlify Functions `load-state` y `save-state`.

Variables requeridas en Netlify:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`

La tabla esperada es `public.app_state`, con una fila identificada por `storage_key = main`. El navegador mantiene `localStorage` como respaldo y migra automáticamente los datos la primera vez que Supabase está vacío.
