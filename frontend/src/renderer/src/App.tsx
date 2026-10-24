import { RouterProvider } from 'react-router-dom'
import router from './router'
import Background from './components/Background'
import ToastContainer from './components/ToastContainer'
import BackgroundBridge from './components/BackgroundBridge'

function App(): React.JSX.Element {
  return (
    <>
      <Background />
      <ToastContainer />
      <BackgroundBridge />
      <RouterProvider router={router} />
    </>
  )
}

export default App
