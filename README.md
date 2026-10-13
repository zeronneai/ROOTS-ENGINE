# ROOTS ENGINE · Purple Roots Agency

El motor de contenido de Purple Roots. Para cada cliente:

1. **Encuentra a su competencia** y detecta sus videos outlier (los que pegaron muy por encima de su promedio).
2. **Desarma lo que funciona**: hook, estructura, por qué funcionó y cómo adaptarlo a la marca.
3. **Planea la semana**: ideas probadas con 3 hooks, guion, lista de tomas, CTA y copy.
4. **Edita**: el cliente sube su clip y el motor lo edita solo con el estilo de SU marca (o lo edita el equipo).
5. **Publica y aprende** (siguiente fase).

## Planes

| Plan | Qué incluye |
|---|---|
| Roots Plan | Investigación + plan semanal + hooks y guiones. El cliente graba, edita y publica. |
| Roots Auto | Lo anterior + auto-edición con el estilo del cliente. |
| Roots Edit | Lo anterior + el equipo de PRA edita a mano. |
| Full PRA | Producción completa. |

## Cómo está armado

```
Portal (Next.js en Vercel)                     Worker (una PC o servidor con ffmpeg)
 ├─ Agencia: clientes, Brand Brain, plan        ├─ transcribe (Whisper, palabra por palabra)
 ├─ Cliente: su plan, sube videos, moods        ├─ dirige con Claude (cortes, zooms, emojis)
 └─ Laboratorio de estilo (preview en vivo)     └─ renderiza con Remotion → MP4 en Supabase
                 │                                              │
                 └──────────── Supabase (DB, login, archivos) ──┘
                                   │
               Claude API · Apify (IG/TikTok) · OpenAI Whisper
```

### El auto-editor y los estilos por giro

- `src/lib/styles/presets.ts`: un estilo por tipo de negocio (Street Fade para barberías, Counsel para abogados,
  Glow Luxe para med spas, Food Hype, Iron, Neon Night, Smile, Editorial, Ranch, Creator Bold). Cada uno define
  fuente y animación de subtítulos, color de la palabra clave, zooms, emojis, sonidos, color y ritmo de cortes.
- El estilo final de cada video se arma en capas (`src/lib/styles/resolve.ts`):
  **preset del giro → color de la marca → ajustes del cliente → mood activo → ajuste de ese video.**
  Así nadie se ve igual aunque compartan giro.
- **Energía** (-2 a +2): un solo control que escala zooms, emojis y ritmo.
- **Moods**: el cliente escribe con sus palabras cómo se quiere ver ("para diciembre algo más elegante") y Claude lo
  convierte en ajustes del editor (`src/lib/ai/mood.ts`). Se activan y desactivan con un clic.
- Claude actúa como editor (`src/lib/ai/direct-edit.ts`): quita muletillas y tomas repetidas, elige palabras clave,
  dónde hacer zoom y qué emojis poner. Si falla, hay una heurística de respaldo.
- La vista previa en el portal es en vivo (Remotion Player): cambias estilo y se ve al instante, sin renderizar.
- Fuentes y sonidos van incluidos en `public/` (no dependen de internet al renderizar).

### Brand Brain mixto

La agencia mete lo que ya sabe al dar de alta al cliente. El cliente, desde su portal, puede agregar notas,
referencias, cuentas que admira, contestar "preguntas rápidas" y crear moods. Todo queda en `brand_inputs` con quién lo
subió, y "Re-sintetizar" hace que Claude lo junte en un solo perfil (los datos duros de la agencia ganan; los gustos y lo
más nuevo del cliente ganan en estilo).

## Puesta en marcha

### 1. Supabase
1. Crea un proyecto en supabase.com.
2. SQL Editor → pega `supabase/migrations/0001_init.sql` → Run.
3. Da de alta a la agencia (antes de entrar por primera vez):
   ```sql
   insert into members (email, role) values ('tu-correo@ejemplo.com', 'agency');
   ```
4. Authentication → URL Configuration: agrega tu dominio y `https://TU-DOMINIO/auth/callback` a Redirect URLs.
5. Storage → Settings: sube el límite de tamaño de archivo (los videos de celular pesan 100 a 500 MB).

### 2. Variables
Copia `.env.example` a `.env.local` y llénalo (Supabase, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `APIFY_TOKEN`).
En Vercel pon las mismas variables.

### 3. Portal
```bash
npm install
npm run dev        # http://localhost:3000
```
Deploy: conectar el repo en Vercel. Las rutas de escaneo y plan usan hasta 5 min (`maxDuration = 300`).

### 4. Worker de edición (en tu compu)
Necesita Node 20+, Git y ffmpeg (Windows: `winget install OpenJS.NodeJS.LTS Git.Git Gyan.FFmpeg`).
```bash
git clone https://github.com/zeronneai/ROOTS-ENGINE.git
cd ROOTS-ENGINE
npm install
# crea .env.local con NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
npm run check     # revisa que todo esté listo
npm run worker    # déjalo corriendo
```
La transcripción es local y gratis (Whisper). La primera vez descarga el modelo (~470 MB con `small`).
Si la compu está apagada, los videos esperan en fila y se procesan al prenderla.

### 5. Probar estilos sin nada conectado
```bash
npm run demo:styles                 # todos los estilos con el clip de ejemplo → out/demo
npm run demo:styles -- demo/mi-clip.mp4 street-fade,glow-luxe
npm run studio                      # Remotion Studio para ajustar el diseño
```
Tip: reemplaza `public/demo/sample.mp4` con un clip real de alguien de PRA hablando a cámara; es el que se ve en
el laboratorio de la página principal.

## Licencia de Remotion
Remotion es gratis para equipos de hasta 3 personas. Con 4 o más hay que comprar la licencia de empresa
(remotion.pro). Revisarlo antes de cobrar el servicio.

## Siguiente fase
- Publicar directo a IG/TikTok y jalar métricas para que el plan aprenda de lo que funcionó.
- Transcribir los videos de la competencia (hoy se analiza con caption y métricas).
- Subidas grandes con TUS (resumable) y render en la nube (Remotion Lambda).
- B-roll automático, música por mood, plantillas de intro/outro por marca.
