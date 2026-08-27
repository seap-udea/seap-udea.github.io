# Viaje a las estrellas

Simulador interactivo de **cinemática relativista en una dimensión**: el puente
de mando de una nave que viaja entre las estrellas con aceleración propia
constante por tramos.

Por [Jorge I. Zuluaga](https://jorgezuluaga.github.io) · [Dr. Z Academy](https://drz.academy)

> Basado en la Clase 5 (*Cinemática en el espacio-tiempo*) del curso de
> Relatividad y Gravitación de la Universidad de Antioquia, y en el notebook de
> clase *Viaje a las estrellas*.

## Qué hace

El capitán indica **hasta dónde quiere ir** (en años-luz) y divide el viaje en
**tramos**. Cada tramo puede ser:

- **Impulso** — aceleración propia constante, dada en *g* (la gravedad
  terrestre). Puede ser negativa: eso es frenar.
- **Crucero** — velocidad constante (*free casting*), dada en fracciones de *c*,
  o simplemente manteniendo la velocidad que ya se traía.

Y cada tramo termina cuando se cumple una condición a elección:

| Condición | Significado |
| --- | --- |
| Lo que falte del viaje | Se extiende hasta completar la distancia al destino |
| Una distancia dada | En años-luz |
| Un % del viaje | Fracción de la distancia total |
| Un tiempo en la nave | Tiempo propio τ, en años |
| Un tiempo en la Tierra | Tiempo coordenado t, en años |

El tablero devuelve, **para cada tramo y para el total**: distancia recorrida,
tiempo coordenado (el del planeta de salida o de llegada), tiempo propio de la
nave, y velocidad mínima y máxima. Además grafica el perfil de vuelo (distancia,
tiempo coordenado y velocidad) y el diagrama de espacio-tiempo con el cono de
luz.

El plan por defecto es un solo tramo a **1/6 g** hasta **4.2 años-luz**
(Próxima Centauri).

## Planes de vuelo incluidos

- **Impulso continuo** — 1/6 g durante todo el trayecto; se llega a máxima
  velocidad, es decir, de sobrevuelo.
- **Giro a mitad de camino** — 1/6 g la primera mitad y −1/6 g la segunda. Se
  llega en reposo.
- **Un año de impulso** — un año de tiempo propio con motores y el resto en
  caída libre.
- **Impulso · crucero · frenado** — acelera el primer cuarto, navega la mitad
  central y frena el último cuarto.
- **Nave antorcha a 1 g** — gravedad artificial permanente y dilatación
  temporal extrema.
- **Crucero a 0.5 c** — sin motores, como referencia.

Cualquier combinación es posible: se pueden añadir, reordenar y eliminar tramos
libremente. El botón **Compartir plan** copia un enlace que reproduce el plan
completo, útil para dejar un ejercicio al curso.

## La física

Todo se calcula en **unidades luz**: distancias en años-luz (a-l), tiempos en
años (a) y velocidades en fracciones de *c*, de modo que *c* = 1. En esas
unidades una aceleración de 1 g vale

```
α = g · (1 año) / c = 1.0323 a-l/a²
```

Para un tramo con aceleración propia constante α y **condiciones iniciales
arbitrarias** (diapositiva 69 de la clase), la solución general es

```
x_L(τ) = x_L0 + (γ₀ v_L0 / α) sinh(ατ) + (γ₀ / α) [cosh(ατ) − 1]
t(τ)   = t_0  + (γ₀ / α) sinh(ατ) + (γ₀ v_L0 / α) [cosh(ατ) − 1]
v_L(τ) = [v_L0 + tanh(ατ)] / [1 + v_L0 tanh(ατ)]
```

Introduciendo la **rapidez** θ = artanh(v_L), con γ₀ = cosh θ₀ y
γ₀v_L0 = sinh θ₀, las tres expresiones colapsan en una sola idea: la rapidez
crece linealmente con el tiempo propio,

```
θ(τ)   = θ₀ + ατ
x_L(τ) = x_L0 + [cosh θ(τ) − cosh θ₀] / α
t(τ)   = t_0  + [sinh θ(τ) − sinh θ₀] / α
v_L(τ) = tanh θ(τ)
```

`src/lib/relativity.ts` integra en θ y no en v_L: es la variable que se mantiene
finita y bien condicionada aun cuando la velocidad es indistinguible de 1 en
punto flotante (viajar a Andrómeda a 1 g da γ ≈ 1.3 × 10⁶). Por eso el reporte
puede mostrar velocidades como `1 − 2.92×10⁻¹³ c` sin perder cifras.

Invertir las ecuaciones para saber cuánto dura un tramo también es directo en
esta variable:

- **Hasta una distancia Δx:** cosh θ₁ = α Δx + cosh θ₀.
- **Hasta un tiempo coordenado Δt:** sinh θ₁ = α Δt + sinh θ₀.
- **Hasta un tiempo propio Δτ:** θ₁ = θ₀ + α Δτ.

Un tramo de crucero es el caso α = 0, donde simplemente Δt = γ Δτ.

Cuando un tramo pide algo imposible —frenar más de lo que la distancia
permite, por ejemplo— la computadora de a bordo lo marca en rojo y explica por
qué, en vez de devolver un `NaN`.

### El cielo por la ventana

El visor no es decorativo: aplica las dos consecuencias ópticas de viajar cerca
de *c*.

- **Aberración relativista**, cos θ′ = (cos θ + v) / (1 + v cos θ): las
  estrellas se apiñan hacia la proa a medida que la nave acelera.
- **Efecto Doppler**, D = 1 / [γ (1 − v cos θ′)]: la luz de proa se corre al
  azul y la de popa al rojo.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000/apps/star-trek/
npm run build   # exporta a out/
npm run lint
```

La app se publica como export estático bajo `/apps/star-trek/` en
[seap-udea.github.io](https://seap-udea.github.io/apps/star-trek/).

## Estructura

```
src/
  app/
    globals.css              Tema del puente de mando
    layout.tsx  page.tsx
  components/
    StarshipBridge.tsx       Tablero completo: plan, reporte y reproductor
    Starfield.tsx            Campo estelar con aberración y Doppler
    FlightCharts.tsx         Perfil de vuelo y diagrama de espacio-tiempo
    NumberField.tsx          Campo numérico tolerante a lo que se escribe
  lib/
    relativity.ts            Motor de cinemática relativista
    flightPlans.ts           Destinos, planes típicos y enlaces compartibles
```
