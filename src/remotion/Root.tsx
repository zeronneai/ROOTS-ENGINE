import React from "react";
import { Composition, staticFile } from "remotion";
import { AutoEdit, calculateAutoEditMetadata, type AutoEditProps } from "./AutoEdit";
import { buildEdl, heuristicDirection } from "../lib/edl/build";
import { getPreset } from "../lib/styles/presets";
import { demoWords, DEMO_DURATION } from "./demo";
import { Promo, PROMO } from "./promo/Promo";
import { TourEdit, calculateTourMetadata, type TourEditProps } from "./TourEdit";
import { planShots } from "../lib/tour/plan";

// recorrido de ejemplo para el Studio (con el clip de muestra partido en "cuartos")
const tourPlan = planShots({
  clips: [0, 4, 8, 12, 16].map((s) => ({ start: s, end: s + 4 })),
  beats: Array.from({ length: 80 }, (_, i) => +(i * 0.46875).toFixed(3)),
  bpm: 128,
  targetSeconds: 20,
});
const tourProps: TourEditProps = {
  src: staticFile("demo/sample.mp4"),
  style: getPreset("editorial-minimal"),
  edl: {
    type: "tour",
    fps: 30,
    width: 1080,
    height: 1920,
    duration: tourPlan.duration,
    bpm: 128,
    shots: tourPlan.shots,
    beats: tourPlan.beats,
    property: {
      operation: "venta", price: "$3,450,000", location: "Campestre, Chihuahua", bedrooms: 3, bathrooms: 2.5,
      builtM2: 220, landM2: 300, parking: 2, amenities: ["Alberca", "Cocina integral"], agentName: "Laura Méndez", agentPhone: "614 123 4567",
    },
    copy: { headline: "Casa con alberca en Campestre", highlights: ["Doble altura", "Lista para mudarte"], cta: "Agenda tu visita" },
    rooms: ["Fachada", "Sala", "Cocina", "Recámara principal", "Alberca"],
    music: null,
  },
  brand: { name: "Inmobiliaria Norte", handle: "inmobiliarianorte" },
};

const style = getPreset("street-fade");
const words = demoWords();
const edl = buildEdl({
  words,
  sourceDuration: DEMO_DURATION,
  style,
  direction: heuristicDirection(words, style, "El secreto que nadie te dice"),
});

const defaultProps: AutoEditProps = {
  src: staticFile("demo/sample.mp4"),
  edl,
  style,
  brand: { name: "Purple Roots", handle: "purplerootsagency" },
};

export const RemotionRoot: React.FC = () => (
  <>
  <Composition
    id="AutoEdit"
    component={AutoEdit}
    defaultProps={defaultProps}
    calculateMetadata={calculateAutoEditMetadata}
    durationInFrames={300}
    fps={30}
    width={1080}
    height={1920}
  />
  <Composition id="Promo" component={Promo} {...PROMO} />
  <Composition
    id="Tour"
    component={TourEdit}
    defaultProps={tourProps}
    calculateMetadata={calculateTourMetadata}
    durationInFrames={600}
    fps={30}
    width={1080}
    height={1920}
  />
  </>
);
