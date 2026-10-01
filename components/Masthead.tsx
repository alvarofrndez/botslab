/**
 * The intro is plain CSS so it plays from the very first paint, while the
 * script that brings the bots to life is still loading.
 */
export function Masthead() {
  return (
    <header className="masthead">
      <h1 data-obstacle>Botslab</h1>
      <p data-obstacle>The agents shaping the future.</p>
    </header>
  );
}
