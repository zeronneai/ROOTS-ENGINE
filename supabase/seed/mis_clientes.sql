-- Mis clientes: Tippin' Cowgirl, DejaVu Medspa, El Toro Law (Mario Yague) y Torque Baseball.
-- Se puede correr las veces que sea: si el cliente ya existe, no lo duplica, solo rellena lo que le falte
-- (sitio web, Instagram, notas) y le da de alta su sitio para la analítica web con una llave fija
-- (la misma que ya quedó pegada en el código de cada página).

create or replace function pg_temp.seed_client(
  p_match text, p_name text, p_niche text, p_language text, p_instagram text, p_website text,
  p_maps text, p_domain text, p_key text, p_notes text
) returns text language plpgsql as $$
declare
  cid uuid;
  slug_base text := lower(regexp_replace(p_name, '[^A-Za-z0-9]+', '-', 'g'));
begin
  select id into cid from clients where name ~* p_match order by created_at limit 1;
  if cid is null then
    insert into clients (name, slug, niche, city, language, instagram, website, google_maps_url, plan_tier, status)
    values (p_name, trim(both '-' from slug_base), p_niche, 'El Paso, TX', p_language, p_instagram, p_website, p_maps, 'full', 'active')
    returning id into cid;
  else
    update clients set
      niche = coalesce(niche, p_niche),
      instagram = coalesce(instagram, p_instagram),
      website = coalesce(website, p_website),
      google_maps_url = coalesce(google_maps_url, p_maps)
    where id = cid;
  end if;

  insert into brand_profiles (client_id) values (cid) on conflict (client_id) do nothing;

  if p_notes is not null and not exists (select 1 from brand_inputs where client_id = cid and title = 'Lo que ya sabemos (agencia)') then
    insert into brand_inputs (client_id, kind, title, content, added_by_role)
    values (cid, 'note', 'Lo que ya sabemos (agencia)', p_notes, 'agency');
  end if;

  if p_instagram is not null then
    insert into competitors (client_id, platform, handle, is_own_account)
    values (cid, 'instagram', p_instagram, true) on conflict (client_id, platform, handle) do nothing;
  end if;

  if not exists (select 1 from sites where key = p_key) then
    delete from sites where client_id = cid and domain = p_domain and not exists (select 1 from web_events e where e.site_id = sites.id);
    insert into sites (client_id, domain, key) values (cid, p_domain, p_key);
  end if;

  return p_name || ' listo';
end $$;

select pg_temp.seed_client(
  'tippin', 'Tippin'' Cowgirl', 'western', 'bilingual', '_tippincowgirl', 'https://tippincowgirl.com', null,
  'tippincowgirl.com', 'ab7347dde08e3b55079ba2c935edf43d',
  'Hat Bar de sombreros vaqueros personalizados, el primero en El Paso. Dueña: Deborah.
Ubicación: The Shoppes at Solana, El Paso, TX. Horario: jueves y viernes 1 a 7 pm, sábado 12 a 7 pm, domingo 12 a 6 pm. Lunes a miércoles solo con cita para eventos privados.
Grand opening fue el 5 de septiembre 2026. Colaboraciones: Girls Run The 915 (bandanas "Cowgirls Run The 915") y Leslie, influencer de El Paso.
Meta: vender 500 sombreros desde el sitio, que tiene un builder de sombrero con checkout. Sellos quemados e iniciales solo en persona en el Hat Bar.
En Instagram las fotos le han ganado a los reels en vistas. TikTok está empezando.
Estilo: western, divertido, femenino, caricatura coral en los videos de IA.'
);

select pg_temp.seed_client(
  'deja ?vu', 'DejaVu Medspa', 'medspa', 'bilingual', 'dejatox_ep', 'https://www.dejavutoxandmore.com', null,
  'dejavutoxandmore.com', '18959f69e037d30aac2d9966b89766d8',
  'Med spa en El Paso. Nombre nuevo: DejaVu Medspa (antes DejaVu Tox & More). Rebranding premium hecho por Purple Roots: logo Olive Echo (una hoja y su eco en contorno), wordmark Gilda Display.
Tratamientos: neuromoduladores (tox), dermal fillers, PRP microneedling, Diamond Glow, Opus Plasma, medical weight loss y wellness.
El equipo de la agencia graba su contenido. Tono: lujo tranquilo, cercano, resultados naturales.'
);

select pg_temp.seed_client(
  'yague|el toro', 'El Toro Law (Mario Yague)', 'abogados', 'bilingual', 'yaguelaw', 'https://www.marioyaguelaw.com', null,
  'marioyaguelaw.com', '598b3b3bf2942ed7afbcd95f604f0a1b',
  'Despacho de lesiones personales (accidentes de auto, troca, moto y peatón) de Mario Yague, "El Toro". Tagline: "De choque a cheque".
Teléfono: 915 400 1099. Casos solo de accidentes en Texas o Nuevo México (el cliente puede vivir en México). No casos de trabajo ni negligencia médica.
La primera consulta es gratis. No decir "no pagas si no ganamos".
Contenido que funciona: sketches de comedia en la oficina, carruseles estilo cómic, el toro animado estilo Pixar, cheque gigante con montos de acuerdos.
Corren Meta ads de leads con formulario instantáneo; landing marioyaguelaw.com/pesadillas. Meta: conseguir clientes ya.'
);

select pg_temp.seed_client(
  'torque', 'Torque Baseball', 'deportes', 'bilingual', null, 'https://torquebaseball.us', null,
  'torquebaseball.us', 'ae516dc734ece130f75ee0e5cf561244',
  'Academia de béisbol y performance en El Paso con membresías (app.torquebaseball.us). Dirección: 1030 N Zaragoza Rd, Suite Y-1.
Prueba gratis viernes y sábado; el CTA es WhatsApp o el sitio. Contacto: +1 915-474-0940.
Aliados: Next Level Baseball (tryouts, TrackMan, Colorado Rockies Scout Team). Hacen torneos (torquebaseball.us/tournament).
Un reel se hizo viral con 39K vistas y 414 compartidos. Han corrido Meta ads de mensajes.
Marca: navy #0a1628, blanco y azul eléctrico #1a56a0, textura pinstripe, Anton italic. Look limpio, sin glow, mucho espacio.'
);

-- Para ver cómo quedaron:
select c.name, c.niche, c.instagram, s.domain, s.key from clients c left join sites s on s.client_id = c.id
where c.name ~* 'tippin|deja ?vu|yague|el toro|torque' order by c.name;
