import './App.css'

import { useState } from 'react'

import { GitHubAccount } from './features/auth/GitHubAccount'
import { OfficeCanvas } from './features/office/OfficeCanvas'
import { ReviewTargetPicker } from './features/reviews/ReviewTargetPicker'

import type { OfficeControls } from './engine/world/createOfficeLayout'


function App() {
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null)
  const [officeControls, setOfficeControls] = useState<OfficeControls | null>(null)
  const seatOptions = officeControls?.seatOptions ?? []

  return (
    <main className="pixel-agent-office">
      <header>
        <h1>Pixel Agent Office</h1>
        <GitHubAccount />
      </header>

      <div className="office-layout">
        <section className="office-panel" aria-labelledby="office-title">
          <h2 id="office-title">오피스</h2>
          <OfficeCanvas onSeatSelect={setSelectedSeatId} onOfficeReady={setOfficeControls} />
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
          <button
            type="button"
            disabled={!officeControls?.playMovementDemo}
            onClick={() => officeControls?.playMovementDemo?.()}
          >
            끝자리 이동 시연
          </button>
          <ReviewTargetPicker />
        </section>
      </div>
    </main>
  )
}

export default App
