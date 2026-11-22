import './App.css'

import { useState } from 'react'

import { OfficeCanvas } from './features/office/OfficeCanvas'


function App() {
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null)

  return (
    <main className="pixel-agent-office">
      <header>
        <h1>Pixel Agent Office</h1>
      </header>

      <div className="office-layout">
        <section className="office-panel" aria-labelledby="office-title">
          <h2 id="office-title">오피스</h2>
          <OfficeCanvas onSeatSelect={setSelectedSeatId} />
        </section>

        <section className="office-panel" aria-labelledby="task-title">
          <h2 id="task-title">작업 상세</h2>
          <p role="status">
              {selectedSeatId ? `선택한 좌석 · ${selectedSeatId}` : '캐릭터를 선택해 주세요.'}
          </p>
        </section>
      </div>
    </main>
  )
}

export default App
