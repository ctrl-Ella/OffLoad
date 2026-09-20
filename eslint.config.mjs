import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // --- Accesibilidad ---
      // core-web-vitals ya trae jsx-a11y, pero varias reglas clave vienen
      // como aviso. Un aviso en una hackaton es un aviso que nadie lee:
      // estas se elevan a error porque rompen el uso con teclado o lector.
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/no-autofocus": "error",
      "jsx-a11y/role-has-required-aria-props": "error",

      // --- Fail fast ---
      // Un `catch {}` vacio convierte un fallo en un silencio, que es la
      // forma mas cara de enterarse de un problema.
      "no-empty": ["error", { allowEmptyCatch: false }],

      // --- Observabilidad ---
      // Nada de `console`: el registro va por `src/lib/registro.ts`, que emite
      // JSON. Un console.log con texto libre no se puede filtrar ni
      // correlacionar en produccion, y los que se cuelan en desarrollo se
      // quedan ahi para siempre. Que falle en CI y no en una review.
      "no-console": "error",

      // --- Tipos ---
      // `any` apaga el compilador justo donde mas falta hace. Si de verdad no
      // se conoce el tipo, `unknown` obliga a comprobarlo antes de usarlo.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  {
    // El banco de pruebas es una herramienta de linea de comandos: su informe
    // por consola es su producto, no un resto de depuracion. El resto de reglas
    // le siguen aplicando, porque es material que se lee desde fuera.
    files: ["bench/**/*.ts"],
    rules: {
      "no-console": "off",
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Codigo generado por Prisma: no es nuestro y cambia en cada `generate`.
    "src/generated/**",
    // Material interno del equipo, fuera de git: el brief, los archivos de
    // referencia y los audios del banco, que son la voz de una persona real.
    "docs-internos/**",
    // Dependencias del banco, que es un paquete npm aparte.
    "bench/node_modules/**",
  ]),
]);

export default eslintConfig;
