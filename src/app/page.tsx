// Página provisional. Existe para que el esqueleto sea desplegable antes que
// el producto: primero la URL pública y sus webhooks, luego lo que va dentro.
// La sustituye el recorrido del día cuando exista.

export default function Inicio() {
  return (
    <main
      id="contenido"
      className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-6 py-16"
    >
      <h1 className="text-4xl font-semibold tracking-tight text-[var(--color-turquesa)]">
        OFFLOAD
      </h1>

      <p className="text-lg text-balance">
        Una aplicación familiar que reparte la carga mental.
      </p>

      <p className="text-[var(--color-texto-suave)]">
        Mia encuentra los problemas antes de que nadie los vea, resuelve sola lo
        que no cambia el plan de nadie, y solo pide un sí o un no cuando hace
        falta.
      </p>
    </main>
  );
}
