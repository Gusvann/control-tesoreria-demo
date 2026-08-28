# Control de Tesorería — Demo y proyección interactiva

Dashboard demostrativo para consultar la posición diaria de caja y crear una proyección propia desde cero.

> La vista de ejemplo utiliza datos completamente simulados. La información capturada por cada visitante se guarda únicamente en su navegador mediante `localStorage`; no se envía a servidores, bases de datos, Google Sheets ni APIs.

## Flujo de uso

### 1. Ver ejemplo

La página abre con un escenario demostrativo para explicar cómo leer:

- saldo disponible;
- cobros y pagos del periodo;
- saldo proyectado;
- saldo mínimo;
- movimientos confirmados y por confirmar;
- evolución de la liquidez a 7, 14 o 30 días.

### 2. Crear mi proyección

El CTA **Crear mi proyección** cambia a un escenario personal que comienza en cero. La persona puede:

- indicar el número de bancos;
- nombrar cada banco;
- capturar el saldo inicial por banco;
- registrar cobros y pagos;
- asignar fecha, concepto, importe y estatus;
- incluir o excluir movimientos por confirmar;
- revisar el forecast desde la fecha actual;
- borrar la proyección y comenzar de nuevo.

## Criterios del proyecto

- La fecha inicial siempre corresponde al día en que se abre la aplicación.
- Los movimientos no pueden registrarse con fecha anterior al día actual.
- El saldo inicial total se calcula a partir de la suma de los saldos bancarios.
- La proyección es completamente client-side.
- No requiere usuarios, contraseñas ni instalación.

## Diseño

- **Sora:** títulos, encabezados, cifras, indicadores y métricas.
- **Public Sans:** textos, tablas, etiquetas, formularios, botones y navegación.
- **Titular dividido:** primera frase en tinta oscura y segunda frase en azul.

## Tecnologías

- HTML5
- CSS3
- JavaScript sin frameworks
- SVG generado con JavaScript para la gráfica
- `localStorage` para persistencia local

## Ejecución

No requiere compilación.

1. Clona o descarga el repositorio.
2. Abre la carpeta en tu editor.
3. Ejecuta `index.html` con un servidor local, por ejemplo **Live Server**.

También puede publicarse mediante GitHub Pages.

## Estructura

```text
.
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Autor

**Iván Mota Cruz**  
Tesorería · Gestión financiera · Automatización
