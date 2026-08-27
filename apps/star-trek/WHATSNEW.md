# Novedades — Viaje a las estrellas

Registro de cambios por versión. La app está en [seap-udea.github.io/apps/star-trek](https://seap-udea.github.io/apps/star-trek/).

---

## 0.1.0

Primera versión.

### Plan de vuelo

- El capitán fija el **destino** en años-luz, con una lista de objetivos reales
  desde Próxima Centauri (4.2 a-l, el valor por defecto) hasta Andrómeda.
- El viaje se divide en **tramos** de dos tipos: **impulso** con aceleración
  propia constante en *g* (positiva o negativa) y **crucero** a velocidad
  constante en fracciones de *c*, que puede heredar la velocidad ya alcanzada.
- Cada tramo termina según una de cinco condiciones: lo que falte del viaje, una
  distancia, un porcentaje del trayecto, un tiempo propio de la nave o un tiempo
  coordenado en la Tierra.
- Seis **planes de vuelo típicos** listos para usar, empezando por el tramo
  único a 1/6 g.
- Los tramos se pueden añadir, reordenar y eliminar; **Compartir plan** copia un
  enlace que reproduce el vuelo completo.

### Reporte de vuelo

- Totales del viaje: distancia cubierta, reloj en la Tierra, reloj de la nave,
  tiempo que la tripulación no envejece, velocidad máxima y factor de Lorentz
  máximo.
- **Bitácora por tramo** con distancia, tiempo coordenado, tiempo propio y
  velocidad mínima y máxima de cada etapa.
- Avisos cuando el plan se queda corto, se pasa de largo o llega a velocidad de
  sobrevuelo; los tramos imposibles (frenar más de lo que la distancia permite)
  se marcan y se explican.
- **Perfil de vuelo** con distancia, tiempo coordenado y velocidad, graficables
  contra el tiempo de la nave o el de la Tierra, y **diagrama de espacio-tiempo**
  con el cono de luz.

### Puente de mando

- Ventanal con campo estelar y nebulosas que aplica **aberración relativista** y
  **efecto Doppler** reales: las estrellas se apiñan hacia la proa y se corren al
  azul a medida que la nave acelera.
- Reproductor del viaje con lectura en vivo de velocidad, factor de Lorentz,
  distancia recorrida y ambos relojes.
- Diseño adaptado a teléfonos: la bitácora se convierte en tarjetas y los
  gráficos se redibujan al ancho disponible.

### Motor de cálculo

- Solución exacta del movimiento con aceleración propia constante y condiciones
  iniciales arbitrarias, integrada en **rapidez** para no perder precisión a
  velocidades ultrarrelativistas.
