# Simulador de transporte · ventilación, monitor y RCP

Simulador docente para SVA terrestre y HEMS: ventilación mecánica invasiva y no invasiva, oxigenoterapia y alto flujo, monitor-desfibrilador (desfibrilación, cardioversión sincronizada, DEA, marcapasos), fármacos y RCP.

**Abrir el simulador:** https://davidrope93-svg.github.io/simulador-transporte/

Funciona en el navegador del ordenador, la tablet o el móvil, sin instalar nada.

**Instalarlo como app (funciona sin conexión):** al abrir la página por primera vez se guarda en el dispositivo y avisa «Listo: el simulador ya funciona sin conexión».
- Android (Chrome) y ordenador (Chrome o Edge): botón «Instalar app» de la barra superior, o en el menú del navegador «Instalar app».
- iPhone y iPad: abrir la página en Safari, Compartir y «Añadir a pantalla de inicio».

Instalado, se abre desde su icono a pantalla completa y funciona en el helicóptero o sin cobertura. Lo único que necesita red es enlazar al instructor desde otro dispositivo. Cuando se publica una versión nueva, la app avisa «Hay una versión nueva» con un botón para actualizar; mientras no se pulsa, sigue con la que tiene.

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

85 casos más el modo libre, en 15 grupos: VMI en SVA, VMI en HEMS, VMNI, vía aérea, oxigenoterapia e intoxicaciones, pediatría, neonatal, trauma y obstetricia, metabólico y ambiental, shock, cardiología, neurología, arritmias, parada y modo libre. Los casos propios aparecen en «Mis casos». Cada caso arranca a la velocidad que le corresponde (×1 en parada, ×5 en arritmias, ×10 en el resto; al entrar en parada pasa a ×1) y tiene objetivos que se colorean en tiempo real, eventos programados, una solución posible y un debrief al terminar (tiempo en objetivo, parada, arritmia, vía aérea, eventos, fármacos y peores valores).

## Para no perderse

- **Guía**: un recorrido de 13 pasos por la pantalla que sale la primera vez y se repite con el botón «Guía».
- **Siguiente paso**: un recuadro flotante con el problema más urgente y el botón «Dónde se hace», que lleva al mando exacto y lo hace parpadear (abre el grupo de fármacos y, en el móvil, cambia de pestaña). Se pliega con ▾ y desaparece en el modo examen.
- **«Dónde»** junto a cada recomendación de la Lectura.
- **Buscar** (botón o tecla /): se escribe lo que se quiere hacer («calcio», «PEEP», «intubar», «cardioversión», «vía») y con Enter se hace o se va al mando.
- **Biblioteca** (botón junto al selector de caso, o «biblioteca» en Buscar): todos los casos con lo que enseña cada uno, buscador, filtros por grupo, ámbito (terrestre, HEMS, interhospitalario), dificultad, paciente (adulto, pediátrico, obstétrico) y estado (sin hacer, hechos, para repetir con nota < 6), «Caso aleatorio» (prefiere los que no has hecho) y la opción de cargar el caso como variante nueva. Marca cada caso con la mejor nota y el número de intentos de este dispositivo; los intentos de sus variantes cuentan para el original.
- **Nueva variante**: desde la tarjeta del caso genera otro caso a partir del abierto, con otro paciente (talla, peso, peso ideal; con IMC ≥ 35, pulmón de obeso), otra gravedad, a veces sin vía venosa, otra altitud de cabina en HEMS y una complicación añadida con su acción clave; en la parada del adulto cambian además la causa (hiperpotasemia, TEP, neumotórax, hipovolemia, tricíclicos, opiáceos, hipotermia, anafilaxia, hipoxia o cardíaca) y el ritmo. La solución, las acciones clave y el tutorial se adaptan. Cada variante tiene un código, se puede guardar en «Mis casos» y compartir con un enlace que carga exactamente la misma.
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
| `src/pwa.js`, `src/sw.js`, `src/manifest.webmanifest` | Instalable y sin conexión: registro del service worker, botón «Instalar app» y aviso de versión nueva; el service worker guarda la página, los iconos y las tipografías. `build.py` genera `sw.js` (con la huella de cada versión) y `manifest.webmanifest` en la raíz. Solo van en la versión publicada, no en el artefacto. |
| `src/icon.svg`, `tools/iconos.js` | Icono de la app y el script que genera los PNG de `icons/`. |
| `src/drugs.js` | Fármacos y perfusiones con su cálculo de dosis (adulto y por peso), sin DOM: los comparten la interfaz y el validador. |
| `src/solutions.js` | Solución de referencia de cada caso, en pasos (minuto, orden): la usa el validador y servirá para el informe comparado. |
| `tests/validar.js` | Validador de casos: juega cada caso con su solución y sin hacer nada. |
| `src/library.js` | Biblioteca de casos: buscador, filtros, caso aleatorio y marca de hechos. Se inserta en `ui.js` después de `tutor.js`. |
| `src/variants.js` | Generador de variantes: a partir de un caso y una semilla crea otro caso reproducible. Sin DOM, lo usan la interfaz y las pruebas. |
| `src/tutor.js` | Tutorial por caso: guion de pasos de cada caso, comprobación de que cada paso está hecho y tutorial generado para los casos propios. Se inserta después de `guide.js`. |
| `src/guide.js` | Orientación: guía paso a paso, «Dónde», ayudante con el siguiente paso y buscador. Se inserta dentro de `ui.js` después de `teach.js`. |
| `src/teach.js` | Docencia: examen y nota, instructor, línea de tiempo, PDF, historial, editor de casos, móvil y proyector. Se inserta dentro de `ui.js` al generar la página. |
| `src/template.html` | Maquetación y estilos. |
| `build.py` | Une todo en `index.html`. |
| `tests/run.js` | Pruebas del motor (`node tests/run.js`): fisiología de referencia, independencia de la velocidad, parada, los 58 casos y sus variantes. GitHub las ejecuta en cada cambio. |

## Pruebas

Cada versión tiene que pasar 272 pruebas con rangos de referencia: regresión de la mecánica, tiempo de desaturación en apnea (sano preoxigenado 7–9,5 min, con aire 0,6–2 min, obeso 2,3–3,6 min) igual a ×1 que a ×20, PaCO₂ en respiración espontánea (TSV, TEP, opiáceos, EPOC con hiperoxia), SpO₂ del EPOC según FiO₂, EtCO₂ durante la RCP, tiempo de acción del relajante, tasas de RCE según se resuelva o no la causa, frecuencia mandatoria en SIMV, fracción de compresión con 30:2, vía aérea no oxigenable con bolsa y supraglótico, drenaje torácico en altitud, deterioro de la TV con pulso y sobreestimulación; y en la v0.7, hiperpotasemia con y sin calcio, hipoglucemia y su recurrencia, QRS de los tricíclicos con bicarbonato, FV en hipotermia, hemorragia con y sin hemostasia (y el coste del volumen liberal), convulsiones de la eclampsia con magnesio, crup, bronquiolitis con alto flujo, constantes de un lactante sano, nueva parada tras la RCE, parada traumática y compensación respiratoria según Winter.

**Validador de casos** (`node tests/validar.js`, también dentro de las pruebas): un bot juega cada caso con su solución de referencia (`src/solutions.js`) como lo haría un equipo experto (ajusta la FiO₂ y la FR a los objetivos, responde a las complicaciones, sigue el algoritmo de SVA y canaliza vía cuando hace falta) y otra vez sin hacer nada, con la misma nota que el examen. Un caso es válido si con la solución saca ≥ 7 (en la parada: ≥ 80 % de las acciones clave y RCE en ≥ 40 % de las partidas) y sin hacer nada ≤ 5. Además, la solución del original tiene que resolver ≥ 85 % de sus variantes. Con `--detalle` muestra cada objetivo; con `--variantes N`, las variantes que no se resuelven. Ningún caso nuevo entra sin pasar el validador.

## Cambios en la v1.12

- Prematuro en el motor (ERC 2021): edad gestacional, pulmón sin surfactante que se colapsa en cada espiración si no hay PEEP (más cuanto más inmaduro), agotamiento con apnea si respira solo con el pulmón colapsado, TA más baja y presiones de 25 cmH₂O en las insuflaciones del < 32 semanas.
- Pieza en T completa en «Reanimación neonatal»: CPAP con mascarilla, PEEP de 4 a 8 cmH₂O y presión inspiratoria de 20, 25 o 30 cmH₂O. Sin CPAP ni ventilación, el oxígeno en flujo libre llega a medias.
- Termorregulación del recién nacido: el < 32 semanas pierde calor por evaporación aunque se le seque; bolsa de plástico sin secar, gorro y calor radiante, e incubadora de transporte en el traslado. La hipotermia y la hipoglucemia mantenidas lo deprimen.
- Hipoglucemia neonatal: G10 % 2 mL/kg (200 mg/kg; la glucosa al 50 % no se usa) y perfusión nueva de G10 % por peso (mL/kg/h, con mg/kg/min); en ≤ 10 kg sustituye a la de mL/h.
- Neumotórax a tensión en el recién nacido: desaturación, shock obstructivo y bradicardia; exploración con asimetría y transiluminación; punción en el 2.º espacio intercostal.
- Lectura neonatal ampliada: bolsa de plástico, dificultad respiratoria del prematuro (CPAP), FiO₂ inicial 30 % en < 28 semanas, más PEEP antes que más oxígeno, presión alta para un prematuro, hiperoxia (objetivo 90–95 %), glucemia, hipoglucemia y perfusión, incubadora, hipo e hipertermia y neumotórax.
- Dos casos nuevos en «Neonatal»: prematuro de 27 semanas nacido en el domicilio y traslado interhospitalario de un prematuro de 32 semanas en CPAP con neumotórax en vuelo; con tutorial, solución y validados. Sus variantes cambian la edad gestacional y el peso.
- Corrección: el umbral de volumen de cada respiración era fijo (30 mL) y descartaba las del recién nacido pequeño; ahora es proporcional al peso. 22 pruebas nuevas (272 en total).

## Cambios en la v1.11

- Pediatría por edad en el motor (APLS/ERC 2021): edad del caso (o estimada por el peso), constantes normales por edad (FC, FR y TAS mínima = 70 + 2 × edad), peso estimado por edad, triángulo de evaluación pediátrica en la exploración (apariencia, respiración y circulación, con la impresión: estable, dificultad o fallo respiratorio, shock compensado o descompensado, disfunción neurológica o fallo cardiorrespiratorio) y Glasgow pediátrica por debajo de 2 años.
- Cinta pediátrica en Acciones para cualquier caso pediátrico o neonatal: edad y peso, normalidad, tubo (con y sin balón) y profundidad, i-gel, pala, sonda de aspiración, Vt y FR, julios, adrenalina, líquidos y glucosa.
- Lectura pediátrica por edad: taquipnea, hipotensión con la TAS mínima de la edad, bradicardia con mala perfusión como parada inminente, FR del respirador fuera de la de su edad y Vt pequeño en el Medumat (que ajusta de 50 en 50 mL).
- Caso nuevo en «Pediatría»: TCE grave en un niño de 6 años conectado con ajustes de adulto, con tutorial, solución y validado. El validador canaliza vía cuando la pide una acción clave. 17 pruebas nuevas (250 en total).
- Revisión clínica: sin válvula a demanda en la descompresiva (el máximo es la mascarilla con reservorio) y golpe de calor solo con enfriamiento por evaporación y hielo.

## Cambios en la v1.10

- Ambiental de Canarias en el motor: ahogamiento con agua en el alveolo, sin surfactante y muy reclutable con PEEP; enfermedad descompresiva con carga de burbujas que el O₂ al 100 % y el volumen reducen y que la altitud de cabina expande (Boyle), con afectación medular y pulmonar; golpe de calor con hipertermia que sigue subiendo, vasodilatación, deshidratación, lactato, convulsiones y parada por encima de 42 °C, y enfriamiento activo de ≈ 0,15 °C/min.
- Objetivo nuevo de altitud de cabina (el deslizador equivale a pedirle cota al piloto). Lectura de hipertermia y enfriamiento para cualquier caso, enfermedad descompresiva y ahogamiento.
- 3 casos nuevos en «Metabólico y ambiental» (surfista ahogado en El Médano con VMNI, buceador de La Restinga trasladado en helicóptero y golpe de calor en la maratón de Santa Cruz), con tutorial, solución y validados.
- Revisión de «Incendio»: la solución preoxigena más y sube la PEEP tras intubar, y el validador espera a tener vía antes de la inducción; resuelve 11 de 12 variantes (antes 2 de 6). 11 pruebas nuevas (233 en total).

## Cambios en la v1.9

- Reanimación neonatal en el motor (ERC 2021): pulmón lleno de líquido que se airea con las 5 insuflaciones de 2–3 s a 30 cmH₂O (y más despacio con la ventilación a 30/min), circulación de transición que deja la SpO₂ baja los primeros minutos, FC que sigue a la oxigenación y a la reserva del miocardio, apnea que cede cuando el niño se oxigena, vía aérea que no deja entrar las insuflaciones hasta corregir la posición, el sellado y las secreciones, compresiones 3:1 y adrenalina de 20 mcg/kg, necesaria con el miocardio muy deprimido. Pérdida de calor del recién nacido mojado. Exploración con color, tono, respiración, FC por auscultación y Apgar estimado; Lectura propia con el algoritmo neonatal y los objetivos de SpO₂ preductal por minuto.
- Controles nuevos (solo en los casos neonatales): 5 insuflaciones, posición neutra y sellado, aspirar boca y nariz, compresiones 3:1, catéter venoso umbilical y FiO₂ de la pieza en T. La adrenalina se dosifica a 20 mcg/kg en el recién nacido.
- Grupo nuevo «Neonatal» con 2 casos (recién nacido que no respira y reanimación completa con meconio, compresiones y adrenalina), con tutorial, solución y validados; en sus variantes cambia la profundidad de la asfixia o aparecen secreciones.
- Revisión clínica de sesiones anteriores: el caso «Incendio» suma un gran quemado (cristaloide en bomba), el hematoma cerebral crece más despacio y el midazolam de la crisis pasa a 0,2 mg/kg (máx. 10 mg), como el levetiracetam (60 mg/kg, máx. 4.500 mg) y el valproato (40 mg/kg, máx. 3.000 mg) de las guías pediátricas. 15 pruebas nuevas (222 en total).

## Cambios en la v1.8

- Betabloqueantes y calcioantagonistas en el motor: bradicardia sin taquicardia refleja e hipotensión que responden poco a la atropina y a los vasopresores; el glucagón rinde más en el betabloqueante y el calcio en el calcioantagonista; la insulina a dosis altas, en los dos, tarda 15–30 min y baja la glucemia y el potasio. Fármacos nuevos: glucagón IV y en perfusión, insulina a dosis altas en bolo y perfusión y emulsión lipídica.
- Organofosforados: síndrome muscarínico (broncorrea, bradicardia, miosis) y nicotínico (fasciculaciones, debilidad), absorción que sigue hasta descontaminar (acción nueva «Descontaminar»), atropina en dosis dobles (2, 4, 8, 16 mg y perfusión) hasta atropinizar, pralidoxima y bloqueo prolongado si se usa succinilcolina.
- Cocaína: taquicardia, HTA, hipertermia progresiva, agitación, convulsiones, QRS algo ancho e isquemia en el ECG; las benzodiacepinas frenan el cuadro; acción nueva «Enfriamiento activo».
- Cetoacidosis: acidemia grave que hunde la TA y puede parar el corazón si el intubado no mantiene su compensación respiratoria; tampón agudo proporcional al bicarbonato que queda; insulina en perfusión (0,1 UI/kg/h) que baja la glucemia y el potasio. Objetivos nuevos de FC y K⁺.
- Revisión clínica: la pralidoxima sale del maletín (el SUC no la lleva; queda como pre-aviso al hospital) y el caso de organofosforados pide mantener la perfusión de atropina.
- 5 casos nuevos: calcioantagonistas, betabloqueantes, organofosforados y cocaína en «Oxigenoterapia e intoxicaciones», y cetoacidosis intubada trasladada desde El Hierro en «Metabólico y ambiental», con tutorial, solución y validados. 28 pruebas nuevas (207 en total).

## Cambios en la v1.7

- Estatus epiléptico en el motor: crisis mantenida con hipoxemia, taquicardia, HTA, hipertermia y lactato; las benzodiacepinas funcionan peor cuanto más dura; segunda línea (levetiracetam y valproato, nuevos, con dosis máximas y pediátricas); en el refractario solo la anestesia (propofol, midazolam a dosis altas o ketamina) la controla, y vuelve al bajar la dosis. El relajante quita los movimientos, no la crisis. Midazolam para la crisis (0,15 mg/kg, máx. 10 mg, IM o IV).
- Ictus: isquémico con escala RACE, hora de inicio y penumbra que empeora si la TA cae más de un 20 %, con hipotensión, hipoxia o disglucemia; hemorrágico con hematoma que crece con la TAS alta, GCS que cae, vómito y broncoaspiración sin vía aérea protegida. Acción nueva «Activar código ictus».
- Sodio: natremia en la gasometría, hiponatremia aguda con confusión, convulsiones y edema pulmonar no cardiogénico; salino hipertónico 3 % (nuevo) y 7,5 % y cristaloides que cambian el sodio según el agua corporal (fórmula de Adrogué, peso ajustado en el obeso). Objetivos nuevos: «Sin convulsión», Na⁺ y «Subida de Na⁺». Lectura y resumen final adaptados.
- Grupo nuevo «Neurología» con 3 casos (estatus refractario, código ictus por oclusión de gran vaso y hemorragia cerebral trasladada en helicóptero a neurocirugía) y un caso de hiponatremia tras la Transvulcania en «Metabólico y ambiental», con tutorial, solución y validados. En las variantes, el paciente obeso conserva la TA y la FC del planteamiento. 25 pruebas nuevas (179 en total).

## Cambios en la v1.6

- Trauma torácico en el motor: hemotórax que se llena con el sangrado intratorácico (matidez, murmullo abolido y yugulares planas; shunt y menos distensibilidad), drenaje que evacua la sangre y anota el volumen (≥ 1.500 mL o > 200 mL/h: criterio de toracotomía) y por el que sigue saliendo el sangrado activo; volet costal con respiración paradójica, contusión que da shunt y recluta con PEEP, y presión positiva que lo estabiliza por dentro.
- Dolor en el motor: sube la FC, la TA y la FR y, en el volet, frena la inspiración. Analgesia (ketamina 0,3 mg/kg nueva, fentanilo y morfina): a dosis analgésicas el opiáceo apenas deprime la respiración, y menos con dolor; la ketamina analgésica casi no seda. Perfusión de ketamina a dosis bajas (0,15–0,3 mg/kg/h).
- Gran quemado: superficie quemada con fuga capilar que consume el volumen, pérdida de calor y cristaloide en bomba nuevo (mL/h). Objetivos nuevos de temperatura y de ritmo de cristaloide. Exploración, ecografía, Lectura (criterios de toracotomía, dolor, fluidos y calor del quemado) y resumen final adaptados.
- 3 casos nuevos en «Trauma y obstetricia» (hemotórax masivo, volet costal con contusión y gran quemado), con tutorial, solución y validados; en sus variantes, el volet puede complicarse con un neumotórax a tensión y el hemotórax no tiene «resangrado». 27 pruebas nuevas (154 en total).

## Cambios en la v1.5

- Shock distributivo en el motor: vasoplejia séptica que baja sobre todo la diastólica (presión de pulso ancha y PAM baja), taquicardia y lactato que sube; progresa hasta unos 20 min después del antibiótico; la fuga capilar consume el volumen (los primeros bolos suben la PAM y los siguientes casi no) y la noradrenalina rinde más. Sobrecarga de volumen según lo que tolere cada pulmón (crepitantes, líneas B y caída de la SpO₂). Shock neurogénico: hipotensión con bradicardia y piel caliente, que responde a atropina y noradrenalina.
- PNI con la diastólica real y objetivo nuevo de PAM. Antibióticos (ceftriaxona, piperacilina-tazobactam y meropenem, con dosis pediátricas). Exploración, ecografía clínica (vena cava, líneas B) y Lectura adaptadas.
- Grupo nuevo «Shock» con 3 casos validados (sepsis urinaria, sepsis en un cardiópata que tolera poco volumen y shock neurogénico), con tutorial y solución. 15 pruebas nuevas (127 en total).

## Cambios en la v1.4

- Cardiología en el motor: SCACEST (localización, afectación del VD, minutos de evolución y distancia a la ICP primaria), con ST en la derivación II del monitor, FV primaria y bradicardia del inferior, y reperfusión tras la tenecteplasa más probable cuanto antes se da; los nitratos hunden la TA en el infarto de VD. Taponamiento que crece, con hipotensión, taquicardia, bajo voltaje y alternancia eléctrica; la PEEP lo empeora, el volumen gana tiempo, la pericardiocentesis lo resuelve y, si no se trata, AESP (causa reversible también en las variantes de parada).
- Acciones nuevas: ECG de 12 derivaciones (interpreta SCACEST con V4R, hiperpotasemia, tricíclicos, hipotermia, TEP y taponamiento), ecografía clínica (derrame y colapso del VD, neumotórax, VD dilatado, vena cava, líneas B), pericardiocentesis y activar la ICP primaria. Fármacos del síndrome coronario: AAS, ticagrelor, clopidogrel, heparina sódica y enoxaparina. Objetivo nuevo «Reperfusión adecuada»: ICP primaria si llega en ≤ 120 min; si no, fibrinólisis.
- Grupo nuevo «Cardiología» con 4 casos (SCACEST anterior con ICP primaria, SCACEST inferior en La Gomera con fibrinólisis, infarto de VD y taponamiento), con su tutorial, su solución de referencia y validados. 13 pruebas nuevas (112 en total).

## Cambios en la v1.3

- Instalable como app y sin conexión: manifiesto, iconos, service worker con caché de la página y de las tipografías, botón «Instalar app» (con instrucciones en el iPhone), aviso al perder la red y aviso de versión nueva con «Actualizar». 4 pruebas nuevas (99 en total) y la integración continua comprueba que `sw.js` y el manifiesto están al día.

## Cambios en la v1.2

- Validador de casos (`tests/validar.js`) con la solución de referencia de los 58 casos (`src/solutions.js`) y 4 pruebas nuevas (95 en total). Los fármacos pasan a `src/drugs.js` para que el validador dé las mismas dosis que los botones.
- Errores que encontró el validador, corregidos: con una vía periférica ya puesta, la interfaz seguía diciendo «sin acceso vascular» y el tutorial no daba el paso por hecho (solo reconocía la intraósea); y durante la parada la vía nunca terminaba de canalizarse, así que en las paradas sin vía no se podían dar fármacos.
- Casos ajustados para que tengan una solución alcanzable y no se aprueben sin hacer nada: TCE (FR 12–14 para normocapnia con 7 mL/kg), herniación (EtCO₂ 30–38), ahogamiento (SpO₂ 88–95 % como en el SDRA), broncoaspiración (más marcada; PEEP 10–14), se despierta (sedación como acción clave), EAP con shock (TAS de partida 85; PEEP 8–10 con PS baja y noradrenalina), neumonía en VMNI (intubar a tiempo como acción clave), ¿fracasa la VMNI? (30 min, pCO₂ ≤ 85 e intubación), vía aérea difícil (SpO₂ ≥ 92 %), inhalación de humo (el edema obstruye la vía aérea si no se intuba), extubación en vuelo (30 min), EPOC con demasiado O₂ (pCO₂ ≤ 78) y monóxido (40 min, objetivo nuevo de SpCO ≤ 25 % y O₂ al 100 % como acción clave). Elegir un dispositivo de O₂ queda registrado para las acciones clave.

## Cambios en la v1.1

- Biblioteca de casos (`src/library.js`) y ficha de cada caso en `cases.js` (ámbito, dificultad y qué enseña), con su prueba. Las ventanas emergentes quedan por encima del ayudante y de la barra de pestañas del móvil.

## Cambios en la v1.0

- Botón «Nueva variante» con su generador (`src/variants.js`) y 15 pruebas nuevas: misma semilla, misma variante; ninguna variante igual al original; ninguna con valores imposibles; y en las paradas por hiperpotasemia, tricíclicos, neumotórax, TEP, hipovolemia y opiáceos, RCE tratando la causa (50–100 %) y no sin tratarla (≤ 25 %).

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
