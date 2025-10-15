import { useState } from 'react'
import './App.css'
import { Container, CssBaseline, Snackbar, Alert } from '@mui/material'
import LivenessCheck from './components/LivenessCheck'
import type { LivenessResult } from './utils/liveness'

function App() {
  const [result, setResult] = useState<LivenessResult | null>(null)

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <CssBaseline />
      <LivenessCheck onResult={setResult} />
      <Snackbar open={!!result} autoHideDuration={4000} onClose={() => setResult(null)}>
        <Alert onClose={() => setResult(null)} severity={result?.alive ? 'success' : 'error'} sx={{ width: '100%' }}>
          {result?.alive ? 'Prova de vida concluída com sucesso' : `Falha: ${result?.reason}`}
        </Alert>
      </Snackbar>
    </Container>
  )
}

export default App
