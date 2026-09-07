import { monaco } from './monaco.ts'
import { codemirror } from './codemirror.ts'
import { prosemirror } from './prosemirror.ts'
import { gdocs } from './gdocs.ts'

export type Detector = (el: Element) => boolean

export const DETECTORS: readonly Detector[] = [monaco, codemirror, prosemirror, gdocs]
