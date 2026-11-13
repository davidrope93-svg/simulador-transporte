# Simulador de transporte · ventilación, monitor y RCP

Simulador docente para SVA terrestre y HEMS: ventilación mecánica invasiva y no invasiva, oxigenoterapia y alto flujo, monitor-desfibrilador (desfibrilación, cardioversión sincronizada, DEA, marcapasos), fármacos y RCP.

**Abrir el simulador:** https://davidrope93-svg.github.io/simulador-transporte/

Funciona en el navegador del ordenador, la tablet o el móvil, sin instalar nada y sin conexión una vez cargado.

## Equipos

| Equipo | Qué reproduce |
|---|---|
| Ventilador estilo Monnal T60 | Turbina, cmH₂O. Modos (A)VCV, (A)PCV, PRVC, VSIMV, PSIMV, PSV y CPV para RCP (PH y PL sincronizadas con las compresiones, con fase RCE); CPAP VNI, PSV VNI y (A)PCV VNI; oxigenoterapia de alto flujo. Rueda de control (tocar el mando, girar y pulsar para validar), O₂ 100 %, pausas inspiratoria y espiratoria, congelar, bloqueo, silencio 2 min, espera. Pantalla de inicio con sexo y talla (peso predicho), preajuste de emergencia y de preoxigenación. En VMNI la PS no pasa de 25. |
| Ventilador estilo Medumat Standard² | Neumático, mbar. IPPV, SIMV + ASB, BiLevel + ASB, PRVC + ASB, CPAP + ASB, CPR (30:2 con MEDUtrigger y metrónomo, o continua a 10/min); en mascarilla RSI con Demand y Manual, CPAP y aPCV; preajuste RSI → IPPV. Relación I:E en lugar de Ti. Tres mandos giratorios (izquierdo Vt o presión, central frecuencia, derecho el resto), Air Mix / 100 % O₂, pMax que limita la presión sin cortar la inspiración, parada si se acaba el gas, alarma de suministro que no se silencia y consumo propio. |
| Ventilador estilo Hamilton T1 | Turbina, cmH₂O. APVcmv, APVsimv, PCV+, PSIMV+, SPONT, ASV; NIV y NIV-ST; HiFlowO2. Mando de pulsar y girar (tocar el control, girar, confirmar), O₂ enrichment, respiración manual (mantenida = pausa inspiratoria), nebulizador. Valores calculados en cada ciclo (Pplateau, AutoPEEP, Cstat, Rinsp, RCexp); P-ramp en ms (hasta 200 en modos espontáneos); presión aplicada limitada a Pmax − 10. |
| Monitor estilo ZOLL X Series y corpuls3 | ECG con motor de latidos (sinusal, TSV, FA, flutter, TV, BAV, AESP, FV, asistolia, ritmo estimulado), pletismografía, capnografía, PNI manual y automática (1–60 min), SpCO, feedback de RCP con pausas 30:2 o 15:2, desfibrilación manual, SINC con marcadores sobre la onda R, DEA con análisis y aviso de movimiento, marcapasos a demanda o fijo (y sobreestimulación en el corpuls3), marcadores de evento y tendencias. |

Cada ventilador tiene sus alarmas con límites ajustables (botón Auto), silencio, sonido, curvas o bucles P-V y F-V, y los cambios quedan pendientes hasta confirmarlos (se descartan a los 20 s). Tras intubar, el ventilador queda en espera: hay que revisar los datos del paciente y pulsar «Iniciar ventilación».

Diseño propio: las pantallas siguen la lógica de manejo de cada equipo (modos, nombres, unidades, rangos, teclas, puesta en marcha y alarmas), pero no copian su aspecto ni su software.

## Casos

58 casos más el modo libre, en 11 grupos: VMI en SVA, VMI en HEMS, VMNI, vía aérea, oxigenoterapia e intoxicaciones, pediatría, trauma y obstetricia, metabólico y ambiental, arritmias, parada y modo libre. Los casos propios aparecen en «Mis casos». Cada caso arranca a la velocidad que le corresponde (×1 en parada, ×5 en arritmias, ×10 en el resto; al entrar en parada pasa a ×1) y tiene objetivos que se colorean en tiempo real, eventos programados, una solución posible y un debrief al terminar (tiempo en objetivo, parada, arritmia, vía aérea, eventos, fármacos y peores valores).

## Para no perderse

- **Guía**: un recorrido de 13 pasos por la pantalla que sale la primera vez y se repite con el botón «Guía».
- **Siguiente paso**: un recuadro flotante con el problema más urgente y el botón «Dónde se hace», que lleva al mando exacto y lo hace parpadear (abre el grupo de fármacos y, en el móvil, cambia de pestaña). Se pliega con ▾ y desaparece en el modo examen.
- **«Dónde»** junto a cada recomendación de la Lectura.
- **Buscar** (botón o tecla /): se escribe lo que se quiere hacer («calcio», «PEEP», «intubar», «cardioversión», «vía») y con Enter se hace o se va al mando.
- **Guíame en este caso**: un tutorial opcional, solo si uno se pierde. Se activa con el botón de la tarjeta del caso o desde el ayudante (que lo ofrece tras un minuto sin tocar nada). Dice el siguiente paso de ese caso concreto con su porqué, señala el mando y avanza solo cuando el paso está hecho; se puede saltar un paso o salir en cualquier momento. Baja la velocidad a ×5, queda anotado en el informe y en el historial («con tutorial») y no está disponible en el modo examen. Los casos propios tienen un tutorial generado a partir de sus acciones clave y objetivos.

## Docencia

- **Modo examen**: oculta la Lectura, la solución y el color de los objetivos; al terminar da una nota sobre 10 con tiempo en objetivo, acciones clave del caso, parada (fracción de compresión, primera descarga, RCE) y seguridad (desaturación, paradas provocadas, eventos sin resolver).
- **Vista del instructor**: botón «Vista del instructor» (se abre en otra ventana del mismo equipo y se conecta sola) o «Enlazar instructor» con un código de 5 caracteres para otro dispositivo (WebRTC con PeerJS; la librería se carga solo al usarlo). El instructor carga casos, provoca eventos, pausa, cambia la velocidad, pasa a examen, manda mensajes al alumno y ve los valores reales, la Lectura y la evolución.
- **Debrief** con línea de tiempo (SpO₂, EtCO₂, TAS y FC con fármacos, acciones, eventos y descargas marcados), exportable a PDF.
- **Historial** de intentos por alumno, guardado en el dispositivo y exportable a CSV.
- **Editor de casos** sin tocar código: paciente, fisiología, ajustes iniciales, eventos, objetivos, acciones clave y textos; guarda en el dispositivo, exporta e importa JSON y genera un enlace que carga el caso al abrirlo.
- **Móvil** con pestañas (Ventilador, Monitor, Acciones, Caso) y aviso de alarma en la pestaña; **vista de proyector** para tablet en horizontal o pantalla grande.

### Añadir o modificar casos

Todos los casos están en [`src/cases.js`](src/cases.js). La cabecera del archivo explica cada campo. Para crear uno nuevo, copia un caso parecido, cambia la clave y los valores, y regenera la página:

```
python3 build.py
```

Eso produce `index.html`, que es lo que publica GitHub Pages. Si editas directamente en la web de GitHub, puedes pedirle a Claude que regenere `index.html` y lo suba. Para un caso suelto no hace falta: el editor de la propia página exporta el JSON, que se puede pegar en `src/cases.js`.

Además de los modos del motor, la interfaz usa modos propios de cada equipo que el motor resuelve con otro: `DEM` y `MAN` (RSI del Medumat), `CPR_M` (CPR del Medumat), `CPV_RCE` (fase RCE del Monnal) y `SIMV_V`, `SIMV_P`, `SIMV_A` (SIMV de volumen, presión o volumen con presión regulada).

## Estructura

| Archivo | Contenido |
|---|---|
| `src/model.js` | Motor fisiológico: pulmón unicompartimental, esfuerzo del paciente, fuga de mascarilla, intercambio de gases con shunt y V/Q, farmacocinética simplificada, hemodinámica, RCP, arritmias y marcapasos. |
| `src/devices.js` | Definición de cada ventilador y monitor: modos, mandos, rangos, teclas, preajustes y nombres de alarma. |
| `src/cases.js` | Casos clínicos. |
| `src/ui.js` | Interfaz: pantallas, mandos, alarmas, acciones, fármacos, lectura y debrief. |
| `src/tutor.js` | Tutorial por caso: guion de pasos de cada caso, comprobación de que cada paso está hecho y tutorial generado para los casos propios. Se inserta después de `guide.js`. |
| `src/guide.js` | Orientación: guía paso a paso, «Dónde», ayudante con el siguiente paso y buscador. Se inserta dentro de `ui.js` después de `teach.js`. |
| `src/teach.js` | Docencia: examen y nota, instructor, línea de tiempo, PDF, historial, editor de casos, móvil y proyector. Se inserta dentro de `ui.js` al generar la página. |
| `src/template.html` | Maquetación y estilos. |
| `build.py` | Une todo en `index.html`. |
| `tests/run.js` | Pruebas del motor (`node tests/run.js`): fisiología de referencia, independencia de la velocidad, parada y los 45 casos. GitHub las ejecuta en cada cambio. |

## Pruebas

Cada versión tiene que pasar 75 pruebas con rangos de referencia: regresión de la mecánica, tiempo de desaturación en apnea (sano preoxigenado 7–9,5 min, con aire 0,6–2 min, obeso 2,3–3,6 min) igual a ×1 que a ×20, PaCO₂ en respiración espontánea (TSV, TEP, opiáceos, EPOC con hiperoxia), SpO₂ del EPOC según FiO₂, EtCO₂ durante la RCP, tiempo de acción del relajante, tasas de RCE según se resuelva o no la causa, frecuencia mandatoria en SIMV, fracción de compresión con 30:2, vía aérea no oxigenable con bolsa y supraglótico, drenaje torácico en altitud, deterioro de la TV con pulso y sobreestimulación; y en la v0.7, hiperpotasemia con y sin calcio, hipoglucemia y su recurrencia, QRS de los tricíclicos con bicarbonato, FV en hipotermia, hemorragia con y sin hemostasia (y el coste del volumen liberal), convulsiones de la eclampsia con magnesio, crup, bronquiolitis con alto flujo, constantes de un lactante sano, nueva parada tras la RCE, parada traumática y compensación respiratoria según Winter.

## Cambios en la v0.9

- Tutorial por caso opcional («Guíame en este caso») para los 58 casos y los casos propios, en los tres ventiladores; los pasos que dependen de una tecla que el equipo no tiene (pausa espiratoria en Medumat y T1) se saltan solos.

## Cambios en la v0.8

- Guía paso a paso al entrar por primera vez, botón «Dónde» en la Lectura, ayudante flotante con el siguiente paso y buscador de acciones, fármacos y mandos (tecla /).

## Cambios en la v0.7

- Docencia: modo examen con nota, vista del instructor en otra ventana o en otro dispositivo, debrief con línea de tiempo y PDF, historial por alumno, editor de casos con enlace para compartir, móvil con pestañas y vista de proyector.
- Motor: potasio con efecto en el ECG (T picudas, QRS ancho, bradicardia y parada) y en la TA; glucemia con nivel de conciencia y convulsiones; temperatura con bradicardia, ondas J, FV al movilizar, menos consumo de O₂ y descargas ineficaces por debajo de 30 °C; hemorragia según la presión, la hemostasia, el tranexámico, la oxitocina y la coagulopatía; tricíclicos con QRS ancho, hipotensión y convulsiones; eclampsia; crup con agotamiento; bronquiolitis; escalado pediátrico de pulmón, metabolismo y constantes; nueva parada tras la RCE; acceso vascular que hay que conseguir (vía venosa que puede fallar o intraósea); GCS estimado; compensación respiratoria de la acidosis metabólica según Winter.
- Acciones nuevas: vía venosa, intraósea, glucemia capilar, temperatura, calor activo, hemostasia según el foco (torniquete, cinturón pélvico, masaje uterino) y concentrado de hematíes.
- Fármacos nuevos: cloruro cálcico, bicarbonato, glucosa, glucagón, insulina con glucosa, sulfato de magnesio 4 g, labetalol, urapidilo, oxitocina, ácido tranexámico, sugammadex, midazolam intranasal, adrenalina nebulizada y dexametasona; perfusiones de ketamina, rocuronio, isoprenalina, magnesio y glucosa al 10 %.
- 13 casos nuevos: bronquiolitis, crup, anafilaxia pediátrica, FV pediátrica, fractura de pelvis, parada traumática, eclampsia, hemorragia posparto, hiperpotasemia, hipotermia, hipoglucemia, tricíclicos y RCE inestable.
- Objetivos evaluados con el valor que se ve en pantalla; tendencia del monitor de 30 min clínicos a cualquier velocidad; accesibilidad (valor del mando giratorio, sin controles anidados, objetivos táctiles de 44 px, textos ≥ 11 px, contraste).

## Cambios en la v0.6

- Medumat: relación I:E, rangos del equipo (PEEP hasta 30, ΔpASB hasta 35), SIMV + ASB, modo CPR 30:2 con MEDUtrigger y metrónomo a 110/min o continuo a 10/min con PEEP 0, preajuste RSI → IPPV y alarma de suministro que no se silencia.
- Hamilton T1: P-ramp en ms (0–2000, hasta 200 en SPONT, NIV y ASV), TI 0,1–12 s, Vt desde 20 mL, HiFlowO2 hasta 100 L/min, APVsimv y PSIMV+.
- Monnal T60: CPV con presión alta y baja sincronizadas y fase RCE, VSIMV y PSIMV, PS máxima 25 en VMNI y preajuste de preoxigenación.
- SIMV en el motor: mandatorias programadas con ventana de sincronización y soporte de presión entre ellas.
- RCP: relación compresión-ventilación (continuas, 30:2, 15:2) con pausas que bajan la fracción de compresión; insuflaciones con bolsa solo en las pausas.
- Vía aérea: dispositivo supraglótico (i-gel) que sella hasta ≈ 25 cmH₂O y puede fallar; bolsa y mascarilla difícil; el caso «No intubable, no oxigenable» ya obliga a la cricotiroidotomía. La ventilación estimada descarta en el acto las respiraciones de una fuente que ya no ventila.
- Toracostomía con drenaje: el neumotórax no vuelve a tensarse.
- Arritmias que empeoran sin tratamiento (la TV con pulso puede degenerar en parada) y sobreestimulación en el corpuls3.
- Monitores: PNI automática de 1 a 60 min.
- Velocidad inicial por caso y paso automático a ×1 en la parada.

## Cambios en la v0.5

- La fisiología ya no depende de la velocidad: la ventilación alveolar se calcula a partir de las últimas respiraciones y cae a cero en el acto en apnea.
- Parada: la RCE depende de resolver la causa, de la fracción de compresión, del tiempo sin flujo, de la adrenalina y de la duración; FV refractaria con cambio de parches a anteroposterior (ERC 2025); lidocaína como alternativa a la amiodarona.
- EtCO₂ de la RCP proporcional al flujo de las compresiones (10–20 mmHg, baja con el tiempo y con mala calidad).
- Control ventilatorio en respiración espontánea: respuesta al CO₂, a la hipoxemia frenada por la hipocapnia, a la acidosis láctica y al TEP; lactato y tampón agudo en el pH; fatiga de la musculatura débil.
- EPOC: SpO₂ 88 % con aire y 93 % con FiO₂ 28 %; la hiperoxia sube la pCO₂. Nueva Venturi 28 %.
- Intubación solo con bloqueo completo (45–60 s tras el relajante).
- Parada por hipotensión mantenida (TAS < 50 durante 2,5 min).
- Caso pediátrico con dosis y energías por peso (ERC soporte vital pediátrico) y energías bajas en los monitores.
- Textos según ERC 2025: FA inestable a energía máxima, sin atropina en el BAV de QRS ancho, ventilador en RCP en volumen control con PEEP 0–5.

## Supuestos sin confirmar en la documentación pública

- Air Mix del Medumat ≈ 60 % de FiO₂ (coherente con la fórmula de autonomía del fabricante, que se duplica con Air Mix); Vt del preajuste «Paciente nuevo» 7 mL/kg.
- Vt del Quick setup 1 del T1 8 mL/kg; ASV simplificado.
- Duración de O₂ 100 % del Monnal: 2 min.
- Nombres de modos del Monnal y del Medumat aproximados a las versiones habituales.
- Pasos de energía del corpuls3 (el fabricante da 2–200 J), rango de sobreestimulación (hasta 300 lpm) y secuencia del DEA aproximados; ventana de sincronización de la SIMV (40 % final del intervalo) genérica; nombres VSIMV/PSIMV del Monnal aproximados; probabilidades de éxito de descarga, cardioversión y RCE orientativas.
- Tiempo de descarte de cambios sin confirmar: 20 s, genérico.
- Medio interno, temperatura, hemorragia y tóxicos simplificados para docencia: magnitudes y tiempos orientativos, no farmacocinética real.
- La vista del instructor en otro dispositivo usa el servidor público de PeerJS solo para poner en contacto los navegadores; los datos van directos entre ellos.

## Fuentes de referencia

Guía rápida y especificaciones técnicas del Hamilton T1; manual de usuario del Monnal T60; instrucciones de uso del Medumat Standard²; especificaciones del ZOLL X Series; folletos del corpuls3. Recomendaciones ERC de soporte vital avanzado.

## Aviso

Herramienta docente. Valores y dosis orientativos (dosis de referencia para adulto, o pediátricas por peso en los casos marcados como pediátricos). No sustituye al manual del equipo, a los protocolos del servicio ni al juicio clínico.
