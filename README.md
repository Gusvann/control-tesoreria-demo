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

## Selección, filtros y edición de movimientos

En **Próximos movimientos** puedes buscar por concepto y filtrar por tipo, estatus y rango de fechas. **Mostrar → Todos los movimientos** permite recuperar movimientos históricos, fuera del horizonte o por confirmar que no están incluidos en la proyección. Los filtros de la tabla no alteran los indicadores ni la gráfica.

- Marca las casillas de las filas; la casilla de cabecera selecciona todos los resultados visibles.
- Usa **Editar seleccionados** para aplicar una nueva fecha, un nuevo estatus o ambos. En lote, marca únicamente los campos que quieras cambiar.
- Haz doble clic sobre una fila o usa **Editar** para cambiar un movimiento individual. También hay un botón Editar en la lista de captura.
- Revisa el número de movimientos que se actualizarán y pulsa **Guardar cambios**. **Cancelar** y Escape descartan el borrador.
- Al cambiar filtros, horizonte o vista se limpia la selección. Seleccionar no cambia el estatus de un movimiento.
- Una nueva fecha debe ser válida y no anterior a hoy. Puedes cambiar solo el estatus de un movimiento histórico sin modificar su fecha.

El nombre del campo es **estatus del movimiento**: **Confirmado** o **Por confirmar**. La proyección personal conserva sus cambios en este navegador. En **Ver ejemplo**, la edición es temporal y se restablece al recargar.

### Enter durante la captura

Enter en los campos de captura **conserva lo escrito y no registra el movimiento**. Para guardarlo, utiliza **Agregar movimiento**; el botón también puede activarse con el teclado. Un error de validación o almacenamiento conserva el borrador. Después de un registro explícito correcto, el formulario vuelve a estar listo para el siguiente movimiento.

## Verificación del cambio

Con Node.js instalado, ejecuta:

```bash
node --check app.js
node tests/movements.test.cjs
```

No se necesitan dependencias para las pruebas. Consulta [la especificación](docs/movement-editing-spec.md) y [la evidencia de verificación](docs/movement-editing-verification.md) para conocer el alcance y los límites de las comprobaciones.

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


## Escala de la gráfica

La escala vertical se construye a partir del **saldo mínimo y máximo acumulado de la proyección**, no del tamaño aislado de cada cobro o pago.

- **Automática:** agrega un margen visual aproximado de 12 %, redondea límites e intervalos a cifras financieras legibles y muestra el cero únicamente cuando aporta contexto de riesgo o los saldos son pequeños.
- **Desde cero:** mantiene el cero como referencia para dimensionar la magnitud total de la caja.
- Utiliza entre cuatro y cinco marcas principales cuando el rango lo permite.
- No fuerza simetría entre valores positivos y negativos.
- Cuando el escenario personal no contiene saldos ni movimientos, muestra un estado vacío en lugar de una escala arbitraria.

