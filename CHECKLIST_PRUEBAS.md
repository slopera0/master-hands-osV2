# Checklist rápida de pruebas — Master Hands Acoustic OS v2

Segunda ronda: ya corregí los hallazgos de tu primera prueba (ver README, sección 7).
Marca cada ítem con [y]/[n] igual que la vez pasada y cuéntame si algo sigue fallando.

## 1. Arranque
- [y ] `npm install` termina sin errores.
- [y ] `npm start` muestra la URL local y la de red LAN.
- [ y] Al abrir `http://localhost:4000`, aparece la pantalla de "Configuración inicial".

## 2. Cuenta y acceso
- [ y] Crear la cuenta admin funciona.
- [y ] **Ya no debería aparecer el aviso de Chrome de "guardar contraseña" al escribir en el BOM ni en la calculadora.** Confírmalo específicamente.
- [y ] Cambiar la contraseña y ver la sesión activa en "Mi Cuenta" funciona.

## 3. Proyecto de prueba
- [y ] Crear proyecto, escribir datos del cliente, que se guarden.
- [y ] Cambiar L/W/H y ver que área/volumen se recalculen solos.
- [y ] Buscar el proyecto por nombre en la lista.

## 4. Simulador 3D
- [y ] La sala rota bien con el mouse/dedo.
- [ y] **Nuevo: botón "Tema claro" en la barra del 3D — pruébalo y dime si se ve bien.**
- [y ] "Ver modos de presión" y "Capturar render PNG" funcionan.

## 5. Calculadora y BOM
- [n ] **Repetir la prueba que falló antes: cambiar la frecuencia en la calculadora debe actualizar la longitud de onda al instante, sin recargar nada.**
- [ y] **Nuevo: botón "📋 Catálogo de materiales" junto a "+ Ítem en blanco" — ábrelo y agrega un par de ítems con el botón "+".**
- [y ] Agregar/quitar ítems del BOM actualiza el precio total sin que Chrome interrumpa con avisos.

## 6. Generador de tonos
- [ y] Tono puro, barrido y ruido rosa suenan.

## 7. Archivos
- [y ] Subir una foto genera miniatura; descargarla trae el archivo completo.

## 8. Propuesta, firma y PDF
- [y ] Cargar la plantilla, dibujar y guardar la firma. Te adjunto el pdf porque deberia quedar todo en una misma pagina para que no quede cortado
- [ y] **Exportar a PDF: ahora debe incluir la firma dibujada, el nombre del firmante y el aviso legal al final del documento — confírmalo.**

## 9. Estado del Sistema
- [ y] Contadores y "Respaldar ahora" funcionan. Hay un contador que dice que llevamos 49 cotizaciones y no hay nada.

## 10. Móvil (importante, revisar en celular o achicando la ventana del navegador)
- [ y] **Nuevo: debe aparecer un botón de menú (☰) arriba a la izquierda en pantallas angostas.** pero no funciona como menu de hamburgeusa se queda estatico y no se queda sobre la izquierda entonces se queda viendo mal, la pagina no es responsive asi que no se adapta a la pantalla del celular
- [y ] Al tocarlo, el menú se desliza desde la izquierda con un fondo oscuro detrás.
- [ n] Al elegir una opción del menú, este se cierra solo y se ve el contenido de inmediato (sin tener que hacer scroll).

---

Si algo falla, dime: en qué paso, qué esperabas ver, qué viste, y si la consola del
navegador (F12 → Console) muestra algún mensaje en rojo.
