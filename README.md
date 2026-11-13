# Simulador de transporte · ventilación, monitor y RCP

Simulador docente para SVA terrestre y HEMS: ventilación mecánica invasiva y no invasiva, oxigenoterapia y alto flujo, monitor-desfibrilador (desfibrilación, cardioversión sincronizada, DEA, marcapasos), fármacos y RCP.

**Abrir el simulador:** https://davidrope93-svg.github.io/simulador-transporte/

Funciona en el navegador del ordenador, la tablet o el móvil, sin instalar nada y sin conexión una vez cargado.

## Equipos

| Equipo | Qué reproduce |
|---|---|
| Ventilador estilo Monnal T60 | Turbina, cmH₂O. Modos (A)VCV, (A)PCV, PRVC, PSV y CPV para RCP; CPAP VNI, PSV VNI y (A)PCV VNI; oxigenoterapia de alto flujo. Rueda de control (tocar el mando, girar y pulsar para validar), O₂ 100 %, pausas inspiratoria y espiratoria, congelar, bloqueo, silencio 2 min, espera. Pantalla de inicio con sexo y talla (peso predicho) y preajuste de emergencia. |
| Ventilador estilo Medumat Standard² | Neumático, mbar. IPPV, BiLevel + ASB, PRVC + ASB, CPAP + ASB, CPR; en mascarilla RSI con Demand y Manual, CPAP y aPCV. Tres mandos giratorios (izquierdo Vt o presión, central frecuencia, derecho el resto), Air Mix / 100 % O₂, pMax que limita la presión sin cortar la inspiración, parada si se acaba el gas y consumo propio. |
| Ventilador estilo Hamilton T1 | Turbina, cmH₂O. APVcmv, PCV+, SPONT, ASV; NIV y NIV-ST; HiFlowO2. Mando de pulsar y girar (tocar el control, girar, confirmar), O₂ enrichment, respiración manual (mantenida = pausa inspiratoria), nebulizador. Valores calculados en cada ciclo (Pplateau, AutoPEEP, Cstat, Rinsp, RCexp); presión aplicada limitada a Pmax − 10. |
| Monitor estilo ZOLL X Series y corpuls3 | ECG con motor de latidos (sinusal, TSV, FA, flutter, TV, BAV, AESP, FV, asistolia, ritmo estimulado), pletismografía, capnografía, PNI manual y automática, SpCO, feedback de RCP, desfibrilación manual, SINC con marcadores sobre la onda R, DEA con análisis y aviso de movimiento, marcapasos a demanda o fijo, marcadores de evento y tendencias. |

Cada ventilador tiene sus alarmas con límites ajustables (botón Auto), silencio, sonido, curvas o bucles P-V y F-V, y los cambios quedan pendientes hasta confirmarlos (se descartan a los 20 s). Tras intubar, el ventilador queda en espera: hay que revisar los datos del paciente y pulsar «Iniciar ventilación».

Diseño propio: las pantallas siguen la lógica de manejo de cada equipo (modos, nombres, unidades, rangos, teclas, puesta en marcha y alarmas), pero no copian su aspecto ni su software.

## Casos

45 casos más el modo libre, en 8 grupos: VMI en SVA, VMI en HEMS, VMNI, vía aérea, oxigenoterapia e intoxicaciones, arritmias, parada y modo libre. Cada caso tiene objetivos que se colorean en tiempo real, eventos programados, una solución posible y un debrief al terminar (tiempo en objetivo, parada, arritmia, vía aérea, eventos, fármacos y peores valores).

### Añadir o modificar casos

Todos los casos están en [`src/cases.js`](src/cases.js). La cabecera del archivo explica cada campo. Para crear uno nuevo, copia un caso parecido, cambia la clave y los valores, y regenera la página:

```
python3 build.py
```

Eso produce `index.html`, que es lo que publica GitHub Pages. Si editas directamente en la web de GitHub, puedes pedirle a Claude que regenere `index.html` y lo suba.

En el Medumat, además de los modos del motor, la interfaz usa `DEM` (RSI · Demand) y `MAN` (RSI · Manual).

## Estructura

| Archivo | Contenido |
|---|---|
| `src/model.js` | Motor fisiológico: pulmón unicompartimental, esfuerzo del paciente, fuga de mascarilla, intercambio de gases con shunt y V/Q, farmacocinética simplificada, hemodinámica, RCP, arritmias y marcapasos. |
| `src/devices.js` | Definición de cada ventilador y monitor: modos, mandos, rangos, teclas, preajustes y nombres de alarma. |
| `src/cases.js` | Casos clínicos. |
| `src/ui.js` | Interfaz: pantallas, mandos, alarmas, acciones, fármacos, lectura y debrief. |
| `src/template.html` | Maquetación y estilos. |
| `build.py` | Une todo en `index.html`. |

## Supuestos sin confirmar en la documentación pública

- Air Mix del Medumat ≈ 60 % de FiO₂; Vt del preajuste «Paciente nuevo» 7 mL/kg.
- Vt del Quick setup 1 del T1 8 mL/kg; ASV simplificado.
- Duración de O₂ 100 % del Monnal: 2 min.
- Nombres de modos del Monnal y del Medumat aproximados a las versiones habituales.
- Listas de energía y secuencia del DEA aproximadas; probabilidades de éxito de descarga, cardioversión y RCE orientativas.
- Tiempo de descarte de cambios sin confirmar: 20 s, genérico.

## Fuentes de referencia

Guía rápida y especificaciones técnicas del Hamilton T1; manual de usuario del Monnal T60; instrucciones de uso del Medumat Standard²; especificaciones del ZOLL X Series; folletos del corpuls3. Recomendaciones ERC de soporte vital avanzado.

## Aviso

Herramienta docente. Valores y dosis orientativos (dosis de referencia para adulto, calculadas con el peso del caso). No sustituye al manual del equipo, a los protocolos del servicio ni al juicio clínico.
