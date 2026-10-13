import React from "react";
import { Composition, staticFile } from "remotion";
import { AutoEdit, calculateAutoEditMetadata, type AutoEditProps } from "./AutoEdit";
import { buildEdl, heuristicDirection } from "../lib/edl/build";
import { getPreset } from "../lib/styles/presets";
import { demoWords, DEMO_DURATION } from "./demo";
import { Promo, PROMO } from "./promo/Promo";

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
  </>
);
