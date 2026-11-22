import './App.css'

import { useState } from 'react'

import { OfficeCanvas } from './features/office/OfficeCanvas'

import type { OfficeSeatOption } from './engine/world/officeSeat'


function App() {
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null)
  const [seatOptions, setSeatOptions] = useState<OfficeSeatOption[]>([])

  return (
    <main className="pixel-agent-office">
      <header>
        <h1>Pixel Agent Office</h1>
      </header>

      <div className="office-layout">
        <section className="office-panel" aria-labelledby="office-title">
          <h2 id="office-title">오피스</h2>
          <OfficeCanvas onSeatSelect={setSelectedSeatId} onSeatsReady={setSeatOptions} />
        </section>

        <section className="office-panel" aria-labelledby="task-title">
          <h2 id="task-title">작업 상세</h2>
          <label htmlFor="office-seat">좌석 선택</label>
          <select
            id="office-seat"
            value={selectedSeatId ?? ''}
            disabled={seatOptions.length === 0}
            onChange={(event) => setSelectedSeatId(event.target.value || null)}
          >
            <option value="">좌석을 선택해 주세요</option>
            {seatOptions.map(({ id, label }) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </section>
      </div>
    </main>
  )
}

export default App
