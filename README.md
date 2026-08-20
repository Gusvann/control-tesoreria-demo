# Control de Tesorería — Demo

Dashboard demostrativo para consultar la posición diaria de caja, proyectar entradas y salidas y revisar próximos movimientos desde una sola pantalla.

> **Todos los datos, instituciones, cuentas, importes y conceptos son completamente simulados.** Este repositorio no contiene información de empleadores, clientes ni operaciones reales.

## Problema que resuelve

En muchas operaciones de tesorería, la información se encuentra distribuida entre portales bancarios, hojas de cálculo y reportes internos. Esta demo muestra una forma sencilla de reunir lo esencial para responder cuatro preguntas:

1. ¿Cuánto efectivo está disponible hoy?
2. ¿Qué cobros y pagos se esperan dentro del periodo?
3. ¿Cuál sería el saldo al final del escenario?
4. ¿En qué fecha aparece el punto de menor liquidez?

## Funcionalidades

- Posición bancaria consolidada en MXN.
- Indicadores de saldo disponible, cobros, pagos y saldo proyectado.
- Horizonte seleccionable de 7, 14 o 30 días.
- Escenario con o sin movimientos por confirmar.
- Gráfica de evolución del saldo.
- Identificación del saldo mínimo y de la mayor salida.
- Agenda de próximos movimientos con estatus.
- Diseño adaptable para escritorio y dispositivos móviles.

## Diseño

- **Sora:** títulos, encabezados, cifras e indicadores.
- **Public Sans:** textos, tablas, etiquetas y controles.
- Titular dividido: la primera frase plantea la idea en tinta oscura y la segunda enfatiza el resultado en azul.

## Tecnologías

- HTML5
- CSS3
- JavaScript sin frameworks
- SVG generado con JavaScript para la gráfica

## Cómo ejecutarlo

No requiere instalación ni proceso de compilación.

1. Clona o descarga el repositorio.
2. Abre la carpeta en tu editor.
3. Ejecuta `index.html` con un servidor local, por ejemplo **Live Server** en Visual Studio Code.

También puede publicarse como sitio estático mediante GitHub Pages.

## Estructura

```text
.
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Criterio financiero

La aplicación no busca reemplazar un TMS o ERP. Su propósito es demostrar cómo una vista mínima puede ordenar información de tesorería y facilitar decisiones operativas sobre liquidez, pagos y cobranza.

## Autor

**Iván Mota Cruz**  
Tesorería · Gestión financiera · Automatización
