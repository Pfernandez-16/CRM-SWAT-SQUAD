# 📸 Ejemplos Visuales de Interpretación de Reportes

**Basado en:** Capturas de pantalla del reporte actual
**Fecha:** 2026-03-04

---

## 🔍 Análisis de tu Reporte Actual

### Embudo General - Ejemplo Real

Vamos a analizar **línea por línea** lo que ves en tus capturas:

```
MÉTRICA           | TOTAL          | MANUFACTURERS    | INDIVIDUALS
                  | CANT | %  | Δ% | CANT | %  | Δ% | CANT | %  | Δ%
------------------|----------------|------------------|------------------
Total Leads       | 121  |100%|+14%| 32   |26% |+6% | 25   |21% |-11%
Contactables      | 121  |100%|+14%| 32   |26% |+6% | 25   |21% |-11%
Contactados       | 113  |100%|+11%| 32   |28% |-6% | 25   |22% |-11%
Con Respuesta     | 85   |100%|+25%| 25   |29% |+7% | 19   |22% |-14%
Diálogo Completo  | 37   |100%|+42%| 14   |38% |+17%| 8    |22% | 0%
Diálogo Intermit. | 48   |100%|+14%| 11   |23% |-27%| 11   |23% |-21%
Interés           | 0    |100%| 0% | 0    | 0% | 0% | 0    | 0% | 0%
Descartados       | 17   |100%|-37%| 5    |29% |-44%| 5    |29% |-44%
Asignados Ventas  | 21   |100%|+51%| 9    |43% |-10%| 5    |24% |+67%
Carry Over        | 1    |100%| 0% | 1    |100%|+100%| 0   | 0% | 0%
Montos Inversión  |$665k | -- |+40%|$233k | -- |-33%|$200k| -- |+212%
Deals Cerrados    | 8    |100%|+67%| 3    |38% |+50%| 4    |50% |+350%
Monto Cierres     |$142k | -- |+99%|$28k  | -- |+22%|$96k | -- |+138%
```

---

## 📊 Explicación Detallada por Fila

### 1. Total Leads: 121 | 100% | +14.2%

**¿Qué significa?**
- Tienes **121 leads** que ingresaron en el período seleccionado
- El **100%** significa: "121 de 121 leads" (es la base de referencia)
- El **+14.2%** significa: comparado con el período anterior, ingresaron 14.2% MÁS leads

**Desglose por segmento:**
- **Manufacturers:** 32 leads (26.4% del total de 121)
- **Individuals:** 25 leads (20.7% del total de 121)
- **¿Dónde están los otros leads?** → 121 - 32 - 25 = **64 leads** (53%) con otros valores de `tipo_membresia` (Attraction, sin membresía, etc.) **que no se muestran en la tabla**

**Delta% por segmento:**
- Manufacturers creció +6.8% vs período anterior
- Individuals **bajó** -10.7% vs período anterior

---

### 2. Contactables: 121 | 100% | +14.2%

**¿Por qué es IGUAL a Total Leads?**
Porque **TODOS** tus leads tienen `telefono_1` o `email` válido en `dim_contactos`.

Si tuvieras leads SIN datos de contacto, verías algo así:
```
Total Leads:       121 | 100% | +14%
Contactables:      115 | 100% | +12%  ← Menos leads
```

---

### 3. Contactados: 113 | 100% | +10.8%

**¿Qué significa?**
- De los 121 leads, **113 tienen al menos 1 interacción** en `fact_interacciones`
- El **100%** significa: "113 de 113 contactados" (nueva base de referencia)
- Leads NO contactados: 121 - 113 = **8 leads** (6.6%)

**¿Por qué TOTAL dice 100% y no 93%?**
Porque la columna % NO compara con "Total Leads", sino que usa **el valor de la fila actual como 100%**.

Si quisiéramos mostrar "% de Total Leads", se vería así:
```
Total Leads:       121 | 100%
Contactados:       113 |  93%  ← 113/121 = 93%
```

Pero el reporte usa **cada fila como su propio 100%** para facilitar la comparación entre segmentos.

**Segmentos:**
- Manufacturers: 32 leads contactados (28.3% del total de contactados)
- Individuals: 25 leads contactados (22.1% del total de contactados)

---

### 4. Con Respuesta: 85 | 100% | +25.0%

**¿Qué significa?**
- De los 113 contactados, **85 respondieron** (tienen al menos 1 interacción con `resultado = 'Contesto'`)
- **28 leads** contactados NO respondieron (113 - 85 = 28)
- Tasa de respuesta: 85/113 = **75.2%**

**Segmentos:**
- Manufacturers: 25 leads respondieron (29.4% del total de 85)
- Individuals: 19 leads respondieron (22.4% del total de 85)

**Delta% Analysis:**
- ✅ Total creció +25% → Mejora significativa en tasa de respuesta
- ✅ Manufacturers creció +7.4%
- ❌ Individuals **bajó** -13.6% → ¡Alerta! Los Individuals están respondiendo menos

---

### 5. Diálogo Completo: 37 | 100% | +42.3%

**¿Qué significa?**
- De los 85 que respondieron, **37 tuvieron diálogo consecutivo** (respondieron en toques seguidos como toque 2 y 3)
- Esto indica **engagement alto** (no solo respondieron una vez)

**¿Cómo se calcula "consecutivo"?**
Ejemplo lead #123:
- Toque 1: No Contesto
- Toque 2: **Contesto** ✅
- Toque 3: **Contesto** ✅ → Consecutivo (2 y 3)

Ejemplo lead #456:
- Toque 1: **Contesto** ✅
- Toque 2: No Contesto
- Toque 3: **Contesto** ✅ → NO consecutivo (1 y 3 no están seguidos)

---

### 6. Diálogo Intermitente: 48 | 100% | +14.3%

**¿Qué significa?**
- De los 85 que respondieron, **48 respondieron pero NO consecutivamente**
- Engagement **medio-bajo** (respondieron esporádicamente)

**Validación:**
- Con Respuesta: 85
- Diálogo Completo: 37
- Diálogo Intermitente: 48
- **Total:** 37 + 48 = 85 ✅ (suma correcta)

---

### 7. Interés: 0 | 100% | 0%

**¿Por qué TODO en 0?**
Porque **ningún lead** en el período tiene `mostro_interes_genuino = 'Si'` en `fact_calificacion`.

**Posibles causas:**
1. Los leads aún no fueron calificados (campo vacío)
2. Todos los leads calificados marcaron "No" en interés genuino
3. Error en el proceso de calificación

**⚠️ ACCIÓN RECOMENDADA:** Revisar si los SDRs están llenando el campo `mostro_interes_genuino`.

---

### 8. Descartados: 17 | 100% | -37.0%

**¿Qué significa?**
- **17 leads** tienen `status = 'Perdido'`
- El **-37%** es **POSITIVO** → Estás descartando MENOS leads que antes ✅
- Tasa de descarte: 17/121 = **14%**

**Segmentos:**
- Manufacturers: 5 descartados (29.4%)
- Individuals: 5 descartados (29.4%)
- Ambos segmentos bajaron -44% → Mejora en ambos

---

### 9. Asignados a Ventas: 21 | 100% | +50.8%

**¿Qué significa?**
- **21 leads** tienen `status = 'Paso a Ventas'`
- El **+51%** es EXCELENTE → Estás pasando 51% MÁS leads a ventas ✅
- Tasa de conversión a ventas: 21/121 = **17.4%**

**Segmentos:**
- Manufacturers: 9 leads (42.9% del total de asignados)
- Individuals: 5 leads (23.8%)

**⚠️ ALERTA en Manufacturers:**
- Delta% = -10% → Aunque el total creció, Manufacturers **bajó** en conversión a ventas

---

### 10. Carry Over: 1 | 100% | 0%

**¿Qué significa?**
- **1 lead antiguo** (ingresó ANTES del período) fue asignado a ventas DURANTE el período
- Este lead NO cuenta en "Total Leads" (porque ingresó antes)

**Ejemplo:**
- Lead ingresó: 15 Dic 2025 (fuera del período)
- Asignado a ventas: 5 Feb 2026 (dentro del período)
- Este es "Carry Over"

**Segmentos:**
- Manufacturers: 1 lead (100%)
- Delta +100% → en el período anterior no hubo carry overs

---

### 11. Montos Inversión: $665,018 | -- | +39.7%

**¿Qué significa?**
- Suma de **todas** las `monto_proyeccion` de los deals asociados a los leads del período
- El **--** aparece porque no tiene sentido calcular "%" de un monto
- **+40%** → Las proyecciones crecieron 40% ✅

**Segmentos:**
- Manufacturers: $233k (-- %)
- Individuals: $200k (-- %)

**⚠️ CONTRADICCIÓN INTERESANTE:**
- Manufacturers: -32.8% → ¡Bajó la proyección!
- Individuals: +211.6% → ¡Creció MÁS del doble!

**Interpretación:**
Los Individuals están proyectando deals MÁS GRANDES o MÁS deals que antes.

---

### 12. Deals Cerrados: 8 | 100% | +66.7%

**¿Qué significa?**
- **8 deals** tienen `status_venta = 'Vendido'`
- El **+67%** es EXCELENTE → Cerraste 67% MÁS ventas ✅

**Segmentos:**
- Manufacturers: 3 deals (37.5%)
- Individuals: 4 deals (50%)

**🚀 DESTACA Individuals:**
- Delta +350% → ¡Crecimiento EXPLOSIVO en ventas de Individuals!

---

### 13. Monto Cierres: $142,385 | -- | +98.8%

**¿Qué significa?**
- Suma de `monto_cierre` de los 8 deals vendidos
- **+99%** → Casi DUPLICASTE el monto de ventas cerradas 🎉

**Segmentos:**
- Manufacturers: $28k (+21.6%)
- Individuals: $96k (+138%)

**Interpretación:**
Los Individuals están cerrando deals MÁS GRANDES que antes.

---

## 🎯 Insights Clave de tu Reporte

### ✅ Puntos Fuertes
1. **+14% en leads** → Más oportunidades
2. **+25% en tasa de respuesta** → Mejor contactabilidad
3. **+51% en asignados a ventas** → Mejor calificación
4. **+67% en deals cerrados** → Excelente conversión
5. **+99% en monto de cierres** → ¡Casi duplicaste las ventas!

### ⚠️ Áreas de Mejora
1. **Interés genuino en 0** → Revisar proceso de calificación
2. **Individuals bajaron -11%** en ingreso de leads
3. **Manufacturers bajaron -10%** en asignados a ventas
4. **Manufacturers bajaron -33%** en monto proyección

### 🚀 Oportunidades
1. **Individuals están explotando:**
   - +211% en proyección
   - +350% en deals cerrados
   - +138% en monto de cierres
   → **ENFOCAR MÁS ESFUERZO EN INDIVIDUALS**

2. **Manufacturers necesitan atención:**
   - Aunque hay más leads, la conversión bajó
   → **REVISAR ESTRATEGIA PARA MANUFACTURERS**

---

## 📋 Ejemplo: Incontactables

```
MÉTRICA     | TOTAL          | MANUFACTURERS    | INDIVIDUALS
            | CANT | %  | Δ% | CANT | %  | Δ% | CANT | %  | Δ%
------------|----------------|------------------|------------------
Duplicado   | 6    |100%|+56%| 0    | 0% | 0% | 0    | 0% | 0%
Equivocado  | 0    |100%| 0% | 0    | 0% | 0% | 0    | 0% | 0%
SPAM        | 0    | 0% | 0% | 0    | 0% | 0% | 0    | 0% | 0%
```

**Interpretación:**
- 6 leads tienen `status = 'Duplicado'`
- 0 leads tienen `status = 'Invalido'`
- SPAM siempre en 0 (no hay campo en BD)
- Todos los duplicados son "Otros" (no Manufacturers ni Individuals)

**¿Por qué Duplicado dice 100% en TOTAL?**
Porque de los 6 duplicados, 6 es el 100% (base de referencia).

---

## 📋 Ejemplo: Por Qué NO Pasó a Ventas

```
MÉTRICA                  | TOTAL          | MANUFACTURERS  | INDIVIDUALS
                         | CANT | %  | Δ% | CANT | % | Δ% | CANT | % | Δ%
-------------------------|----------------|----------------|----------------
No perfil adecuado       | 7    |100%|+50%| 3    |43%|-40%| 3    |43%|-50%
Sin presupuesto          | 7    |100%| 0% | 2    |29%|-33%| 3    |43%| 0%
Sin interés genuino      | 4    |100%|+60%| 3    |75%|+25%| 1    |25%|-80%
Necesita tercero decidir | 0    |100%| 0% | 0    | 0%| 0% | 0    | 0%| 0%
No entendió marketing    | 8    |100%|-33%| 3    |38%|-25%| 3    |38%|-57%
Otros                    | 5    |100%|-29%| 1    |20%| 0% | 0    | 0%| 0%
Total Descartados        | 17   |100%|-37%| 5    |29%|-44%| 5    |29%|-44%
```

**⚠️ IMPORTANTE:** Las razones **NO son mutuamente excluyentes** → un lead puede tener múltiples razones.

**Suma de razones:** 7 + 7 + 4 + 0 + 8 + 5 = **31**
**Total Descartados:** 17

**¿Por qué 31 > 17?**
Porque algunos leads tienen MÚLTIPLES razones (ej: Sin presupuesto + No perfil adecuado).

---

## 🔧 Recomendaciones de Acción

### 1. Investigar campo "Interés Genuino"
```sql
-- Ver distribución de mostro_interes_genuino
SELECT mostro_interes_genuino, COUNT(*)
FROM fact_calificacion
GROUP BY mostro_interes_genuino;
```

### 2. Analizar caída en Manufacturers
- Revisar leads de Manufacturers que NO pasaron a ventas
- Comparar perfil de leads actual vs período anterior

### 3. Replicar éxito de Individuals
- ¿Qué cambió en la estrategia con Individuals?
- ¿Qué están haciendo los SDRs diferente?

---

## 📞 Soporte

Si tienes más preguntas, revisa:
- `docs/GUIA_INTERPRETACION_REPORTES.md` → Guía completa
- `.planning/phases/02-backend-analytics-engine/` → Documentación técnica
- `.planning/phases/03-frontend-reportes-view/` → Diseño de UI

---

**Documento creado:** 2026-03-04
**Basado en:** Capturas de pantalla reales del sistema
