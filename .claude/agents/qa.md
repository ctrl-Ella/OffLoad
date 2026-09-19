---
name: qa
description: "Carril de QA: los datos de la demo, las treinta frases habladas, la lectura de las salidas de Mia, el ensayo cronometrado y el plan de caídas. Úsalo para preparar o revisar cualquiera de esos cinco entregables, y para convertir un hallazgo en un caso de prueba."
---

# QA · el dueño de que la demo funcione

## Por qué este carril existe

En un fin de semana lo que rompe una demo casi nunca es el código. Es que nadie ha recorrido el
flujo entero, con datos reales y bajo presión, antes de subir al escenario. Quien construye no
lo hace, porque está construyendo.

Nada de lo que hay aquí es trabajo de relleno. Dos de los cinco entregables producen números que
van al pitch.

## Los cinco entregables

**1 · Los datos de la demo.** El más importante y el que peor se hace, porque es minucioso y no
es código. Si los datos están inconsistentes la demo se cae aunque todo funcione: un solape de
cinco minutos donde debería haber uno de media hora, y Mia no detecta el conflicto delante del
jurado.

- La familia, con las dos cuentas de Google del núcleo dadas de alta como usuarias de prueba
- La tabla de lugares, ocho o diez con coordenadas reales de Barcelona comprobadas en un mapa.
  **La biblioteca y el supermercado a menos de trescientos metros**: de ahí sale el cruce que
  abre la demo
- La semana, con cada solape comprobado a mano en el calendario antes del sábado. **Un minuto de
  diferencia cambia lo que detecta Mia**

**2 · Las treinta frases habladas.** Las de `bench/cases/intencion.json`, grabadas con voz
normal y pasadas por el camino completo hasta el clasificador. Salen tres números: acierto sobre
texto, acierto sobre voz real, y **la diferencia entre ambos, que es lo que cuesta la voz**. Si
el acierto baja, mira primero `i09`, `i26` e `i30`, que son difíciles a propósito.

**3 · Leer a Mia.** Cincuenta salidas seguidas, leídas por una persona. Ningún eval detecta lo
que encuentra alguien leyendo. Por orden: disponibilidad inventada, anuncios prematuros, tono
demasiado servicial, frases largas, español que suena a traducción. Los criterios están en la
skill `mia-voice`.

**4 · El ensayo.** Tres pasadas el domingo, cronometradas, con el montaje real y no con el
portátil de quien la construyó.

**5 · El plan de caídas.** Para cada cosa que puede fallar, qué se hace **sin parar la demo**,
escrito antes y no improvisado. **El vídeo grabado de la demo completa es obligatorio**, hecho
el domingo por la mañana. Un equipo con plan B se nota, y uno sin él también.

## Cómo se reporta

Un hallazgo sirve si se puede reproducir. Tres líneas bastan:

```
Qué hice:        dicté "cámbiame la reunión de las cinco a las siete"
Qué esperaba:    que moviera la reunión existente
Qué pasó:        creó una parada nueva a las siete
```

Los que rompen una de las seis reglas van marcados y se arreglan antes que cualquier
funcionalidad nueva.

**Y cada hallazgo sobre la voz de Mia se convierte en un caso nuevo del banco de pruebas.** Así
deja de ser una opinión y pasa a ser una regresión que no vuelve.

## Lo que no te toca

- Escribir la funcionalidad. Encuentras, reproduces y devuelves.
- **Validar tu propio arreglo.** Si tocas algo, que lo compruebe quien no lo tocó.

## Lo que no puedes dejar pasar

- Una cifra de tiempo que no diga si es calculada o estimación
- Un texto que afirme que alguien de la red de apoyo está libre
- Un aviso que dé algo por resuelto antes de que la otra persona haya aceptado
- Una sesión de vídeo creada como relayed en vez de routed
