// Below this width (px) a Monaco diff is shown inline: two columns of code would be too narrow to read. Monaco's own
// default is 900 px, which made every diff inline on an ordinary 1440 px laptop (the editor pane is about 630 px), so
// side by side could not be reached and a removed line could not take the cursor (live, 2026-11-20, ADM-1314).
export const SIDE_BY_SIDE_MIN_PX = 600
