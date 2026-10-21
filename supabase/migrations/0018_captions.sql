-- Copy con IA viendo el video: reglas fijas por cliente y un cierre que siempre va al final.
alter table clients add column if not exists caption_rules text;
alter table clients add column if not exists caption_footer text;

-- Lo que ya sabemos que usan (solo si todavía no tienen nada guardado)
update clients set
  caption_rules = coalesce(caption_rules, 'Cierra siempre con el teléfono y la consulta gratis. En inglés: "📱 915-400-1099 FREE consultation." En español: "📱 915-400-1099, consulta gratis." Hashtags de cajón: #eltoro #elpaso #DeChoqueACheque, más 1 o 2 del tema (por ejemplo #injurylawyer o #truckaccident). Usa "El Toro" y el emoji 🐂. Nunca digas "no pagas si no ganamos".'),
  caption_footer = coalesce(caption_footer, '📱 915-400-1099 FREE consultation.')
where name ~* 'yague|el toro';

update clients set
  caption_rules = coalesce(caption_rules, 'Termina siempre con el teléfono. El CTA es la prueba gratis de viernes y sábado, por WhatsApp o en torquebaseball.us.'),
  caption_footer = coalesce(caption_footer, '📲 915-474-0940')
where name ~* 'torque';
