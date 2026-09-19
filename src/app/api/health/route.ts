/**
 * Comprobación de salud del servicio.
 *
 * La usa el `HEALTHCHECK` de la imagen y la usa Railway para saber si el
 * despliegue ha subido bien. Responde siempre rápido y sin depender de nada
 * externo que pueda tardar: una comprobación lenta se interpreta como caída.
 *
 * ALCANCE DE HOY
 * Dice que el proceso está vivo y sirviendo peticiones, y nada más. Todavía no
 * comprueba Postgres porque el cliente de la aplicación aún no existe.
 *
 * Cuando exista, esta ruta tiene que hacer una consulta real: la aplicación
 * puede estar arriba con la base de datos caída, y ese es justo el caso que una
 * comprobación de salud debe cazar. Mientras tanto, no afirma nada que no sepa.
 */

// Sin caché: una respuesta de salud guardada es una respuesta que ya no informa.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    ok: true,
    servicio: "offload",
    baseDeDatos: "sin comprobar",
    momento: new Date().toISOString(),
  });
}
