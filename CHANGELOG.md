# Registro de cambios

Qué ha cambiado en OFFLOAD, en orden inverso: lo último, arriba.

Cada pull request añade aquí una línea antes de pedir revisión. Está en la lista de comprobación de la plantilla, y el motivo es que un registro escrito al final del proyecto se escribe de memoria, y la memoria a las tres de la madrugada inventa.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/), y los tipos de cambio son los mismos que los de los commits.

---

## Sin publicar

### Añadido

- Imagen de producción y guía de despliegue en Railway: `Dockerfile` de cuatro etapas con usuario sin privilegios, `.dockerignore`, salida `standalone` de Next y la ruta `/api/health`.
- README del repositorio, con distintivos de estado de la integración continua, las issues y las pull requests abiertas.
- Esqueleto de la aplicación: configuración de TypeScript, Next.js, Tailwind y ESLint, esquema de Prisma y una página provisional. Con esto el proyecto ya se puede construir y desplegar.
- Andamiaje del proyecto: instrucciones para las sesiones de Claude Code, agentes por carril, flujo de trabajo, plantillas de issue y de pull request, etiquetas e integración continua.

### Cambiado

- La aprobación obligatoria de las pull requests pasa a cero en `main` y en `dev` mientras dure la hackatón. Siguen exigiéndose la pull request y la integración continua en verde. Que otra persona revise sigue siendo el acuerdo del equipo, ahora sin una máquina que lo compruebe.

### Corregido

- La integración continua fallaba al generar el cliente de Prisma. `prisma.config.ts` resuelve `DATABASE_URL` al cargarse, así que la variable de relleno pasa a estar a nivel de job y no solo en el paso de construir.
