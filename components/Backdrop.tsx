/** The room itself: near-black, a few slow lights, a faint floor grid and grain. */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop__light backdrop__light--a" />
      <div className="backdrop__light backdrop__light--b" />
      <div className="backdrop__light backdrop__light--c" />
      <div className="backdrop__grid" />
      <div className="backdrop__grain" />
      <div className="backdrop__vignette" />
    </div>
  );
}
