import './App.css';

function App() {
  return (
    <main className="pixel-agent-office">
      <header>
        <h1>Pixel Agent Office</h1>
      </header>

      <div className="office-layout">
        <section className="office-panel" aria-labelledby="office-title">
          <h2 id="office-title">오피스</h2>
          <p>아직 배치된 에이전트가 없습니다.</p>
        </section>

        <section className="office-panel" aria-labelledby="task-title">
          <h2 id="task-title">작업 상세</h2>
          <p>선택된 작업이 없습니다.</p>
        </section>
      </div>
    </main>
  )
}

export default App
