import type { ComponentType } from "react";
import { AlfredBody, AlfredFace, FelipeBody, FelipeFace, IggyBody, IggyFace, JojoBody, JojoFace, ToddBody, ToddFace } from "./dots";
import { GrokBody, GrokFace } from "./grok";
import { MuseBody, MuseFace } from "./muse";

interface Character {
  /** Static art, drawn once. */
  Body: ComponentType;
  /** Eyes and features, driven by the engine every frame. */
  Face: ComponentType;
}

export const CHARACTERS: Record<string, Character> = {
  iggy: { Body: IggyBody, Face: IggyFace },
  felipe: { Body: FelipeBody, Face: FelipeFace },
  todd: { Body: ToddBody, Face: ToddFace },
  alfred: { Body: AlfredBody, Face: AlfredFace },
  jojo: { Body: JojoBody, Face: JojoFace },
  grok: { Body: GrokBody, Face: GrokFace },
  muse: { Body: MuseBody, Face: MuseFace },
};
