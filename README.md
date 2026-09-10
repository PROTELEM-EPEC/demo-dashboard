# Demo — Plataforma de Clientes EPEC

Recorrido completo mockeado del tablero (Inicio, Mi Factura, Mi Cuenta), con
datos reales de consumo y facturación de un cliente real de EPEC.

Los kWh, importes, fechas y hojas de factura son reales, tal como salieron del
extracto de facturación (SIGEC). "Mi Factura" muestra **3 facturas vencidas**:
el período actual del escenario y los dos anteriores, mostrados como pendientes
a pedido aunque en el snapshot real ya estén pagados. Al seleccionar una en el
nivel 2, la versión interactiva de esa misma factura aparece abajo.

Este link entra siempre por el **nivel 1** (la vista pública, sin sesión):
desde ahí se puede pasar al nivel 2 (el tablero) con el botón de acceso.

No es un entorno productivo: es un artefacto de build estático, publicado a
mano desde el repositorio interno del proyecto, sin backend ni base de datos
detrás.
