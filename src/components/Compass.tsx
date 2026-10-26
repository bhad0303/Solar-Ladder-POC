type Props = {
  headingDeg: number
}

/** Simple compass; rotates opposite to map heading so N stays geographic. */
export function Compass({ headingDeg }: Props) {
  return (
    <div className="compass" aria-label="Compass">
      <div
        className="compass-rose"
        style={{ transform: `rotate(${-headingDeg}deg)` }}
      >
        <span className="compass-n">N</span>
        <span className="compass-e">E</span>
        <span className="compass-s">S</span>
        <span className="compass-w">W</span>
      </div>
    </div>
  )
}
